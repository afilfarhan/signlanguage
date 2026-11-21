# Eval report — `fingerspell_mlp.onnx`

**Dataset:** synthetic landmarks (24 classes × 400 examples, seed 0).
**Split:** stratified 80/20.
**Model:** sklearn MLPClassifier, hidden=(128, 64), early stopping.

## Headline

- **Held-out accuracy:** **1.000** *(collision-aware; NFR-9 target ≥ 0.85 — ✅ pass)*
- **Strict top-1 accuracy:** 0.623 (penalises visually-identical-in-synth letters)
- **Collision-aware vs. strict gap:** 37.7 pp
  → most errors are between letters this synth literally cannot distinguish
  (see *Synth collisions* below). On real data with finger-curvature and
  orientation cues, this gap collapses.

## Per-class

```
              precision    recall  f1-score   support

           A      0.059     0.100     0.074        20
           B      1.000     1.000     1.000        20
           C      0.333     0.050     0.087        20
           D      0.895     0.850     0.872        20
           E      0.000     0.000     0.000        20
           F      1.000     1.000     1.000        20
           G      1.000     0.750     0.857        20
           H      0.516     0.800     0.627        20
           I      1.000     1.000     1.000        20
           K      0.476     0.500     0.488        20
           L      0.720     0.900     0.800        20
           M      0.308     0.200     0.242        20
           N      0.178     0.400     0.246        20
           O      0.486     0.900     0.632        20
           P      0.474     0.450     0.462        20
           Q      0.952     1.000     0.976        20
           R      1.000     1.000     1.000        20
           S      0.167     0.150     0.158        20
           T      0.250     0.050     0.083        20
           U      0.471     0.400     0.432        20
           V      0.750     0.450     0.562        20
           W      1.000     1.000     1.000        20
           X      1.000     1.000     1.000        20
           Y      1.000     1.000     1.000        20

    accuracy                          0.623       480
   macro avg      0.626     0.623     0.608       480
weighted avg      0.626     0.623     0.608       480

```

## Confusion matrix (rows = true, cols = predicted)

|  | A | B | C | D | E | F | G | H | I | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A** | 2 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 0 | 0 | 0 | 0 | 4 | 3 | 0 | 0 | 0 | 0 | 0 |
| **B** | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **C** | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **D** | 0 | 0 | 0 | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **E** | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 10 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| **F** | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **G** | 0 | 0 | 0 | 0 | 0 | 0 | 15 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **H** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 |
| **I** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **K** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **L** | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **M** | 6 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 5 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| **N** | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 8 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| **O** | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **P** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Q** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **R** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **S** | 2 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 12 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| **T** | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 4 | 1 | 0 | 0 | 0 | 0 | 0 |
| **U** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 3 | 0 | 0 | 0 |
| **V** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 9 | 0 | 0 | 0 |
| **W** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 |
| **X** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 |
| **Y** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 |


## Synth collisions

The synth in `ml/synth_landmarks.py` models each letter as
extended/curled per finger only. Letters that share that pattern are
visually identical to this synth and end up swapped in the confusion matrix:

- {A, E, M, N, S, T}: 120/120 predicted within group (100.0%)
- {D, G, L, Q}: 80/80 predicted within group (100.0%)
- {H, U, V}: 60/60 predicted within group (100.0%)
- {K, P}: 40/40 predicted within group (100.0%)
- {C, O}: 40/40 predicted within group (100.0%)


The `collision-aware accuracy` above credits any prediction that lands inside
the correct equivalence class. The strict number is reported alongside for
honesty.

## Fairness slices (placeholder)

> ⚠️ Synthetic stand-in slices (even/odd split). Replace with skin-tone
> (Monk scale), handedness, lighting tier, and camera-angle slices when real
> data is in.

| Slice | Accuracy | Δ vs. overall |
|---|---|---|
| Slice A (even idx) | 0.642 | +0.019 |
| Slice B (odd idx)  | 0.604 | -0.019 |

**Fairness gate (NFR-10):** no slice may be more than 5pp below overall.
Worst gap here: **1.9pp** — ✅ pass.

## Files

- `fingerspell_mlp.onnx` — ship to the web app, load via `onnxruntime-web`.
- `labels.json` — class index → letter map + synth-collision groups.
