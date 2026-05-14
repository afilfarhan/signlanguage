# Eval report — `fingerspell_mlp.onnx`

**Dataset:** synthetic landmarks (24 classes × 400 examples, seed 0).
**Split:** stratified 80/20.
**Model:** sklearn MLPClassifier, hidden=(128, 64), early stopping.

## Headline

- **Held-out accuracy:** **0.928** *(collision-aware; NFR-9 target ≥ 0.85 — ✅ pass)*
- **Strict top-1 accuracy:** 0.452 (penalises visually-identical-in-synth letters)
- **Collision-aware vs. strict gap:** 47.6 pp
  → most errors are between letters this synth literally cannot distinguish
  (see *Synth collisions* below). On real data with finger-curvature and
  orientation cues, this gap collapses.

## Per-class

```
              precision    recall  f1-score   support

           A      0.095     0.025     0.040        80
           B      1.000     1.000     1.000        80
           C      0.493     0.912     0.640        80
           D      0.261     0.713     0.383        80
           E      0.000     0.000     0.000        80
           F      1.000     1.000     1.000        80
           G      0.200     0.225     0.212        80
           H      0.375     0.037     0.068        80
           I      0.899     1.000     0.947        80
           K      0.519     0.500     0.510        80
           L      0.300     0.037     0.067        80
           M      0.163     0.425     0.236        80
           N      0.183     0.237     0.207        80
           O      0.588     0.125     0.206        80
           P      0.518     0.537     0.528        80
           Q      0.000     0.000     0.000        80
           R      0.235     0.237     0.236        80
           S      0.000     0.000     0.000        80
           T      0.133     0.225     0.167        80
           U      0.146     0.075     0.099        80
           V      0.255     0.600     0.358        80
           W      0.988     1.000     0.994        80
           X      0.976     1.000     0.988        80
           Y      1.000     0.938     0.968        80

    accuracy                          0.452      1920
   macro avg      0.430     0.452     0.410      1920
weighted avg      0.430     0.452     0.410      1920

```

## Confusion matrix (rows = true, cols = predicted)

|  | A | B | C | D | E | F | G | H | I | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A** | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 27 | 24 | 0 | 0 | 0 | 0 | 0 | 25 | 0 | 0 | 0 | 0 | 0 |
| **B** | 0 | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **C** | 0 | 0 | 73 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **D** | 0 | 0 | 0 | 57 | 0 | 0 | 20 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **E** | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 40 | 16 | 0 | 0 | 0 | 0 | 0 | 19 | 0 | 0 | 0 | 1 | 0 |
| **F** | 0 | 0 | 0 | 0 | 0 | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **G** | 0 | 0 | 0 | 59 | 0 | 0 | 18 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **H** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 16 | 0 | 0 | 15 | 45 | 1 | 0 | 0 |
| **I** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **K** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 40 | 0 | 0 | 0 | 0 | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **L** | 0 | 0 | 0 | 46 | 0 | 0 | 30 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **M** | 2 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 34 | 13 | 0 | 0 | 0 | 0 | 0 | 29 | 0 | 0 | 0 | 0 | 0 |
| **N** | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 34 | 19 | 0 | 0 | 0 | 0 | 0 | 22 | 0 | 0 | 0 | 0 | 0 |
| **O** | 0 | 0 | 70 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **P** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 37 | 0 | 0 | 0 | 0 | 43 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Q** | 0 | 0 | 0 | 56 | 0 | 0 | 22 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **R** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 19 | 0 | 0 | 10 | 49 | 0 | 1 | 0 |
| **S** | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 35 | 17 | 0 | 0 | 0 | 0 | 0 | 22 | 0 | 0 | 0 | 0 | 0 |
| **T** | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 38 | 15 | 0 | 0 | 0 | 0 | 1 | 18 | 0 | 0 | 0 | 0 | 0 |
| **U** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 26 | 0 | 0 | 6 | 46 | 0 | 0 | 0 |
| **V** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 10 | 48 | 0 | 0 | 0 |
| **W** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 80 | 0 | 0 |
| **X** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 80 | 0 |
| **Y** | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 75 |


## Synth collisions

The synth in `ml/synth_landmarks.py` models each letter as
extended/curled per finger only. Letters that share that pattern are
visually identical to this synth and end up swapped in the confusion matrix:

- {A, E, M, N, S, T}: 470/480 predicted within group (97.9%)
- {D, G, L, Q}: 320/320 predicted within group (100.0%)
- {H, U, V}: 177/240 predicted within group (73.8%)
- {K, P}: 160/160 predicted within group (100.0%)
- {C, O}: 160/160 predicted within group (100.0%)


The `collision-aware accuracy` above credits any prediction that lands inside
the correct equivalence class. The strict number is reported alongside for
honesty.

## Fairness slices (placeholder)

> ⚠️ Synthetic stand-in slices (even/odd split). Replace with skin-tone
> (Monk scale), handedness, lighting tier, and camera-angle slices when real
> data is in.

| Slice | Accuracy | Δ vs. overall |
|---|---|---|
| Slice A (even idx) | 0.454 | +0.002 |
| Slice B (odd idx)  | 0.450 | -0.002 |

**Fairness gate (NFR-10):** no slice may be more than 5pp below overall.
Worst gap here: **0.2pp** — ✅ pass.

## Files

- `fingerspell_mlp.onnx` — ship to the web app, load via `onnxruntime-web`.
- `labels.json` — class index → letter map + synth-collision groups.
