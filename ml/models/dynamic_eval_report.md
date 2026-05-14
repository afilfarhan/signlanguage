# Eval report — `dynamic_signs_transformer.onnx`

**Dataset:** synthetic landmark sequences (8 classes × 200 examples, seed 0).
**Sequence:** T = 45 frames (~1.5 s @ 30 FPS), feature_dim = 126
(63 normalized positions + 63 frame-to-frame velocities).
**Split:** stratified 80/20.
**Model:** Transformer encoder · d_model=64 · 4 heads · 2 layers · 78,600 params · CPU-trained.

## Headline

- **Held-out top-1 accuracy:** **0.991** *(NFR-9 target ≥ 0.80 — ✅ pass)*
- **PyTorch ↔ ONNX prediction parity:** 1.000
- **Model file size:** 359.5 KB

## Per-class

```
              precision    recall  f1-score   support

       HELLO      0.974     0.950     0.962        40
     GOODBYE      1.000     1.000     1.000        40
         YES      1.000     1.000     1.000        40
          NO      1.000     1.000     1.000        40
      PLEASE      1.000     1.000     1.000        40
      THANKS      0.951     0.975     0.963        40
       SORRY      1.000     1.000     1.000        40
        HELP      1.000     1.000     1.000        40

    accuracy                          0.991       320
   macro avg      0.991     0.991     0.991       320
weighted avg      0.991     0.991     0.991       320

```

## Confusion matrix (rows = true, cols = predicted)

|  | HELLO | GOODBYE | YES | NO | PLEASE | THANKS | SORRY | HELP |
|---|---|---|---|---|---|---|---|---|
| **HELLO** | 38 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| **GOODBYE** | 0 | 40 | 0 | 0 | 0 | 0 | 0 | 0 |
| **YES** | 0 | 0 | 40 | 0 | 0 | 0 | 0 | 0 |
| **NO** | 0 | 0 | 0 | 40 | 0 | 0 | 0 | 0 |
| **PLEASE** | 0 | 0 | 0 | 0 | 40 | 0 | 0 | 0 |
| **THANKS** | 1 | 0 | 0 | 0 | 0 | 39 | 0 | 0 |
| **SORRY** | 0 | 0 | 0 | 0 | 0 | 0 | 40 | 0 |
| **HELP** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 40 |

## Fairness slices (placeholder)

> ⚠️ Synthetic stand-in slices (even/odd index) — this exists only to wire up
> the NFR-10 fairness-gate plumbing. Replace with skin-tone (Monk scale),
> handedness, lighting tier, and camera-angle slices when real data is in.

| Slice | Accuracy | Δ vs. overall |
|---|---|---|
| Slice A (even idx) | 0.981 | -0.009 |
| Slice B (odd idx)  | 1.000 | +0.009 |

**Fairness gate (NFR-10):** no slice may be more than 5pp below overall.
Worst gap here: **0.9pp** — ✅ pass.

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
  const {logits} = await session.run({ input: inputTensor });
  const argmax = logits.data.indexOf(Math.max(...logits.data));
  // -> labels[argmax]
</script>
```
