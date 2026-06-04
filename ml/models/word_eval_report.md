# Eval report — `word_transformer.onnx`

**Dataset:** synth (100 words)
**Sequence:** T = 60 frames, feature_dim = 126
**Model:** WordTransformer · d_model=128 · 8 heads · 4 layers · 566,756 params

## Headline

- **Top-1 accuracy:** 0.215
- **Top-5 accuracy:** 0.999
- **Macro-F1:** 0.142
- **Model size:** 2318.2 KB (2.26 MB)
- **Inference:** 5.0 ms / sample (201 FPS) on cpu

## Flagged Confusion Pairs (>10% off-diagonal)

| True | Predicted | Rate |
|---|---|---|
| EAT | GIRL | 100.0% |
| TELL | EVERY | 97.5% |
| WAIT | EVERY | 97.5% |
| HOME | GIRL | 97.5% |
| SLOW | EVERY | 97.5% |
| SAME | ASK | 97.5% |
| SHOULD | OPEN | 97.5% |
| NO | GIRL | 95.0% |
| FEEL | OPEN | 95.0% |
| FRIEND | ASK | 95.0% |
| ANGRY | WHY | 95.0% |
| TODAY | GIRL | 95.0% |
| LOVE | WHY | 92.5% |
| SLEEP | FOOD | 92.5% |
| WRITE | WHY | 92.5% |
| SAD | READ | 92.5% |
| SMALL | OPEN | 90.0% |
| HOT | ASK | 90.0% |
| MORE | OPEN | 90.0% |
| CAN | WHY | 87.5% |


## Per-class

```
              precision    recall  f1-score   support

       HELLO      0.217     0.375     0.275        40
     GOODBYE      0.273     0.525     0.359        40
         YES      0.165     0.350     0.224        40
          NO      0.000     0.000     0.000        40
      PLEASE      0.224     0.475     0.304        40
      THANKS      0.000     0.000     0.000        40
       SORRY      0.178     0.525     0.266        40
        HELP      0.000     0.000     0.000        40
        WANT      0.000     0.000     0.000        40
        NEED      0.300     0.150     0.200        40
        LIKE      0.000     0.000     0.000        40
        LOVE      0.000     0.000     0.000        40
        KNOW      0.000     0.000     0.000        40
       THINK      0.000     0.000     0.000        40
        FEEL      0.000     0.000     0.000        40
         SEE      0.155     0.275     0.198        40
        HEAR      0.286     0.550     0.376        40
         SAY      0.263     0.250     0.256        40
        TELL      0.250     0.025     0.045        40
         ASK      0.247     0.925     0.389        40
        GIVE      0.216     0.400     0.281        40
        TAKE      0.000     0.000     0.000        40
        COME      0.400     0.050     0.089        40
          GO      0.129     0.100     0.113        40
         EAT      0.000     0.000     0.000        40
       DRINK      0.000     0.000     0.000        40
       SLEEP      0.000     0.000     0.000        40
        WORK      0.257     0.225     0.240        40
        PLAY      0.267     0.100     0.145        40
       LEARN      0.000     0.000     0.000        40
       TEACH      0.217     0.450     0.293        40
        READ      0.198     0.800     0.317        40
       WRITE      0.222     0.050     0.082        40
         BUY      0.178     0.400     0.246        40
         PAY      0.273     0.150     0.194        40
        OPEN      0.199     0.925     0.327        40
       CLOSE      0.286     0.100     0.148        40
        STOP      0.312     0.500     0.385        40
       START      0.173     0.225     0.196        40
        WAIT      0.000     0.000     0.000        40
      FRIEND      0.500     0.025     0.048        40
      FAMILY      0.000     0.000     0.000        40
      MOTHER      0.000     0.000     0.000        40
      FATHER      0.224     0.600     0.327        40
        BABY      0.000     0.000     0.000        40
        HOME      0.000     0.000     0.000        40
      SCHOOL      0.203     0.325     0.250        40
        FOOD      0.205     0.825     0.328        40
       WATER      0.400     0.050     0.089        40
        GOOD      0.233     0.250     0.241        40
         BAD      0.231     0.150     0.182        40
       HAPPY      0.000     0.000     0.000        40
         SAD      0.143     0.025     0.043        40
       ANGRY      0.000     0.000     0.000        40
      SCARED      0.500     0.025     0.048        40
         BIG      0.176     0.400     0.244        40
       SMALL      0.000     0.000     0.000        40
         NEW      0.000     0.000     0.000        40
         OLD      0.000     0.000     0.000        40
        FAST      0.214     0.375     0.273        40
        SLOW      0.000     0.000     0.000        40
         HOT      0.667     0.050     0.093        40
        COLD      0.000     0.000     0.000        40
         MAN      0.231     0.375     0.286        40
       WOMAN      0.273     0.075     0.118        40
         BOY      0.214     0.450     0.290        40
        GIRL      0.201     0.975     0.333        40
      PERSON      0.250     0.125     0.167        40
        NAME      0.273     0.075     0.118        40
        WHAT      0.000     0.000     0.000        40
       WHERE      0.000     0.000     0.000        40
        WHEN      0.206     0.825     0.330        40
         WHO      0.294     0.125     0.175        40
         HOW      0.000     0.000     0.000        40
         WHY      0.201     0.925     0.330        40
    HOW-MUCH      0.212     0.550     0.306        40
    HOW-MANY      0.169     0.350     0.228        40
        MORE      0.286     0.100     0.148        40
        LESS      0.267     0.100     0.145        40
         ALL      0.278     0.125     0.172        40
        NONE      0.000     0.000     0.000        40
       EVERY      0.250     0.975     0.398        40
        SAME      0.200     0.025     0.044        40
   DIFFERENT      0.246     0.425     0.312        40
       MAYBE      0.267     0.400     0.320        40
      ALWAYS      0.000     0.000     0.000        40
       NEVER      0.000     0.000     0.000        40
       TODAY      0.200     0.025     0.044        40
    TOMORROW      0.200     0.150     0.171        40
   YESTERDAY      0.296     0.200     0.239        40
         NOW      0.225     0.225     0.225        40
      BEFORE      0.225     0.800     0.352        40
       AFTER      0.286     0.100     0.148        40
        WITH      0.177     0.350     0.235        40
     WITHOUT      0.167     0.125     0.143        40
         CAN      0.000     0.000     0.000        40
      CANNOT      0.000     0.000     0.000        40
        MUST      0.000     0.000     0.000        40
      SHOULD      0.000     0.000     0.000        40
         TRY      0.230     0.575     0.329        40

    accuracy                          0.215      4000
   macro avg      0.159     0.215     0.142      4000
weighted avg      0.159     0.215     0.142      4000

```

## Files

- `word_transformer.onnx` — ONNX model for browser deployment
- `word_transformer_config.json` — model config
- `word_labels.json` — label names + metadata
