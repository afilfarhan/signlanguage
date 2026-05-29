"""
Train word-level ASL recognition model (WordTransformer) and export to ONNX.

Supports:
- Cross-entropy training with early stopping
- Cosine annealing LR schedule
- Top-1, top-5, macro-F1, confusion matrix logging
- Optional frozen pretrained backbone (DynamicTransformerV2 weights)
- Checkpointing (best val accuracy)

Run:
    python ml/train_word_model.py --source synth
    python ml/train_word_model.py --source asl_citizen --manifest path/to/manifest.json
    python ml/train_word_model.py --source wlasl --pretrained ml/models/dynamic_transformer_v2.pt --freeze-encoder

Outputs:
    ml/models/word_transformer.onnx
    ml/models/word_transformer_config.json
    ml/models/word_eval_report.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models.word_model import WordTransformer, WordModelConfig
from data.prepare_word_dataset import CACHE_DIR, T_FRAMES, FEATURE_DIM

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

torch.manual_seed(0)
np.random.seed(0)


def load_cached_split(source: str, split: str):
    cache_path = CACHE_DIR / f"word_{source}" / f"{split}.npz"
    if not cache_path.exists():
        raise FileNotFoundError(
            f"Cached split not found: {cache_path}\n"
            f"Run: python -m ml.data.prepare_word_dataset --source {source}"
        )
    data = np.load(cache_path, allow_pickle=True)
    return data["X"], data["y"], list(data["labels"])


def train_one_epoch(model, dl, opt, loss_fn, device):
    model.train()
    total, correct, loss_sum = 0, 0, 0.0
    for xb, yb in dl:
        xb, yb = xb.to(device), yb.to(device)
        opt.zero_grad()
        logits, _ = model(xb)
        loss = loss_fn(logits, yb)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        opt.step()
        loss_sum += loss.item() * xb.size(0)
        total += xb.size(0)
        correct += (logits.argmax(1) == yb).sum().item()
    return loss_sum / total, correct / total


@torch.no_grad()
def evaluate(model, dl, device):
    model.eval()
    all_pred, all_true = [], []
    for xb, yb in dl:
        xb = xb.to(device)
        logits, _ = model(xb)
        all_pred.append(logits.argmax(1).cpu().numpy())
        all_true.append(yb.numpy())
    y_pred = np.concatenate(all_pred)
    y_true = np.concatenate(all_true)
    acc = accuracy_score(y_true, y_pred)
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    top5 = top5_accuracy(model, dl, device)
    return acc, macro_f1, top5, y_pred, y_true


@torch.no_grad()
def top5_accuracy(model, dl, device):
    model.eval()
    correct, total = 0, 0
    for xb, yb in dl:
        xb, yb = xb.to(device), yb.to(device)
        logits, _ = model(xb)
        top5_pred = logits.topk(5, dim=1).indices
        correct += (top5_pred == yb.unsqueeze(1)).any(dim=1).sum().item()
        total += yb.size(0)
    return correct / total if total > 0 else 0.0


def main():
    parser = argparse.ArgumentParser(description="Train WordTransformer")
    parser.add_argument("--source", choices=["synth", "asl_citizen", "wlasl"], default="synth")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--patience", type=int, default=7, help="Early stopping patience")
    parser.add_argument("--d-model", type=int, default=128)
    parser.add_argument("--n-layers", type=int, default=4)
    parser.add_argument("--n-heads", type=int, default=8)
    parser.add_argument("--ff-dim", type=int, default=256)
    parser.add_argument("--dropout", type=float, default=0.1)
    parser.add_argument("--pretrained", type=str, default=None, help="Path to pretrained .pt weights")
    parser.add_argument("--freeze-encoder", action="store_true")
    parser.add_argument("--opset", type=int, default=17)
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    print(f"Loading cached data (source={args.source})...")
    X_train, y_train, labels = load_cached_split(args.source, "train")
    X_val, y_val, _ = load_cached_split(args.source, "val")
    X_test, y_test, _ = load_cached_split(args.source, "test")
    vocab_size = len(labels)
    print(f"  Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")
    print(f"  Vocab size: {vocab_size}")

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
    val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(y_val))
    test_ds = TensorDataset(torch.from_numpy(X_test), torch.from_numpy(y_test))
    train_dl = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, drop_last=False)
    val_dl = DataLoader(val_ds, batch_size=args.batch_size * 2)
    test_dl = DataLoader(test_ds, batch_size=args.batch_size * 2)

    config = WordModelConfig(
        vocab_size=vocab_size,
        t_frames=T_FRAMES,
        feature_dim=FEATURE_DIM,
        d_model=args.d_model,
        n_heads=args.n_heads,
        n_layers=args.n_layers,
        ff_dim=args.ff_dim,
        dropout=args.dropout,
        pretrained_path=args.pretrained,
        freeze_encoder=args.freeze_encoder,
    )

    model = WordTransformer(config).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model: WordTransformer · {n_params:,} params ({trainable:,} trainable)")

    opt = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr, weight_decay=args.weight_decay,
    )
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.1)

    best_val_acc = 0.0
    patience_counter = 0
    best_path = os.path.join(MODEL_DIR, "word_transformer_best.pt")

    print(f"\nTraining {args.epochs} epochs (patience={args.patience})...")
    t0 = time.time()
    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_one_epoch(model, train_dl, opt, loss_fn, device)
        sched.step()

        val_acc, val_f1, val_top5, _, _ = evaluate(model, val_dl, device)

        lr_now = sched.get_last_lr()[0]
        print(f"  epoch {epoch:3d}  loss={train_loss:.4f}  "
              f"train_acc={train_acc:.3f}  val_acc={val_acc:.3f}  "
              f"val_top5={val_top5:.3f}  val_f1={val_f1:.3f}  lr={lr_now:.2e}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), best_path)
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= args.patience:
                print(f"  Early stopping at epoch {epoch} (best val_acc={best_val_acc:.3f})")
                break

    elapsed = time.time() - t0
    print(f"Training completed in {elapsed:.1f}s")

    model.load_state_dict(torch.load(best_path, map_location=device, weights_only=True))
    print(f"Loaded best checkpoint (val_acc={best_val_acc:.3f})")

    test_acc, test_f1, test_top5, y_pred, y_true = evaluate(model, test_dl, device)
    print(f"\nTest: top1={test_acc:.3f}  top5={test_top5:.3f}  macro_f1={test_f1:.3f}")

    present_labels = list(set(y_true.tolist()))
    present_names = [labels[i] for i in sorted(present_labels) if i < len(labels)]
    report = classification_report(y_true, y_pred, labels=sorted(present_labels),
                                   target_names=present_names, digits=3, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)

    flagged_pairs = []
    for i in range(min(cm.shape[0], len(labels))):
        row_sum = cm[i].sum()
        if row_sum == 0:
            continue
        for j in range(cm.shape[1]):
            if i != j and cm[i, j] / row_sum > 0.10:
                flagged_pairs.append((labels[i], labels[j], cm[i, j] / row_sum))

    onnx_path = os.path.join(MODEL_DIR, "word_transformer.onnx")
    model.export_onnx(onnx_path, opset=args.opset)
    size_kb = os.path.getsize(onnx_path) / 1024

    config_path = os.path.join(MODEL_DIR, "word_transformer_config.json")
    config.save(config_path)
    print(f"Saved config -> {config_path}")

    with open(os.path.join(MODEL_DIR, "word_labels.json"), "w") as f:
        json.dump({
            "labels": labels,
            "vocab_size": vocab_size,
            "t_frames": T_FRAMES,
            "feature_dim": FEATURE_DIM,
            "d_model": args.d_model,
            "n_layers": args.n_layers,
            "n_heads": args.n_heads,
        }, f, indent=2)

    infer_input = torch.randn(1, T_FRAMES, FEATURE_DIM).to(device)
    t_start = time.time()
    for _ in range(50):
        model(infer_input)
    if device == "cuda":
        torch.cuda.synchronize()
    infer_ms = (time.time() - t_start) / 50 * 1000
    fps = 1000 / infer_ms if infer_ms > 0 else 0

    flagged_md = ""
    if flagged_pairs:
        flagged_md = "## Flagged Confusion Pairs (>10% off-diagonal)\n\n"
        flagged_md += "| True | Predicted | Rate |\n|---|---|---|\n"
        for tl, pl, rate in sorted(flagged_pairs, key=lambda x: -x[2])[:20]:
            flagged_md += f"| {tl} | {pl} | {rate:.1%} |\n"
        flagged_md += "\n"

    report_md = f"""# Eval report — `word_transformer.onnx`

**Dataset:** {args.source} ({vocab_size} words)
**Sequence:** T = {T_FRAMES} frames, feature_dim = {FEATURE_DIM}
**Model:** WordTransformer · d_model={args.d_model} · {args.n_heads} heads · {args.n_layers} layers · {n_params:,} params

## Headline

- **Top-1 accuracy:** {test_acc:.3f}
- **Top-5 accuracy:** {test_top5:.3f}
- **Macro-F1:** {test_f1:.3f}
- **Model size:** {size_kb:.1f} KB ({size_kb/1024:.2f} MB)
- **Inference:** {infer_ms:.1f} ms / sample ({fps:.0f} FPS) on {device}

{flagged_md}
## Per-class

```
{report}
```

## Files

- `word_transformer.onnx` — ONNX model for browser deployment
- `word_transformer_config.json` — model config
- `word_labels.json` — label names + metadata
"""
    report_path = os.path.join(MODEL_DIR, "word_eval_report.md")
    with open(report_path, "w") as f:
        f.write(report_md)
    print(f"Saved eval report -> {report_path}")

    if os.path.exists(best_path):
        os.remove(best_path)

    print("\nDone!")


if __name__ == "__main__":
    main()
