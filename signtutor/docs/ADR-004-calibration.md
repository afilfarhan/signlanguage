# ADR-004: Calibration Method — Temperature Scaling vs. Platt vs. Isotonic Regression

## Status
Accepted (W6 — Confidence Calibration)

## Context
v1 softmax outputs are over-confident on real data. We need well-calibrated confidence scores so the app can trust low-confidence thresholds ("Didn't catch that — try again").

## Decision
Use **temperature scaling** on the validation set after every training run.
- Fit scalar T on validation logits via LBFGS to minimize NLL.
- Bake T into the ONNX graph as a `Div` node before the final softmax.
- Gate: **ECE ≤ 0.05** on the held-out test set.
- Publish a reliability diagram (10-bin accuracy vs. confidence) as a CI artifact.

## Rejected Alternatives
- Platt scaling (single logistic): only calibrates the final decision boundary, not per-class confidence distributions.
- Isotonic regression: overfits small val sets and is harder to embed into an ONNX graph.

## Consequences
- Training scripts must include a calibration step; it runs after training, before ONNX export.
- CI must compute ECE on every retrain and fail if ECE > 0.05.
- Adds ~1 parameter per model (T), trivial runtime cost.
