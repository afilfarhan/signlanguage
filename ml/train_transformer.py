"""
Train a small Transformer encoder for dynamic isolated-sign recognition and
export it to ONNX so the browser runtime (onnxruntime-web) can serve it.

Run:
    python3 ml/train_transformer.py

Outputs:
    ml/models/dynamic_signs_transformer.onnx
    ml/models/dynamic_labels.json
    ml/models/dynamic_eval_report.md

The model is intentionally tiny (~25k params) so it ships as a few-hundred-KB
ONNX file and runs comfortably in WASM/WebGPU at 30 FPS in a sliding window.
Architecture follows PDR §7.1 (landmark Transformer over a 45-frame window).
"""
from __future__ import annotations
import json, os, math
import numpy as np
import argparse
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from synth_sequences import make_dataset, T_FRAMES, LABELS
from seq_features import normalize_batch

# --- CLI -------------------------------------------------------------------
# `--rotation-aug` triggers training-time-only rotation augmentation. The
# held-out test set is left untouched so the eval / robustness numbers stay
# honest. This is the textbook way to close a robustness-gate failure.
parser = argparse.ArgumentParser()
parser.add_argument("--rotation-aug", action="store_true",
    help="Apply ±35° random rotation to TRAINING clips only (each epoch resamples).")
parser.add_argument("--epochs", type=int, default=20)
args = parser.parse_args()

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

torch.manual_seed(0)
np.random.seed(0)

# ----------------------------- Data ---------------------------------------
print("Generating synthetic sequence dataset…")
X_raw, y, labels = make_dataset(n_per_class=200, seed=0)
print(f"  raw shape: {X_raw.shape}  ({len(labels)} classes)")

# Split FIRST (on raw sequences), so augmentation can be applied to the
# training half only and the test set stays untouched.
X_raw_train, X_raw_test, y_train, y_test = train_test_split(
    X_raw, y, test_size=0.2, random_state=42, stratify=y
)

def rotate_clip(clip: np.ndarray, deg: float) -> np.ndarray:
    """Rotate a (T, 21, 3) clip in image-plane around the first-frame wrist."""
    rot = np.deg2rad(deg)
    R = np.array([[np.cos(rot), -np.sin(rot), 0],
                  [np.sin(rot),  np.cos(rot), 0],
                  [0,            0,           1]], dtype=np.float32)
    anchor = clip[0:1, 0:1, :].copy()
    return ((clip - anchor) @ R.T) + anchor

if args.rotation_aug:
    print("Applying training-time rotation augmentation (±35°)…")
    rng_aug = np.random.default_rng(7)
    X_raw_train_aug = np.stack([
        rotate_clip(c, rng_aug.uniform(-35, 35)) for c in X_raw_train
    ])
    # Concatenate clean + rotated (so the model sees both)
    X_raw_train = np.concatenate([X_raw_train, X_raw_train_aug], axis=0)
    y_train     = np.concatenate([y_train, y_train], axis=0)
    print(f"  training set size after augmentation: {X_raw_train.shape[0]}")

# Now normalize both halves with the same pipeline
X_train = normalize_batch(X_raw_train)
X_test  = normalize_batch(X_raw_test)
print(f"  feature shape after normalization: train={X_train.shape}  test={X_test.shape}")

train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(y_train))
test_ds  = TensorDataset(torch.from_numpy(X_test),  torch.from_numpy(y_test))
train_dl = DataLoader(train_ds, batch_size=64, shuffle=True)
test_dl  = DataLoader(test_ds, batch_size=128)

# ----------------------------- Model --------------------------------------
class SignTransformer(nn.Module):
    """Tiny Transformer encoder for landmark sequences."""
    def __init__(self, n_classes: int, d_in: int = 126, d_model: int = 64,
                 n_heads: int = 4, n_layers: int = 2, ff_mult: int = 2,
                 max_len: int = T_FRAMES, dropout: float = 0.1):
        super().__init__()
        self.input_proj = nn.Linear(d_in, d_model)
        # Learned positional embedding (matches the export when seq_len is fixed)
        self.pos = nn.Parameter(torch.zeros(1, max_len, d_model))
        nn.init.trunc_normal_(self.pos, std=0.02)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads,
            dim_feedforward=d_model * ff_mult,
            dropout=dropout, batch_first=True, activation="gelu"
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.norm = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, n_classes)

    def forward(self, x):                      # x: (B, T, 126)
        h = self.input_proj(x) + self.pos      # (B, T, d_model)
        h = self.encoder(h)                    # (B, T, d_model)
        h = self.norm(h.mean(dim=1))           # mean-pool over time -> (B, d_model)
        return self.head(h)                    # (B, n_classes) logits

device = "cpu"
model = SignTransformer(n_classes=len(labels)).to(device)
n_params = sum(p.numel() for p in model.parameters())
print(f"Model: SignTransformer · {n_params:,} params")

# ----------------------------- Train --------------------------------------
opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-4)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=20)
loss_fn = nn.CrossEntropyLoss()

EPOCHS = args.epochs
print(f"Training {EPOCHS} epochs on CPU…")
for epoch in range(1, EPOCHS + 1):
    model.train()
    total, correct, loss_sum = 0, 0, 0.0
    for xb, yb in train_dl:
        opt.zero_grad()
        logits = model(xb)
        loss = loss_fn(logits, yb)
        loss.backward()
        opt.step()
        loss_sum += loss.item() * xb.size(0)
        total += xb.size(0)
        correct += (logits.argmax(1) == yb).sum().item()
    sched.step()
    train_acc = correct / total
    train_loss = loss_sum / total

    # Eval
    model.eval()
    with torch.no_grad():
        all_pred, all_true = [], []
        for xb, yb in test_dl:
            pred = model(xb).argmax(1)
            all_pred.append(pred.numpy()); all_true.append(yb.numpy())
        y_pred = np.concatenate(all_pred); y_true = np.concatenate(all_true)
        test_acc = accuracy_score(y_true, y_pred)
    print(f"  epoch {epoch:2d}  loss={train_loss:.4f}  train_acc={train_acc:.3f}  test_acc={test_acc:.3f}")

# ----------------------------- Final eval ---------------------------------
model.eval()
with torch.no_grad():
    logits = model(torch.from_numpy(X_test))
    y_pred = logits.argmax(1).numpy()
acc = accuracy_score(y_test, y_pred)
report = classification_report(y_test, y_pred, target_names=labels, digits=3)
cm = confusion_matrix(y_test, y_pred)
print(f"\nFinal held-out accuracy: {acc:.3f}")
print(report)

# ----------------------------- Export to ONNX -----------------------------
onnx_path = os.path.join(MODEL_DIR, "dynamic_signs_transformer.onnx")
print(f"Exporting to {onnx_path}…")

# Fixed shape export (T=45) keeps the runtime fast and the file small.
dummy = torch.randn(1, T_FRAMES, 126, dtype=torch.float32)
torch.onnx.export(
    model, dummy, onnx_path,
    input_names=["input"], output_names=["logits"],
    dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
    opset_version=17,
    do_constant_folding=True,
    dynamo=False,
)
size_kb = os.path.getsize(onnx_path) / 1024
print(f"  wrote {size_kb:.1f} KB")

with open(os.path.join(MODEL_DIR, "dynamic_labels.json"), "w") as f:
    json.dump({"labels": labels, "seq_len": T_FRAMES, "feature_dim": 126}, f, indent=2)

# ----------------------------- Sanity-check ONNX vs PyTorch ---------------
import onnxruntime as ort_check_available
try:
    import onnxruntime as ort
    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    onnx_logits = sess.run(["logits"], {"input": X_test[:64].astype(np.float32)})[0]
    onnx_pred = onnx_logits.argmax(1)
    parity = (onnx_pred == y_pred[:64]).mean()
    print(f"PyTorch↔ONNX prediction parity on first 64 test examples: {parity:.3f}")
except Exception as e:
    print(f"(skipping onnxruntime parity check: {e})")
    parity = None

# ----------------------------- Fairness slices (placeholder) --------------
slice_a = X_test[::2]; slice_a_y = y_test[::2]
slice_b = X_test[1::2]; slice_b_y = y_test[1::2]
with torch.no_grad():
    acc_a = accuracy_score(slice_a_y, model(torch.from_numpy(slice_a)).argmax(1).numpy())
    acc_b = accuracy_score(slice_b_y, model(torch.from_numpy(slice_b)).argmax(1).numpy())

# ----------------------------- Per-class confusion table ------------------
def cm_md(cm, labels):
    head = "|  | " + " | ".join(labels) + " |"
    sep  = "|---|" + "|".join(["---"] * len(labels)) + "|"
    rows = [
        f"| **{labels[i]}** | " + " | ".join(str(int(v)) for v in cm[i]) + " |"
        for i in range(len(labels))
    ]
    return "\n".join([head, sep, *rows])

# ----------------------------- Eval report --------------------------------
nfr9_target = 0.80   # PDR NFR-9: ≥80% top-1 for isolated dynamic signs
gate_pass = "✅ pass" if acc >= nfr9_target else "❌ fail"
fair_gap = abs(min(acc_a, acc_b) - acc)
fair_gate = "✅ pass" if fair_gap <= 0.05 else "❌ fail"

report_md = f"""# Eval report — `dynamic_signs_transformer.onnx`

**Dataset:** synthetic landmark sequences (8 classes × 200 examples, seed 0).
**Sequence:** T = {T_FRAMES} frames (~1.5 s @ 30 FPS), feature_dim = 126
(63 normalized positions + 63 frame-to-frame velocities).
**Split:** stratified 80/20.
**Model:** Transformer encoder · d_model=64 · 4 heads · 2 layers · {n_params:,} params · CPU-trained.

## Headline

- **Held-out top-1 accuracy:** **{acc:.3f}** *(NFR-9 target ≥ {nfr9_target:.2f} — {gate_pass})*
- **PyTorch ↔ ONNX prediction parity:** {f"{parity:.3f}" if parity is not None else "n/a"}
- **Model file size:** {size_kb:.1f} KB

## Per-class

```
{report}
```

## Confusion matrix (rows = true, cols = predicted)

{cm_md(cm, labels)}

## Fairness slices (placeholder)

> ⚠️ Synthetic stand-in slices (even/odd index) — this exists only to wire up
> the NFR-10 fairness-gate plumbing. Replace with skin-tone (Monk scale),
> handedness, lighting tier, and camera-angle slices when real data is in.

| Slice | Accuracy | Δ vs. overall |
|---|---|---|
| Slice A (even idx) | {acc_a:.3f} | {acc_a - acc:+.3f} |
| Slice B (odd idx)  | {acc_b:.3f} | {acc_b - acc:+.3f} |

**Fairness gate (NFR-10):** no slice may be more than 5pp below overall.
Worst gap here: **{fair_gap*100:.1f}pp** — {fair_gate}.

## Files

- `dynamic_signs_transformer.onnx` — load via `onnxruntime-web` in `index.html`.
- `dynamic_labels.json` — labels + expected `seq_len` and `feature_dim`.

## How to serve in the browser

```html
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>
<script type="module">
  const session = await ort.InferenceSession.create('models/dynamic_signs_transformer.onnx');
  // collect last 45 frames of normalized landmarks (port `seq_features.normalize_sequence` to JS)
  const inputTensor = new ort.Tensor('float32', flatFeatures, [1, 45, 126]);
  const {{logits}} = await session.run({{ input: inputTensor }});
  const argmax = logits.data.indexOf(Math.max(...logits.data));
  // -> labels[argmax]
</script>
```
"""
report_path = os.path.join(MODEL_DIR, "dynamic_eval_report.md")
with open(report_path, "w") as f:
    f.write(report_md)
print(f"  wrote {report_path}")
