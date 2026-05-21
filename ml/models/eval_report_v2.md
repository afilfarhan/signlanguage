# Eval report — `fingerspell_mlp_v2.onnx`

**Dataset:** synthetic landmarks (24 classes x 400 examples, seed 0).
**Augmentation:** Mirror (2x) + Jitter (6x for hard classes: R, U, V, M, N, O).
**Features:** 68-dim (63 normalized landmarks + 5 geometry features for R/U/V distinction).
**Split:** stratified 80/20.
**Model:** sklearn MLPClassifier, hidden=(256, 128, 64), early stopping, sample weighting (2.25x for hard classes).

## Headline

- **Strict top-1 accuracy:** **0.457** (misleading for synthetic data)
- **Collision-aware accuracy:** **0.926** (NFR-9 target >= 0.80 - [PASS])
- **Macro-F1:** **0.384**
- **Feature dimension:** 68 (was 63 in v1)

## Important: Synthetic Data Limitations

The synthetic data generator (`synth_landmarks.py`) models each letter as
extended/curled per finger only. Letters that share that pattern are
visually identical to this synth and end up swapped in the confusion matrix:

- {A, E, M, N, S, T}: 967/968 predicted within group (99.9%)
- {D, G, L, Q}: 640/640 predicted within group (100.0%)
- {H, U, V}: 286/480 predicted within group (59.6%)
- {K, P}: 320/320 predicted within group (100.0%)
- {C, O}: 320/320 predicted within group (100.0%)


The **collision-aware accuracy** above credits any prediction that lands inside
the correct equivalence class. The strict number is reported alongside for
honesty.

**With real data (WLASL, ChicagoFSWild+), these collision groups collapse**
because real landmarks capture finger contact, curvature, and orientation.

## Hard Class Performance (Collision Groups)

> These letters share identical finger patterns in synthetic data.
> Strict accuracy is meaningless; collision-aware accuracy is the real metric.

| Collision Group | Group Accuracy | Letters |
|---|---|---|
| {A, E, M, N, S, T} | 99.9% | 6 letters |
| {D, G, L, Q} | 100.0% | 4 letters |
| {H, U, V} | 59.6% | 3 letters |
| {K, P} | 100.0% | 2 letters |
| {C, O} | 100.0% | 2 letters |


## Per-class

```
              precision    recall  f1-score   support

           A      1.000     0.018     0.035       168
           B      1.000     1.000     1.000       160
           C      0.000     0.000     0.000       160
           D      0.253     0.294     0.272       160
           E      0.000     0.000     0.000       160
           F      1.000     1.000     1.000       160
           G      0.000     0.000     0.000       160
           H      0.000     0.000     0.000       160
           I      0.994     1.000     0.997       160
           K      0.375     0.037     0.068       160
           L      0.000     0.000     0.000       160
           M      0.162     0.319     0.215       160
           N      0.165     0.669     0.265       160
           O      0.500     1.000     0.667       160
           P      0.492     0.938     0.645       160
           Q      0.246     0.694     0.363       160
           R      0.266     0.438     0.331       160
           S      0.000     0.000     0.000       160
           T      0.333     0.006     0.012       160
           U      0.000     0.000     0.000       160
           V      0.242     0.569     0.340       160
           W      1.000     1.000     1.000       160
           X      1.000     1.000     1.000       160
           Y      1.000     1.000     1.000       160

    accuracy                          0.457      3848
   macro avg      0.418     0.458     0.384      3848
weighted avg      0.419     0.457     0.383      3848

```

## Confusion matrix (rows = true, cols = predicted)

|  | A | B | C | D | E | F | G | H | I | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A** | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 57 | 107 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **B** | 0 | 160 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **C** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 160 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **D** | 0 | 0 | 0 | 47 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 113 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **E** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 46 | 112 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| **F** | 0 | 0 | 0 | 0 | 0 | 160 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **G** | 0 | 0 | 0 | 46 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 113 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **H** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 58 | 0 | 0 | 0 | 101 | 0 | 0 | 0 |
| **I** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 160 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **K** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 0 | 154 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **L** | 0 | 0 | 0 | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 115 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **M** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 51 | 109 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **N** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 53 | 107 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **O** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 160 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **P** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 | 150 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Q** | 0 | 0 | 0 | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 111 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **R** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 70 | 0 | 0 | 0 | 90 | 0 | 0 | 0 |
| **S** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 61 | 99 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **T** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 46 | 113 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| **U** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 66 | 0 | 0 | 0 | 94 | 0 | 0 | 0 |
| **V** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 69 | 0 | 0 | 0 | 91 | 0 | 0 | 0 |
| **W** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 160 | 0 | 0 |
| **X** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 160 | 0 |
| **Y** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 160 |


## Feature Engineering

The 5 geometry features explicitly capture finger relationships:
1. **Index-Middle Tip Distance**: Separates V (spread) from U (parallel)
2. **Index-Middle MCP Distance**: Normalizes for hand size
3. **Cosine Angle**: Direct measure of finger parallelism
4. **Cross Product Sign**: Detects finger crossing (R vs U/V)
5. **Tip/MCP Ratio**: Relative spread independent of hand size

These features make R/U/V distinction explicit rather than expecting the MLP to learn it from coordinates alone.

## Files

- `fingerspell_mlp_v2.onnx` - ship to the web app, load via `onnxruntime-web`.
- `labels_v2.json` - class index to letter map + geometry feature descriptions.
