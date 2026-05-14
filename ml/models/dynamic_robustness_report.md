# Robustness report — `dynamic_signs_transformer.onnx`

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
| clean | 0.991 | +0.000 | ✅ |
| landmark_jitter | 0.956 | -0.034 | ✅ |
| dropped_frames | 0.991 | +0.000 | ✅ |
| missing_z | 0.991 | +0.000 | ✅ |
| rotated | 0.972 | -0.019 | ✅ |
| scale_shift | 0.991 | +0.000 | ✅ |

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
