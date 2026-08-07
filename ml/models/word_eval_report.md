# Eval report — `word_transformer.onnx`

**Dataset:** synth (100 words)
**Sequence:** T = 60 frames, feature_dim = 126
**Model:** WordTransformer · d_model=128 · 8 heads · 4 layers · 566,756 params

## Headline

- **Top-1 accuracy:** 0.026
- **Top-5 accuracy:** 0.121
- **Macro-F1:** 0.006
- **Model size:** 2318.2 KB (2.26 MB)
- **Inference:** 4.0 ms / sample (247 FPS) on cpu

## Flagged Confusion Pairs (>10% off-diagonal)

| True | Predicted | Rate |
|---|---|---|
| PAY | MUST | 65.0% |
| SLEEP | NOW | 60.0% |
| SAME | NOW | 60.0% |
| THANKS | NOW | 57.5% |
| LOVE | NOW | 57.5% |
| THINK | NOW | 57.5% |
| FAMILY | MUST | 57.5% |
| FOOD | MUST | 57.5% |
| BIG | MUST | 57.5% |
| COLD | MUST | 57.5% |
| HOW-MANY | NOW | 57.5% |
| DIFFERENT | MUST | 57.5% |
| SORRY | NOW | 55.0% |
| DRINK | MUST | 55.0% |
| BABY | ALL | 55.0% |
| ANGRY | MUST | 55.0% |
| HOT | MUST | 55.0% |
| EVERY | NOW | 55.0% |
| MUST | NOW | 55.0% |
| SHOULD | SMALL | 55.0% |


## Per-class

```
              precision    recall  f1-score   support

       HELLO      0.000     0.000     0.000        40
     GOODBYE      0.000     0.000     0.000        40
         YES      0.000     0.000     0.000        40
          NO      0.000     0.000     0.000        40
      PLEASE      0.000     0.000     0.000        40
      THANKS      0.000     0.000     0.000        40
       SORRY      0.000     0.000     0.000        40
        HELP      0.048     0.050     0.049        40
        WANT      0.000     0.000     0.000        40
        NEED      0.000     0.000     0.000        40
        LIKE      0.000     0.000     0.000        40
        LOVE      0.000     0.000     0.000        40
        KNOW      0.000     0.000     0.000        40
       THINK      0.000     0.000     0.000        40
        FEEL      0.000     0.000     0.000        40
         SEE      0.000     0.000     0.000        40
        HEAR      0.028     0.100     0.044        40
         SAY      0.000     0.000     0.000        40
        TELL      0.000     0.000     0.000        40
         ASK      0.000     0.000     0.000        40
        GIVE      0.000     0.000     0.000        40
        TAKE      0.000     0.000     0.000        40
        COME      0.000     0.000     0.000        40
          GO      0.000     0.000     0.000        40
         EAT      0.000     0.000     0.000        40
       DRINK      0.000     0.000     0.000        40
       SLEEP      0.000     0.000     0.000        40
        WORK      0.000     0.000     0.000        40
        PLAY      0.020     0.250     0.036        40
       LEARN      0.000     0.000     0.000        40
       TEACH      0.000     0.000     0.000        40
        READ      0.000     0.000     0.000        40
       WRITE      0.000     0.000     0.000        40
         BUY      0.000     0.000     0.000        40
         PAY      0.000     0.000     0.000        40
        OPEN      0.000     0.000     0.000        40
       CLOSE      0.000     0.000     0.000        40
        STOP      0.000     0.000     0.000        40
       START      0.000     0.000     0.000        40
        WAIT      0.000     0.000     0.000        40
      FRIEND      0.000     0.000     0.000        40
      FAMILY      0.000     0.000     0.000        40
      MOTHER      0.000     0.000     0.000        40
      FATHER      0.000     0.000     0.000        40
        BABY      0.000     0.000     0.000        40
        HOME      0.000     0.000     0.000        40
      SCHOOL      0.000     0.000     0.000        40
        FOOD      0.000     0.000     0.000        40
       WATER      0.000     0.000     0.000        40
        GOOD      0.000     0.000     0.000        40
         BAD      0.000     0.000     0.000        40
       HAPPY      0.000     0.000     0.000        40
         SAD      0.000     0.000     0.000        40
       ANGRY      0.000     0.000     0.000        40
      SCARED      0.000     0.000     0.000        40
         BIG      0.000     0.000     0.000        40
       SMALL      0.038     0.400     0.069        40
         NEW      0.000     0.000     0.000        40
         OLD      0.000     0.000     0.000        40
        FAST      0.000     0.000     0.000        40
        SLOW      0.000     0.000     0.000        40
         HOT      0.000     0.000     0.000        40
        COLD      0.000     0.000     0.000        40
         MAN      0.000     0.000     0.000        40
       WOMAN      0.000     0.000     0.000        40
         BOY      0.000     0.000     0.000        40
        GIRL      0.000     0.000     0.000        40
      PERSON      0.000     0.000     0.000        40
        NAME      0.000     0.000     0.000        40
        WHAT      0.000     0.000     0.000        40
       WHERE      0.000     0.000     0.000        40
        WHEN      0.000     0.000     0.000        40
         WHO      0.000     0.000     0.000        40
         HOW      0.000     0.000     0.000        40
         WHY      0.000     0.000     0.000        40
    HOW-MUCH      0.019     0.025     0.022        40
    HOW-MANY      0.000     0.000     0.000        40
        MORE      0.000     0.000     0.000        40
        LESS      0.000     0.000     0.000        40
         ALL      0.042     0.475     0.076        40
        NONE      0.182     0.050     0.078        40
       EVERY      0.000     0.000     0.000        40
        SAME      0.000     0.000     0.000        40
   DIFFERENT      0.000     0.000     0.000        40
       MAYBE      0.000     0.000     0.000        40
      ALWAYS      0.000     0.000     0.000        40
       NEVER      0.000     0.000     0.000        40
       TODAY      0.000     0.000     0.000        40
    TOMORROW      0.000     0.000     0.000        40
   YESTERDAY      0.000     0.000     0.000        40
         NOW      0.022     0.500     0.043        40
      BEFORE      0.048     0.025     0.033        40
       AFTER      0.000     0.000     0.000        40
        WITH      0.000     0.000     0.000        40
     WITHOUT      0.085     0.125     0.101        40
         CAN      0.000     0.000     0.000        40
      CANNOT      0.000     0.000     0.000        40
        MUST      0.020     0.450     0.039        40
      SHOULD      0.021     0.125     0.036        40
         TRY      0.000     0.000     0.000        40

    accuracy                          0.026      4000
   macro avg      0.006     0.026     0.006      4000
weighted avg      0.006     0.026     0.006      4000

```

## Files

- `word_transformer.onnx` — ONNX model for browser deployment
- `word_transformer_config.json` — model config
- `word_labels.json` — label names + metadata
