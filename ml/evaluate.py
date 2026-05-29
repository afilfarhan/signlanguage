"""
Evaluation script for word-level ASL recognition model.

Produces:
- Per-class accuracy and confusion matrix
- Top-10 most confused sign pairs
- Inference speed benchmark (CPU and GPU if available)
- Latency/accuracy tradeoff table at different confidence thresholds

Run:
    python ml/evaluate.py --source synth
    python ml/evaluate.py --source asl_citizen --benchmark
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    classification_report, confusion_matrix, top_k_accuracy_score,
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models.word_model import WordTransformer, WordModelConfig
from data.prepare_word_dataset import CACHE_DIR, T_FRAMES, FEATURE_DIM

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")


def load_cached_split(source: str, split: str):
    cache_path = CACHE_DIR / f"word_{source}" / f"{split}.npz"
    if not cache_path.exists():
        raise FileNotFoundError(
            f"Cached split not found: {cache_path}\n"
            f"Run: python -m ml.data.prepare_word_dataset --source {source}"
        )
    data = np.load(cache_path, allow_pickle=True)
    return data["X"], data["y"], list(data["labels"])


def benchmark_torch(model: WordTransformer, device: str, n_runs: int = 100, warmup: int = 10):
    model.eval()
    dummy = torch.randn(1, T_FRAMES, FEATURE_DIM, device=device)
    for _ in range(warmup):
        model(dummy)
    if device == "cuda":
        torch.cuda.synchronize()
    t0 = time.time()
    for _ in range(n_runs):
        model(dummy)
    if device == "cuda":
        torch.cuda.synchronize()
    ms = (time.time() - t0) / n_runs * 1000
    return ms


def benchmark_onnx(onnx_path: str, n_runs: int = 100, warmup: int = 10):
    import onnxruntime as ort
    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name
    dummy = np.random.randn(1, T_FRAMES, FEATURE_DIM).astype(np.float32)
    for _ in range(warmup):
        sess.run(None, {input_name: dummy})
    t0 = time.time()
    for _ in range(n_runs):
        sess.run(None, {input_name: dummy})
    ms = (time.time() - t0) / n_runs * 1000
    return ms


def find_most_confused(cm: np.ndarray, labels: list[str], top_k: int = 10):
    pairs = []
    n = cm.shape[0]
    for i in range(n):
        row_sum = cm[i].sum()
        if row_sum == 0:
            continue
        for j in range(n):
            if i != j and cm[i, j] > 0:
                rate = cm[i, j] / row_sum
                pairs.append((labels[i] if i < len(labels) else str(i),
                              labels[j] if j < len(labels) else str(j),
                              int(cm[i, j]), rate))
    pairs.sort(key=lambda x: -x[3])
    return pairs[:top_k]


def confidence_threshold_sweep(model, X_test, y_test, device, thresholds):
    model.eval()
    with torch.no_grad():
        logits, _ = model(torch.from_numpy(X_test).to(device))
        probs = torch.softmax(logits, dim=1).cpu().numpy()
    results = []
    for thresh in thresholds:
        mask = probs.max(axis=1) >= thresh
        n_covered = mask.sum()
        if n_covered > 0:
            acc_at_thresh = accuracy_score(y_test[mask], probs[mask].argmax(axis=1))
        else:
            acc_at_thresh = 0.0
        coverage = n_covered / len(y_test)
        results.append({
            "threshold": thresh,
            "accuracy": round(acc_at_thresh, 4),
            "coverage": round(coverage, 4),
            "n_covered": int(n_covered),
        })
    return results


def main():
    parser = argparse.ArgumentParser(description="Evaluate WordTransformer")
    parser.add_argument("--source", choices=["synth", "asl_citizen", "wlasl"], default="synth")
    parser.add_argument("--benchmark", action="store_true", help="Run inference speed benchmark")
    parser.add_argument("--sweep", action="store_true", help="Run confidence threshold sweep")
    args = parser.parse_args()

    print(f"Loading test data (source={args.source})...")
    X_test, y_test, labels = load_cached_split(args.source, "test")
    print(f"  Test: {X_test.shape[0]} samples, {len(labels)} classes")

    config_path = os.path.join(MODEL_DIR, "word_transformer_config.json")
    weights_path = os.path.join(MODEL_DIR, "word_transformer.onnx")
    pt_path = os.path.join(MODEL_DIR, "word_transformer_best.pt")

    if not os.path.exists(config_path):
        print(f"ERROR: Config not found at {config_path}")
        print("Run: python ml/train_word_model.py --source {args.source}")
        return

    config = WordModelConfig.load(config_path)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}")

    model = WordTransformer(config).to(device)
    if os.path.exists(pt_path):
        model.load_state_dict(torch.load(pt_path, map_location=device, weights_only=True))
        print(f"Loaded weights from {pt_path}")
    else:
        print("WARNING: No .pt checkpoint found, using randomly initialized model")

    model.eval()
    with torch.no_grad():
        logits, _ = model(torch.from_numpy(X_test).to(device))
        y_pred = logits.argmax(1).cpu().numpy()

    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro", zero_division=0)
    weighted_f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)
    try:
        probs_all = torch.softmax(logits, dim=1).cpu().numpy()
        top5 = top_k_accuracy_score(y_test, probs_all, k=5)
    except Exception:
        top5 = 0.0
    precision = precision_score(y_test, y_pred, average="macro", zero_division=0)
    recall = recall_score(y_test, y_pred, average="macro", zero_division=0)

    print(f"\n{'='*50}")
    print(f"  Top-1 Accuracy:  {acc:.4f}")
    print(f"  Top-5 Accuracy:  {top5:.4f}")
    print(f"  Macro-F1:        {macro_f1:.4f}")
    print(f"  Weighted-F1:     {weighted_f1:.4f}")
    print(f"  Macro-Precision: {precision:.4f}")
    print(f"  Macro-Recall:    {recall:.4f}")
    print(f"{'='*50}")

    present_labels = sorted(set(y_test.tolist()))
    present_names = [labels[i] for i in present_labels if i < len(labels)]
    report = classification_report(y_test, y_pred, labels=present_labels,
                                   target_names=present_names, digits=3, zero_division=0)
    print(f"\n{report}")

    cm = confusion_matrix(y_test, y_pred)
    confused = find_most_confused(cm, labels, top_k=10)
    if confused:
        print("\nTop-10 most confused pairs:")
        print(f"  {'True':>15} {'Pred':>15} {'Count':>6} {'Rate':>8}")
        print(f"  {'-'*15} {'-'*15} {'-'*6} {'-'*8}")
        for true_l, pred_l, count, rate in confused:
            print(f"  {true_l:>15} {pred_l:>15} {count:>6} {rate:>7.1%}")

    if args.benchmark:
        print(f"\n--- Inference Speed Benchmark ---")
        torch_ms = benchmark_torch(model, device)
        torch_fps = 1000 / torch_ms if torch_ms > 0 else 0
        print(f"  PyTorch ({device}): {torch_ms:.1f} ms/sample ({torch_fps:.0f} FPS)")

        onnx_ms = benchmark_onnx(weights_path)
        onnx_fps = 1000 / onnx_ms if onnx_ms > 0 else 0
        print(f"  ONNX Runtime (CPU): {onnx_ms:.1f} ms/sample ({onnx_fps:.0f} FPS)")

        cpu_target = 15
        gpu_target = 30
        torch_pass = torch_fps >= (gpu_target if device == "cuda" else cpu_target)
        onnx_pass = onnx_fps >= cpu_target
        print(f"  Latency target (CPU ≥{cpu_target} FPS): {'PASS' if onnx_pass else 'FAIL'}")
        if device == "cuda":
            print(f"  Latency target (GPU ≥{gpu_target} FPS): {'PASS' if torch_pass else 'FAIL'}")

    if args.sweep:
        print(f"\n--- Confidence Threshold Sweep ---")
        thresholds = [0.25, 0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
        sweep_results = confidence_threshold_sweep(model, X_test, y_test, device, thresholds)
        print(f"  {'Thresh':>7} {'Acc':>7} {'Coverage':>9} {'N':>7}")
        print(f"  {'-'*7} {'-'*7} {'-'*9} {'-'*7}")
        for r in sweep_results:
            print(f"  {r['threshold']:>7.2f} {r['accuracy']:>7.4f} {r['coverage']:>8.1%} {r['n_covered']:>7}")

    results_out = {
        "source": args.source,
        "top1_accuracy": round(acc, 4),
        "top5_accuracy": round(top5, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "macro_precision": round(precision, 4),
        "macro_recall": round(recall, 4),
        "n_test": int(len(y_test)),
        "vocab_size": len(labels),
        "most_confused_pairs": [
            {"true": t, "predicted": p, "count": c, "rate": round(r, 4)}
            for t, p, c, r in confused
        ],
    }
    if args.benchmark:
        results_out["latency_ms_pytorch"] = round(torch_ms, 2)
        results_out["latency_ms_onnx_cpu"] = round(onnx_ms, 2)
        results_out["fps_pytorch"] = round(torch_fps, 1)
        results_out["fps_onnx_cpu"] = round(onnx_fps, 1)
    if args.sweep:
        results_out["confidence_sweep"] = sweep_results

    out_path = os.path.join(MODEL_DIR, f"word_eval_results_{args.source}.json")
    with open(out_path, "w") as f:
        json.dump(results_out, f, indent=2)
    print(f"\nSaved results -> {out_path}")


if __name__ == "__main__":
    main()
