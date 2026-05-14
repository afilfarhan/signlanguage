"""
Stress-test the trained Transformer under realistic noise/perturbation slices.

100 % accuracy on the in-distribution synthetic test set is unsurprising — the
classes are designed to be separable. The interesting question is *how the
model degrades* under conditions that mimic real-world variation. This script
runs the trained ONNX model against several augmented test slices and writes a
report showing accuracy under each — exactly the kind of robustness analysis
the PDR's NFR-9 / NFR-10 release gates need on real data.

Slices evaluated (all applied to the held-out test set):
  - clean                : baseline
  - landmark_jitter      : extra Gaussian noise on every landmark (camera shake)
  - dropped_frames       : 20 % of frames replaced by their predecessor (sluggish FPS)
  - missing_z            : depth coordinate zeroed (older / cheaper webcams)
  - rotated              : whole-clip rotation ±25° (signer angle)
  - scale_shift          : ±20 % hand size (different signers / distances)

Run after `train_transformer.py`:
    python3 ml/eval_robustness.py
"""
from __future__ import annotations
import json, os
import numpy as np
import onnxruntime as ort
from sklearn.metrics import accuracy_score
from synth_sequences import make_dataset
from seq_features import normalize_batch
from sklearn.model_selection import train_test_split

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
ONNX_PATH = os.path.join(MODEL_DIR, "dynamic_signs_transformer.onnx")

print("Loading data + model…")
X_raw, y, labels = make_dataset(n_per_class=200, seed=0)
_, X_test_raw, _, y_test = train_test_split(
    X_raw, y, test_size=0.2, random_state=42, stratify=y
)
sess = ort.InferenceSession(ONNX_PATH, providers=["CPUExecutionProvider"])

def evaluate(X_raw_slice: np.ndarray, name: str) -> float:
    feats = normalize_batch(X_raw_slice).astype(np.float32)
    logits = sess.run(["logits"], {"input": feats})[0]
    pred = logits.argmax(1)
    acc = accuracy_score(y_test, pred)
    print(f"  {name:20s} acc = {acc:.3f}")
    return acc

rng = np.random.default_rng(123)
results = {}

results["clean"] = evaluate(X_test_raw, "clean")

# Heavy landmark jitter (camera shake / blurry frames)
X_j = X_test_raw + rng.normal(0, 0.012, size=X_test_raw.shape).astype(np.float32)
results["landmark_jitter"] = evaluate(X_j, "landmark_jitter")

# Dropped-frame simulation
X_d = X_test_raw.copy()
for n in range(X_d.shape[0]):
    drop_idx = rng.choice(X_d.shape[1], size=int(0.20 * X_d.shape[1]), replace=False)
    drop_idx = np.sort(drop_idx)
    for f in drop_idx:
        X_d[n, f] = X_d[n, max(0, f-1)]
results["dropped_frames"] = evaluate(X_d, "dropped_frames")

# Missing depth
X_z = X_test_raw.copy(); X_z[..., 2] = 0
results["missing_z"] = evaluate(X_z, "missing_z")

# Rotation perturbation per clip
def rotate_clip(clip, deg):
    rot = np.deg2rad(deg)
    R = np.array([[np.cos(rot), -np.sin(rot), 0],
                  [np.sin(rot),  np.cos(rot), 0],
                  [0,            0,           1]], dtype=np.float32)
    # rotate around the first-frame wrist
    anchor = clip[0:1, 0:1, :].copy()
    return ((clip - anchor) @ R.T) + anchor

X_r = np.stack([rotate_clip(c, rng.uniform(-25, 25)) for c in X_test_raw])
results["rotated"] = evaluate(X_r, "rotated")

# Scale shift
X_s = np.stack([
    (c - c[0:1, 0:1, :]) * rng.uniform(0.8, 1.2) + c[0:1, 0:1, :]
    for c in X_test_raw
])
results["scale_shift"] = evaluate(X_s, "scale_shift")

# --- Write robustness report ---------------------------------------------
clean = results["clean"]
gate = 0.05  # 5 pp tolerance (PDR NFR-10)

rows = []
for name, acc in results.items():
    delta = acc - clean
    pass_ = "✅" if abs(delta) <= gate or name == "clean" else "❌"
    rows.append(f"| {name} | {acc:.3f} | {delta:+.3f} | {pass_} |")

report = f"""# Robustness report — `dynamic_signs_transformer.onnx`

This complements `dynamic_eval_report.md` by stress-testing the trained model
under perturbations that mimic real-world variation. The PDR's NFR-10 fairness
gate is 5pp; we apply the same tolerance here as a robustness gate.

> ⚠️ Numbers below are on **synthetic data**. Treat the *shape* of the
> degradation curve as the signal, not the absolute accuracy. With real data,
> "clean" will be much lower than 1.0 and these slices will hurt more — that's
> exactly when this report becomes a useful release gate.

## Robustness slices

| Slice | Accuracy | Δ vs. clean | Within ±5pp? |
|---|---|---|---|
{chr(10).join(rows)}

## What each slice tests

- **clean** — in-distribution baseline.
- **landmark_jitter** — Gaussian σ=0.012 added to every landmark. Mimics camera
  shake, motion blur, and noisy MediaPipe predictions in low light.
- **dropped_frames** — 20 % of frames replaced by their predecessor. Mimics
  sluggish browser FPS on low-end devices.
- **missing_z** — depth coordinate zeroed. Mimics older webcams where MediaPipe
  z-confidence is poor.
- **rotated** — whole-clip rotation ±25°. Mimics signers at oblique angles.
- **scale_shift** — ±20 % hand-size scaling. Mimics different signers / camera
  distances.

## Recommended action when a slice fails on real data

1. Add training examples that match the failing condition (data, not just model).
2. Add explicit augmentation in the training pipeline matching the slice.
3. If still failing, **gate the feature in the UI**: e.g., refuse to score
   attempts when measured FPS is below a threshold (rather than scoring badly).
"""

out = os.path.join(MODEL_DIR, "dynamic_robustness_report.md")
with open(out, "w") as f:
    f.write(report)
print(f"\nWrote {out}")
