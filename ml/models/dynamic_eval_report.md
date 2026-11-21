# Eval report — `dynamic_transformer_v2.onnx`

**Dataset:** synth (8 classes).
**Sequence:** T = 45 frames, feature_dim = 126.
**Model:** Transformer encoder · d_model=128 · 8 heads · 4 layers · 552,968 params.

## Headline

- **Held-out top-1 accuracy:** **1.000** *(NFR-9 target ≥ 0.65 — ✅ pass)*
- **Macro-F1:** **1.000** *(NFR-10 target ≥ 0.55 — ✅ pass)*
- **Model file size:** 2264.3 KB (2.21 MB)
- **Parameters:** 552,968



## Per-class

```
              precision    recall  f1-score   support

       HELLO      1.000     1.000     1.000        40
     GOODBYE      1.000     1.000     1.000        40
         YES      1.000     1.000     1.000        40
          NO      1.000     1.000     1.000        40
      PLEASE      1.000     1.000     1.000        40
      THANKS      1.000     1.000     1.000        40
       SORRY      1.000     1.000     1.000        40
        HELP      1.000     1.000     1.000        40

    accuracy                          1.000       320
   macro avg      1.000     1.000     1.000       320
weighted avg      1.000     1.000     1.000       320

```

## Files

- `dynamic_transformer_v2.onnx` — load via `onnxruntime-web` in the browser.
- `dynamic_labels_v2.json` — labels + model config.

## Notes

- The `embedding` output is exposed for the PersonalAdapter (W5).
- Temperature scaling (W6) should be applied post-export for calibration.
