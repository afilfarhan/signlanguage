# Build Prompt — SignTutor v2 (ML Extension)

Hand this entire file to a coding agent (Claude Code, Cursor, Codex, Copilot
Workspace, etc.) along with read access to the repository **and** the shipped
v1 in `signtutor/`. The agent should be able to ship the v2 ML extension
without further input.

---

## Context — what's already done (v1, shipped)

`signtutor/` contains the production v1 site. Verified state:

- `pnpm typecheck` — ✅ clean
- `pnpm test` — ✅ 24/24 (incl. JS↔Python parity gate)
- `pnpm build` — ✅ 42 static pages
- 8 architectural decisions preserved (hybrid ML+rule, auto-fallback,
  collision-aware verdict, first-frame trajectory anchor, on-device lighting
  check, debug latency HUD, JS↔Python feature contract, per-finger panel)
- Recognition models: 24-letter sklearn MLP (static, 72 KB) + 8-sign
  Transformer (dynamic, 360 KB), both trained on **synthetic data** and
  served via `onnxruntime-web`.

Your job in v2 is to make SignTutor **substantially more ML-based**: replace
synthesis with real data, add capability the synth couldn't model (motion
letters, facial-expression scoring, more signs, more languages), and tighten
the release gates as those capabilities ship. **None of v1's user-facing
invariants change.**

---

## v2 objectives (in priority order)

1. **Real data replaces synthetic data** for both static and dynamic
   recognition. Synthetic generators move from "training source" to "test
   fixture" only.
2. **Add J and Z** to the dynamic-sign player (currently absent — they're
   motion letters the static synth couldn't model).
3. **Scale dynamic vocabulary from 8 → 200 isolated signs** (PDR v1 milestone
   M4).
4. **Add non-manual marker (NMM) scoring** behind a feature flag — facial
   expression analysis for question vs. statement, negation, intensity (PDR
   §3, EPIC-14).
5. **On-device personalization (light fine-tuning)** so the model adapts to
   each user's hand size, lighting, and signing style — without uploading
   data.
6. **Confidence calibration** (temperature scaling or Platt) so the
   confidence-gated verdict is honest under real-data distribution shift.
7. **Multi-language scaffolding goes live**: ship BSL or ArSL (your choice
   based on dataset availability) as a beta tier alongside ASL.
8. **Continuous-sign research preview** (PDR EPIC-17) on a `/research` route
   behind an explicit "Research preview — accuracy disclaimer" interstitial.

Out of scope for v2:
- Cloud sync / accounts beyond what v1 has.
- Production educator dashboard (still wireframe-only).
- Avatar generation / text-to-sign.

---

## What already exists — read these first

| Path | What it is | How you use it |
|---|---|---|
| `pdr-review/02-PDR-v2-Refined.md` §4 (v2 column), §11, §12 (M5) | Source-of-truth scope for this phase. | Every workstream below maps to a row in §4's v2 column or to EPIC-14 / EPIC-16 / EPIC-17. |
| `pdr-review/04-Epics-and-Stories.md` EPIC-14, EPIC-16, EPIC-17 | NMM, PWA/offline, continuous-SLR backlogs. | Acceptance criteria are testable. |
| `signtutor/` | Shipped v1. | Extend in place. Do not fork. |
| `ml/synth_landmarks.py`, `ml/synth_sequences.py` | Synthetic data generators. | Demote: keep them as pytest fixtures, not training data. |
| `ml/train_export.py`, `ml/train_transformer.py` | v1 training scripts. | Refactor to swap data sources via a CLI flag (`--source synth|wlasl|msasl|in_house`). |
| `ml/eval_robustness.py`, `ml/ROBUSTNESS_GATE_DEMO.md` | Robustness sweep + the "detect → diagnose → fix → re-measure" pattern. | Mandatory reading before fixing any failing slice. |
| `ci/check_nfr.py`, `ci/run_parity.mjs`, `.github/workflows/ml-gate.yml` | v1 release gates. | Extend, don't replace. New artifacts get new gates. |

---

## Workstreams

Each workstream has its own owner (an agent, a person, whoever), can be
shipped independently behind a feature flag, and is gated by CI.

### W1 — Real data (foundation; everything else depends on this)

**Goal.** Replace synthetic with real, licensed data; keep CI gates green
through the transition.

**Tasks.**
1. Add `ml/data/` with one loader per dataset:
   - `wlasl.py` — Word-Level American Sign Language (2,000 classes) for
     dynamic signs.
   - `msasl.py` — Microsoft-ASL for dynamic signs (overlap with WLASL is
     fine; cross-dataset eval).
   - `asl_fingerspelling.py` — for static fingerspelling (e.g.
     ChicagoFSWild+, ASL Citizen, or in-house recordings).
   - `in_house.py` — placeholder loader for the future native-signer
     recording sprint (same interface; reads from a manifest JSON).
2. **Each loader must emit identical shapes** to the synth: `(N, 21, 3)` for
   static, `(N, 45, 21, 3)` for dynamic. No downstream code changes.
3. Run MediaPipe Hands offline to extract landmarks from videos; cache
   landmark tensors to `ml/data/cache/{dataset}/{split}.npz`. Cache is
   gitignored; CI rebuilds on first run and uploads as an artifact.
4. **Document the licence and consent provenance** for every dataset in
   `ml/data/LICENSES.md`. PR cannot merge without an entry per dataset
   actually used.
5. Add `--source` flag to both training scripts. Default flips to `wlasl` for
   dynamic and `chicagofs` for static.
6. Promote `synth_*.py` to `tests/fixtures/`; they remain the source for the
   parity test only.

**Gate updates.**
- NFR-9 (accuracy) thresholds adjust to **real-data targets**: static ≥ 0.80
  on held-out *signers* (not random frames); dynamic ≥ 0.65 on held-out
  signers (real WLASL is hard).
- NFR-10 (slice gate) adds **real demographic slices**: skin tone (Monk
  scale), handedness, age bracket, eyewear, lighting, camera angle. Each
  slice must be ≤ 5pp below `clean`.
- New gate: **train/test signer disjointness** must be verified — same person
  must not appear in both splits. Add a check in `ci/check_nfr.py`.

**Acceptance.**
- Both training scripts run with `--source wlasl` and `--source chicagofs`;
  CI publishes accuracy + per-slice tables.
- Synth path still works (`--source synth`) for fast iteration.
- `prototype/models/parity_samples.json` is regenerated from real data; the
  Node parity test still passes.

### W2 — J and Z motion letters

**Goal.** Add the two missing fingerspelling letters by routing them through
the dynamic Transformer instead of the static MLP.

**Tasks.**
1. Add J and Z classes to the dynamic curriculum (`signtutor/data/curriculum.ts`).
2. Add J and Z to the dynamic training script's class list; retrain.
3. In `StaticSignPlayer`, when the lesson target is J or Z, route to the
   dynamic player automatically (or render a smaller embedded version).
   Single seamless lesson sequence.
4. Surface "this letter requires motion" in the demo card UI.

**Gate updates.** Reuse W1 gates; add J/Z to the per-class accuracy floor (no
single class < 0.50 on real data).

**Acceptance.**
- The `/learn/asl/fingerspelling/J` and `/...//Z` routes work end-to-end with
  the Transformer.
- The fingerspelling lesson list shows J and Z without a "coming soon" label.

### W3 — Vocabulary scale-out (8 → 200 dynamic signs)

**Goal.** Cover the 200-sign curriculum from PDR M4 / S-19.

**Tasks.**
1. Pick the 200 signs from a Deaf-curated frequency list (curriculum lead
   should sign off; if you don't have one, pull the top 200 from ASL-LEX
   ranked by familiarity).
2. Train at scale on real data (W1 must be done). Bump the Transformer:
   `d_model=64 → 128`, `n_layers=2 → 4`, `n_heads=4 → 8`. Expect ONNX file
   to grow ~4× to ≈ 1.4 MB; that's still inside the v1 NFR-8 budget if you
   bump it from 1.5 MB to 2 MB (note in an ADR).
3. Add **per-class confusion analysis** to the eval report: any pair with
   off-diagonal mass > 10 % gets flagged for the curriculum team to consider
   visual disambiguation in the demo.
4. Add **calibrated rejection**: if no class clears 0.30 confidence,
   surface "didn't recognise — try again", not a low-confidence guess.

**Gate updates.**
- NFR-9 dynamic floor stays at 0.65 on held-out signers (it's a much harder
  task at 200 classes than 8).
- Add **macro-F1 ≥ 0.55** so a dominant class can't carry the metric.
- Latency budget tightens: P50 ≤ 250 ms, P95 ≤ 450 ms (was 300/600 in v1).

**Acceptance.**
- 200 signs are searchable in `/learn/asl/words` with categories
  (greetings, family, food, etc.).
- Confusion matrix published as an artifact every CI run.

### W4 — Non-manual marker (NMM) scoring

**Goal.** Score facial expression and head movement as part of the verdict,
behind a feature flag.

**Tasks.**
1. Replace MediaPipe Hands with **MediaPipe Holistic** (hands + pose + face)
   in the dynamic player. Holistic adds 468 face landmarks and 33 pose
   landmarks per frame; the existing JS sequence-normalization extends to
   them with the same first-frame-anchor pattern.
2. Train two small auxiliary heads on the existing Transformer encoder:
   - `nmm_brow` — brow raise / furrow / neutral.
   - `nmm_mouth` — mouthing / negation purse / open / closed.
   These are short MLPs over pooled face landmarks and are independent of
   the sign classifier.
3. Add a 5th component to the structured-feedback panel: **NMM**, with the
   same dot-and-text design as Handshape / Orientation / Location /
   Movement. Visible only when the feature flag is on AND a face is in frame.
4. Add a `/settings#advanced` toggle: "Score facial expression". Default off.
   When on, show a one-time consent modal explaining what's measured and
   that nothing is uploaded.

**Gate updates.**
- New report: `ml/models/nmm_eval_report.md`. NFR-9-style target: ≥ 0.70 on
  brow head movement, ≥ 0.65 on mouthing classes (these are noisy in
  real-world video; lower targets are honest).
- NFR-10 slice for **glasses on / off**, **mask on / off**.

**Acceptance.**
- Feature flag default-off; turning it on adds the NMM tile and runs without
  changing latency by more than 50 ms p50.
- Consent modal cannot be skipped via keyboard alone (forces explicit
  affirmation).

### W5 — On-device personalization

**Goal.** Each user's model adapts to their hand size, lighting, and style
**without** any data leaving the device.

**Approach.** Keep the trained ONNX backbone frozen; add a small per-user
**adapter** layer (low-rank linear layer over the encoder output) that's
trained in-browser on the user's last N successful attempts. State is
serialized to `localStorage`; deletable from `/settings#data`.

**Tasks.**
1. Export the ONNX backbone with a *named output* exposing the encoder
   pre-classifier embedding (one extra `output_names` line in the training
   script).
2. Add a JS class `PersonalAdapter` (TypeScript): tiny matmul + bias over
   the embedding, trained with SGD on (embedding, label) pairs collected
   from confirmed attempts. ~1 KB of state per user.
3. Background training step runs after each lesson item if the user
   confirmed a sign was correct ("Was this you signing X?" thumbs).
4. Surface the adaptation visibly: a "Personalized" badge appears once
   ≥ 20 confirmed attempts have been used; clicking it shows
   `confirmed_attempts`, `last_updated`, and a "Reset personalization"
   button.

**Gate updates.**
- Add a deterministic test: feed a fixed sequence of (embedding, label)
  pairs to `PersonalAdapter`, then assert top-1 on a held-out set improves
  by ≥ 5 pp vs. the unadapted baseline. Lives in `signtutor/lib/__tests__/`.
- **Privacy gate.** A test that intercepts `fetch` / `XHR` during a full
  practice session asserts that no request body contains landmark tensors,
  embeddings, or adapter weights.

**Acceptance.**
- Personalization is opt-in (default on, but with a one-line "What is this?"
  link).
- Reset works and is irreversible.
- Latency budget unchanged — adapter is < 10 µs / forward.

### W6 — Confidence calibration

**Goal.** When the verdict says 80 % confident, it should be right ~80 % of
the time. v1's softmax outputs are over-confident on real data.

**Tasks.**
1. After each retrain, fit **temperature scaling** on the validation set
   (one scalar `T`; learned by minimizing NLL on held-out logits).
2. Bake `T` into the ONNX export (multiply logits before softmax).
3. Add a **reliability diagram** to the eval report (10 confidence bins;
   plot accuracy in each bin; ECE — Expected Calibration Error).
4. Gate: ECE ≤ 0.05 (otherwise the confidence-gated verdict in v1 is a
   lie).

**Acceptance.**
- Reliability diagram is published as a CI artifact.
- The static and dynamic eval reports both include an "ECE" line.

### W7 — Multi-language goes live

**Goal.** Ship BSL or ArSL as a real second language, not a placeholder.

**Tasks.**
1. Pick the variant based on dataset availability (BSL: BSL Corpus,
   BSL-1K; ArSL: KArSL or ArSL21L).
2. Run the full W1 → W3 pipeline for the chosen variant.
3. Wire the wizard's language selector to gate the curriculum and model
   files. **Each language has its own ONNX bundle** loaded lazily on
   language switch.
4. Keep ASL the default; mark the new variant as "Beta" in the selector.

**Gate updates.** Per-language NFR-9 / NFR-10 reports. CI runs all variants
in parallel matrix jobs; any variant failing its gate fails its job, but
doesn't block ASL.

**Acceptance.**
- Switching language in the wizard re-routes lessons cleanly with no page
  reload.
- The language-switch action prefetches the new model bundle.

### W8 — Continuous-sign research preview

**Goal.** A clearly-labelled research surface for continuous (sentence-level)
recognition, so stakeholders can see where the tech is going without it
contaminating the v1 product trust budget.

**Tasks.**
1. New route `/research/continuous` behind an interstitial that explains:
   "This is a research preview. Accuracy is much lower than our trained
   isolated-sign recognition. Treat outputs as suggestions, not corrections."
   The user must click through.
2. Train a CTC encoder-decoder Transformer over landmark sequences (PDR
   §7.1, S-64). Use How2Sign or RWTH-PHOENIX as the source.
3. Stream predictions live; show a rolling decoded-text bar.
4. **No verdict, no scoring.** This surface intentionally does not say
   "right" or "wrong" — it just transcribes.

**Gate updates.** No NFR-9/10 gates (this is research). But add a **WER**
(Word Error Rate) line to the eval report and refuse to ship if WER > 0.50
on the held-out test set.

**Acceptance.**
- The disclaimer cannot be dismissed without reading it (3-second timer or
  scroll-to-end requirement, your call).
- The route is excluded from sitemap and `noindex,nofollow`.

---

## Hard requirements (preserved from v1, plus new)

These come from the v1 PDR and the lessons of this build. CI enforces what
it can; you enforce the rest in code review.

**Preserved from v1 (do not regress):**
1. **On-device inference by default.** Webcam frames + landmarks + embeddings
   + adapter weights never leave the device. The CSP test in W5 verifies
   embeddings don't leak; extend it to cover NMM features and continuous-
   sign decode buffers.
2. **No account required for the first lesson.**
3. **WCAG 2.2 AA**, Lighthouse a11y ≥ 95 on every page (including the new
   ones).
4. **Mirror webcam by default.**
5. **Confidence-gated verdict.** Now backed by ECE ≤ 0.05.
6. **Per-finger panel** stays sourced from the rule layer.
7. **JS↔Python feature parity test must keep passing**, extended to cover
   any new normalization functions you add (NMM, holistic).
8. **CI release gates** in `.github/workflows/ml-gate.yml` continue to pass.

**New for v2:**
9. **Train/test signer disjointness** is checked in CI. Same person in both
   splits = build fails.
10. **Licence + consent provenance** is documented for every dataset used.
    Build fails on a CI grep for any dataset path that isn't in
    `ml/data/LICENSES.md`.
11. **Calibration gate** (ECE ≤ 0.05) on every shipped classifier.
12. **Privacy gate** (the `fetch`/`XHR` interception test) blocks any
    landmark/embedding/adapter byte from leaving the device.
13. **Per-language gates** run independently; failure on one variant doesn't
    sink the others.

---

## New architectural decisions to make (and document)

Each decision goes into `signtutor/docs/ADR-NNN-*.md` before code lands.
Capture the trade-off, the chosen path, and the rejected alternatives.

- **ADR-002**: dataset choice and licence stance (W1).
- **ADR-003**: how to split signers across train / val / test, and how to
  audit it (W1).
- **ADR-004**: temperature scaling vs. Platt vs. isotonic for calibration (W6).
- **ADR-005**: encoder-embedding output format and personalization-adapter
  shape (W5).
- **ADR-006**: holistic vs. hands+face landmark fusion strategy for NMM (W4).
- **ADR-007**: CTC vs. Transformer-decoder for continuous SLR (W8).
- **ADR-008**: per-language model bundle layout and lazy-loading strategy (W7).

---

## Acceptance criteria (run before declaring done)

Functional:
- Every workstream's Acceptance section is met or explicitly deferred (with
  a follow-up issue link in the README).
- A first-time user can: complete the wizard → finish a fingerspelling
  lesson (now including J or Z) → finish an isolated-sign lesson from the
  expanded 200-sign vocabulary → see their personalized "trained on N of
  your attempts" badge after sufficient practice.

Non-functional:
- `pnpm test` and `pnpm test:e2e` pass; the new tests for personalization
  improvement, calibration ECE, signer disjointness, and CSP egress all pass.
- Lighthouse a11y ≥ 95 on every new route.
- `python3 ci/check_nfr.py` exits 0 on a clean run for ASL; per-language
  jobs report independently.
- All ADRs (002–008) exist and are referenced from `docs/ARCHITECTURE.md`.
- `ml/data/LICENSES.md` documents every dataset actually pulled.

Deliverables:
- v2 deployed to a preview URL with v1 still reachable for comparison
  (`/v1/...` or a separate preview).
- `docs/ARCHITECTURE.md` updated with the new ML pipeline diagram and
  pointers to ADR-002 through ADR-008.
- A short demo video (Loom, 3 min max) walking through the new capabilities,
  linked from the PR description.

---

## Definition of done — checklist

- [ ] All v1 hard requirements still pass (privacy banner, on-device CSP,
      keyboard-only nav, mirror default, parity, CI green).
- [ ] All 8 v1 architectural decisions still observably implemented.
- [ ] At least W1, W2, W3, and W6 are shipped (these are the highest-
      leverage and least risky).
- [ ] W4 (NMM), W5 (personalization), W7 (multi-language), W8 (continuous)
      shipped behind feature flags as targeted; or explicitly deferred with
      a tracking issue.
- [ ] All new gates (signer-disjoint, licence, ECE, privacy egress,
      per-language) wired into CI and proven to FAIL when they should
      (rehearse this — see `ml/ROBUSTNESS_GATE_DEMO.md` for the pattern).
- [ ] ADRs 002–008 written.
- [ ] No regression in v1 acceptance criteria.

---

## Notes for the agent

- **Real data is brutal.** Expect accuracy numbers to drop from "98 % on
  synth" to "65–80 % on held-out signers". Adjust thresholds *with* the
  data; don't lower a gate to make a model pass.
- **Resist the urge to delete the synth.** The synth fixtures are how you
  unit-test the pipeline without dataset access. Keep them.
- **The hybrid ML+rule classifier stays.** Even with NMM and personalization,
  the per-finger panel is rule-derived. The model gives probabilities; the
  rules give interpretability. Both ship.
- **Personalization is consent-by-default-ON only because nothing leaves the
  device.** If you ever propose syncing adapter weights to a server,
  re-litigate via a new ADR; do not just turn it on.
- **Calibration is non-optional.** A 90%-confident "wrong" verdict erodes
  trust faster than a 50%-confident one. ECE ≤ 0.05 is the gate that keeps
  the v1 confidence-gated-verdict promise honest.
- **Use the gate-flipping pattern from `ml/ROBUSTNESS_GATE_DEMO.md`** when a
  slice fails: detect → diagnose → fix at training time only → re-measure →
  ship. Do not chase metrics by leaking test set into augmentation.
- **Continuous SLR is a research preview, not a product feature.** The
  disclaimer is load-bearing; do not soften it.
- **Document licences before training.** Re-training is cheap. Untangling a
  dataset-licence breach after launch is not.

Good luck. Make SignTutor as accurate on real signers as v1 was on synth.
