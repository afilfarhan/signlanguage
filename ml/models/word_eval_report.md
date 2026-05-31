# Eval report — `word_transformer.onnx`

**Dataset:** synth (20 words)
**Sequence:** T = 60 frames, feature_dim = 126
**Model:** WordTransformer · d_model=128 · 8 heads · 4 layers · 556,436 params

## Headline

- **Top-1 accuracy:** 0.055
- **Top-5 accuracy:** 0.245
- **Macro-F1:** 0.010
- **Model size:** 2277.9 KB (2.22 MB)
- **Inference:** 3.8 ms / sample (263 FPS) on cpu

## Flagged Confusion Pairs (>10% off-diagonal)

| True | Predicted | Rate |
|---|---|---|
| PLEASE | ASK | 80.0% |
| HEAR | ASK | 80.0% |
| SORRY | ASK | 70.0% |
| NEED | ASK | 70.0% |
| KNOW | ASK | 70.0% |
| HELLO | WANT | 60.0% |
| GOODBYE | ASK | 60.0% |
| YES | WANT | 60.0% |
| NO | ASK | 60.0% |
| THANKS | WANT | 60.0% |
| HELP | WANT | 60.0% |
| LIKE | ASK | 60.0% |
| LOVE | WANT | 60.0% |
| THINK | ASK | 60.0% |
| FEEL | WANT | 60.0% |
| TELL | ASK | 60.0% |
| SEE | WANT | 50.0% |
| SAY | WANT | 50.0% |
| SAY | ASK | 50.0% |
| GOODBYE | WANT | 40.0% |


## Per-class

```
              precision    recall  f1-score   support

       HELLO      0.000     0.000     0.000        10
     GOODBYE      0.000     0.000     0.000        10
         YES      0.000     0.000     0.000        10
          NO      0.000     0.000     0.000        10
      PLEASE      0.000     0.000     0.000        10
      THANKS      0.000     0.000     0.000        10
       SORRY      0.000     0.000     0.000        10
        HELP      0.000     0.000     0.000        10
        WANT      0.060     0.500     0.106        10
        NEED      0.000     0.000     0.000        10
        LIKE      0.000     0.000     0.000        10
        LOVE      0.000     0.000     0.000        10
        KNOW      0.000     0.000     0.000        10
       THINK      0.000     0.000     0.000        10
        FEEL      0.000     0.000     0.000        10
         SEE      0.000     0.000     0.000        10
        HEAR      0.000     0.000     0.000        10
         SAY      0.000     0.000     0.000        10
        TELL      0.000     0.000     0.000        10
         ASK      0.056     0.600     0.102        10

    accuracy                          0.055       200
   macro avg      0.006     0.055     0.010       200
weighted avg      0.006     0.055     0.010       200

```

## Files

- `word_transformer.onnx` — ONNX model for browser deployment
- `word_transformer_config.json` — model config
- `word_labels.json` — label names + metadata
