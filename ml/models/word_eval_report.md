# Eval report — `word_transformer.onnx`

**Dataset:** synth (10 words)
**Sequence:** T = 60 frames, feature_dim = 126
**Model:** WordTransformer · d_model=128 · 8 heads · 4 layers · 555,146 params

## Headline

- **Top-1 accuracy:** 0.095
- **Top-5 accuracy:** 0.490
- **Macro-F1:** 0.059
- **Model size:** 2272.8 KB (2.22 MB)
- **Inference:** 3.9 ms / sample (259 FPS) on cpu

## Flagged Confusion Pairs (>10% off-diagonal)

| True | Predicted | Rate |
|---|---|---|
| YES | WANT | 45.0% |
| PLEASE | WANT | 40.0% |
| GOODBYE | WANT | 35.0% |
| NO | WANT | 35.0% |
| HELP | HELLO | 35.0% |
| HELP | WANT | 35.0% |
| NEED | WANT | 35.0% |
| HELLO | WANT | 30.0% |
| GOODBYE | HELLO | 30.0% |
| NO | HELLO | 30.0% |
| THANKS | WANT | 30.0% |
| WANT | HELLO | 30.0% |
| YES | SORRY | 25.0% |
| THANKS | HELLO | 25.0% |
| THANKS | NEED | 25.0% |
| SORRY | HELLO | 25.0% |
| SORRY | WANT | 25.0% |
| SORRY | NEED | 25.0% |
| HELLO | NEED | 20.0% |
| NO | NEED | 20.0% |


## Per-class

```
              precision    recall  f1-score   support

       HELLO      0.082     0.200     0.116        20
     GOODBYE      0.000     0.000     0.000        20
         YES      0.000     0.000     0.000        20
          NO      0.000     0.000     0.000        20
      PLEASE      0.167     0.050     0.077        20
      THANKS      0.000     0.000     0.000        20
       SORRY      0.080     0.100     0.089        20
        HELP      0.000     0.000     0.000        20
        WANT      0.127     0.450     0.198        20
        NEED      0.083     0.150     0.107        20

    accuracy                          0.095       200
   macro avg      0.054     0.095     0.059       200
weighted avg      0.054     0.095     0.059       200

```

## Files

- `word_transformer.onnx` — ONNX model for browser deployment
- `word_transformer_config.json` — model config
- `word_labels.json` — label names + metadata
