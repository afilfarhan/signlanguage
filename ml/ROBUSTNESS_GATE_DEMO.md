# Robustness gate demonstration — closing a real failure

This document captures a complete trip around the **NFR-10 robustness gate**
loop using only artifacts in this repo:

1. Detect a failure on a robustness slice.
2. Diagnose root cause.
3. Apply a targeted fix (data augmentation only at training time).
4. Re-measure and confirm the slice now passes.
5. Decide whether to ship the new model.

This is the workflow the PDR's NFR-9 / NFR-10 gates exist to enable. With
synthetic data the absolute numbers aren't meaningful, but the *shape* of the
loop is exactly what would run in CI on real data.

---

## Step 1 — Detect

Initial robustness sweep (snapshot in
`models/dynamic_robustness_report_BEFORE.md`):

| Slice | Accuracy | Δ vs. clean | Within ±5pp? |
|---|---|---|---|
| clean            | 1.000 | +0.000 | ✅ |
| landmark_jitter  | 0.963 | −0.037 | ✅ |
| dropped_frames   | 1.000 | +0.000 | ✅ |
| missing_z        | 1.000 | +0.000 | ✅ |
| **rotated**      | **0.906** | **−0.094** | **❌** |
| scale_shift      | 1.000 | +0.000 | ✅ |

**Verdict:** the **rotation** slice fails the gate by 4.4 percentage points.
The model has learned trajectories in a fixed frame of reference and breaks
when signers face the camera at an oblique angle.

## Step 2 — Diagnose

`synth_sequences.py` synthesizes each clip with a small
`rotation ~ N(0°, σ=12°)` jitter (≈ ±24° at 2σ). The robustness slice in
`eval_robustness.py` adds an *additional* `Uniform(±25°)` per clip. Together,
some test clips end up at ~50° rotation — well outside the training distribution.

This is a textbook OOD failure that augmentation can fix.

## Step 3 — Fix

We add a **training-time-only** rotation augmentation in `train_transformer.py`:

```python
parser.add_argument("--rotation-aug", action="store_true", ...)

if args.rotation_aug:
    X_raw_train_aug = np.stack([
        rotate_clip(c, rng_aug.uniform(-35, 35)) for c in X_raw_train
    ])
    X_raw_train = np.concatenate([X_raw_train, X_raw_train_aug])
    y_train     = np.concatenate([y_train, y_train])
```

Three properties to call out:

- **Test set untouched.** We split *before* augmentation so the held-out test
  set keeps its honest distribution. Without this discipline you can "fix" any
  failure by training on the test slice — that's not a fix, that's leakage.
- **Augmentation only on training data.** The model sees both clean and
  rotated copies of every training clip; the test set is unchanged.
- **Reproducible.** A fixed seed (`rng_aug = np.random.default_rng(7)`) so the
  CI run is deterministic.

Run it:

```
python3 ml/train_transformer.py --rotation-aug
python3 ml/eval_robustness.py
```

## Step 4 — Re-measure

After-fix sweep (snapshot in `models/dynamic_robustness_report_AFTER.md`):

| Slice | Accuracy | Δ vs. clean | Within ±5pp? |
|---|---|---|---|
| clean            | 0.991 | +0.000 | ✅ |
| landmark_jitter  | 0.956 | −0.034 | ✅ |
| dropped_frames   | 0.991 | +0.000 | ✅ |
| missing_z        | 0.991 | +0.000 | ✅ |
| **rotated**      | **0.972** | **−0.019** | **✅** |
| scale_shift      | 0.991 | +0.000 | ✅ |

**Headline change:** rotation slice: **0.906 → 0.972** (+6.6 pp, ❌ → ✅).
**Side effect:** clean slice slipped 1.000 → 0.991 — that's a normal
generalization tax for any augmentation; in this case far smaller than the
robustness gain. Net: ship.

## Step 5 — Decide

| Criterion | Before | After | Decision |
|---|---|---|---|
| All slices ≤ 5 pp below clean | ❌ rotation fails | ✅ all pass | **Ship after** |
| NFR-9 ≥ 0.80 | ✅ 1.000 | ✅ 0.991 | OK |
| Model size ≤ 1 MB | ✅ 360 KB | ✅ 360 KB | OK |
| Inference latency unchanged | ✅ | ✅ | OK |

The augmented model is now in `prototype/models/` and is what `dynamic.html`
serves.

---

## What this would look like in CI on real data

```yaml
# .github/workflows/ml-gate.yml (illustrative)
- run: python3 ml/train_transformer.py --rotation-aug
- run: python3 ml/eval_robustness.py
- name: Enforce robustness gate
  run: |
    python3 - <<'PY'
    import re, sys, pathlib
    txt = pathlib.Path('ml/models/dynamic_robustness_report.md').read_text()
    # Parse the table; fail if any slice has ❌
    if '❌' in txt:
        print('Robustness gate failed:')
        print(txt); sys.exit(1)
    print('Robustness gate passed.')
    PY
```

On real data the *fix* might be different (more diverse signer recordings,
better angle augmentation, an architectural change like adding rotational
positional encodings). The **process** is the same: gate detects, you fix,
gate re-checks, CI blocks the release until it's green.

---

## Files referenced

- `ml/synth_sequences.py` — sequence generator (unchanged in the fix; the
  augmentation lives in `train_transformer.py` so synthesis stays the same
  for both train and test).
- `ml/train_transformer.py` — adds `--rotation-aug` flag.
- `ml/eval_robustness.py` — runs the six-slice perturbation sweep.
- `ml/models/dynamic_robustness_report_BEFORE.md` — snapshot before the fix.
- `ml/models/dynamic_robustness_report_AFTER.md` — snapshot after the fix.
- `ml/models/dynamic_robustness_report.md` — current (= AFTER) report.
- `ml/models/dynamic_signs_transformer_BEFORE.onnx` — pre-fix model.
- `ml/models/dynamic_signs_transformer_AFTER.onnx` — post-fix model (also
  copied into `prototype/models/` and served by `dynamic.html`).
