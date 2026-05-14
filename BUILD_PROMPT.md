# Build Prompt — SignTutor Website (from this repo)

Hand this entire file to a coding agent (Claude Code, Cursor agent, Codex,
Copilot Workspace, etc.) along with read access to the repository. The agent
should be able to ship a deployable website without further input.

---

## Role & objective

You are a senior full-stack engineer. Your job is to turn the prototype
artifacts in this repository into a **production-quality, deployable web
application** called **SignTutor** — a browser-based, vision-driven sign
language learning platform with on-device inference.

Treat the contents of `pdr-review/` as the product spec, the contents of
`prototype/` as a working but unpolished UX/architecture reference, and the
contents of `ml/` + `ci/` + `.github/workflows/` as the ML pipeline and
release gates that **must continue to pass** after your work.

Do **not** rewrite the ML pipeline, the ONNX models, or the CI gates. Your
job is to consume them, not replace them.

---

## What already exists (read these first)

| Path | What it is | How you use it |
|---|---|---|
| `pdr-review/02-PDR-v2-Refined.md` | The product requirements document. Source of truth for scope, NFRs, and success criteria. | Read end-to-end before writing code. Every feature you build should map to a requirement here. |
| `pdr-review/04-Epics-and-Stories.md` | Backlog with story-point estimates and Given/When/Then acceptance criteria. | Use as your sprint plan. Acceptance criteria here are testable. |
| `pdr-review/01-PDR-Review.md` + `03-PDR-summary.html` | PDR critique and one-page visual summary. | Skim. Useful context for "why" decisions were made. |
| `prototype/home.html` | Landing/index page that links the four flows. | Replace with a real landing page. Architecture is the reference. |
| `prototype/wizard.html` | Camera-setup wizard (4 steps). | Reimplement as production component. The lighting-meter logic and split-stream-reuse pattern are correct — preserve them. |
| `prototype/index.html` | Static-sign lesson player (24 ASL letters, ONNX MLP, per-finger panel). | The canonical reference for the static-sign UX. Architecture (MediaPipe → JS `normalize()` → ONNX → structured feedback + per-finger panel) is non-negotiable. |
| `prototype/dynamic.html` | Dynamic-sign lesson player (8 signs, ONNX Transformer, 45-frame sliding window). | Canonical reference for the dynamic-sign UX. |
| `prototype/educator.html` | v2 educator dashboard wireframe (do not ship in v1). | Build only behind a feature flag. |
| `prototype/models/*.onnx` + `*.json` | The trained models the browser loads. | Ship as-is. Do not retrain unless the CI gate forces it. |
| `ml/` | Data generators, training scripts, eval/robustness reports. | Do not modify. CI re-trains on every push. |
| `ci/check_nfr.py`, `ci/run_parity.mjs`, `.github/workflows/ml-gate.yml` | Release-gate enforcement. | Must keep passing. Extend if you add new ML artifacts. |
| `prototype/README.md` | Architecture notes, what-maps-to-what table. | Read; reuse the architecture table in your own README. |

---

## Tech stack

Pick one stack and stick to it. Recommended:

- **Frontend**: Next.js 14+ (App Router) + TypeScript + Tailwind CSS.
- **State / data**: React Server Components for static lesson content;
  client components for camera/inference; `localStorage` for progress and
  preferences (no auth in v1).
- **ML in the browser**:
  [`onnxruntime-web`](https://www.npmjs.com/package/onnxruntime-web) for both
  the static MLP and the dynamic Transformer; MediaPipe Hands for landmarks
  (CDN script, same versions as the prototype). Use the WASM execution
  provider; opt into WebGPU when available behind a feature flag.
- **Testing**: Vitest for unit tests (especially the JS `normalize()` function
  — keep the Node parity test in CI); Playwright for one happy-path E2E test
  per lesson player.
- **Deployment**: Vercel (or any static-asset host + serverless edge for the
  optional account/sync routes). Keep the ONNX files under `/public/models/`
  so they're served as static assets.

If you have a strong reason to pick a different stack, document it in
`docs/ADR-001-stack.md` with the trade-offs.

---

## Hard requirements (do not violate)

These come directly from the PDR; CI enforces the ML ones, you enforce the
rest in code review.

1. **On-device inference by default.** No webcam frames or hand landmarks may
   leave the device. The "🔒 On-device · no upload" badge must be visible
   while the camera is active. Network calls during practice are forbidden;
   add a `Content-Security-Policy` that blocks `connect-src` on lesson pages
   except for the model files and a strictly-allowlisted telemetry endpoint
   (events only, no payloads).
2. **No account required for the first lesson.** Time-to-first-lesson budget
   is < 60 s from landing (NFR-1).
3. **WCAG 2.2 AA.** Keyboard-only navigation, visible focus rings, ARIA on
   all interactive controls, captions/transcripts on every video, reduced-
   motion support, mirroring on by default. Lighthouse accessibility ≥ 95
   on every page (gate this in CI; fail the build below 95).
4. **Mirror the webcam by default.** Add a clearly labelled toggle.
5. **Left-handed mode** flips both the demo and the recognition. The flag
   already exists in `prototype/wizard.html`; wire it through.
6. **Confidence-gated verdict.** Never display "wrong" below the model's
   confidence threshold. Below threshold, show "didn't catch that, try
   again." This is FR-3.2 in the PDR and is implemented in both prototype
   players — preserve the behaviour.
7. **Per-finger panel** stays visible on the static-sign player. Its source of
   truth is the rule layer (`fingerStates()` + `PATTERNS`), not the MLP.
8. **JS↔Python feature parity test must keep passing.** The `normalize()`
   functions you write in TypeScript must produce features that match Python
   reference output to 1e-3. Re-use `prototype/models/parity_samples.json`;
   port `ci/run_parity.mjs` into your unit-test suite.
9. **CI release gates** in `.github/workflows/ml-gate.yml` must continue to
   run and pass. Add a parallel job for the frontend: typecheck, lint,
   Lighthouse a11y on a built preview, Playwright happy-path.

---

## Pages & routes to ship in v1

| Route | Source prototype | Notes |
|---|---|---|
| `/` | `home.html` | Marketing landing + "Start your first lesson" CTA. |
| `/setup` | `wizard.html` | 4-step wizard. Persist prefs to `localStorage` under `signtutor.prefs`. |
| `/learn/asl/fingerspelling/:letter` | `index.html` | One route per letter; the player itself is the same component, just with a different target. Listing page at `/learn/asl/fingerspelling`. |
| `/learn/asl/words/:slug` | `dynamic.html` | One route per word. Listing at `/learn/asl/words`. |
| `/practice` | (new) | Spaced-repetition review queue (FSRS). Pulls from a JSON curriculum file. |
| `/about`, `/privacy` | (new) | Static. The privacy page must reflect the on-device guarantee literally. |

Out of scope for v1 (build behind a feature flag if at all):
- `/educator/*` — wireframe only; do not ship.
- Continuous sentence recognition.
- Non-manual marker (facial expression) scoring.
- User accounts / cloud sync.

---

## Architectural decisions to preserve

These came out of working through the prototype and are non-obvious enough
that you would otherwise re-litigate them:

1. **Hybrid ML + rule classifier.** The MLP gives calibrated probabilities and
   discriminative top-K; the rule layer's per-finger states drive the
   actionable tip ("Try extending your thumb") and the per-finger panel.
   Even in ML mode, both run; the MLP cannot give finger-level
   interpretability on its own.
2. **Auto-fallback to rule mode.** If the ONNX model fails to load (CDN
   blocked, corrupted file, browser crash), the page must still be usable.
   Surface the fallback in the UI as a non-scary indicator.
3. **Collision-aware verdict.** With 24-letter synthetic training data, some
   letter pairs are visually identical (`A=E=M=N=S=T`, etc.). The verdict
   treats same-collision-group neighbours as `close`, not `miss`, with a
   friendly explanation. The `COLLISION_GROUPS` constant lives in
   `prototype/index.html`; mirror it in your code. When you swap to real
   data, leave the logic in place — it'll be a no-op but it's correct.
4. **Dynamic-sign feature pipeline anchors on the *first frame*.** Per-frame
   normalization destroys global trajectory (which is exactly what
   distinguishes HELLO from THANKS from PLEASE). See `ml/seq_features.py` and
   the JS port in `prototype/dynamic.html`. Do not change this without
   reading `ml/ROBUSTNESS_GATE_DEMO.md`.
5. **`--rotation-aug` is required at training time.** The dynamic Transformer
   fails the NFR-10 rotation gate without it. The CI workflow already passes
   the flag; do not remove it.
6. **Lesson-time lighting check stays on-device.** The wizard samples
   downscaled frames, computes mean luminance + std, and never uploads. Keep
   it that way.
7. **Latency HUD shows MediaPipe and classifier separately.** This is the
   developer's main debugging signal; preserve it (gate it behind a
   `?debug=1` query parameter if you want to hide it from end users).

---

## Acceptance criteria (run before declaring done)

Functional:
- `pnpm dev` (or equivalent) starts the app; visiting `/` and clicking the
  primary CTA reaches a working lesson within 60 s of cold start on a
  2020-class laptop.
- The static-sign player loads `fingerspell_mlp.onnx` from `/models/`,
  detects a hand, draws the skeleton, and shows top-5 + verdict + per-finger
  panel + actionable tip — all on-device.
- The dynamic-sign player records a 1.5-second clip, runs the Transformer,
  and shows top-5 + discriminative tip.
- The wizard's prefs (language, handedness, mirror) are honoured by both
  lesson players.
- Spaced-repetition review queue surfaces previously-attempted signs.

Non-functional:
- `pnpm test` passes — including the JS↔Python parity test on the canonical
  samples.
- `pnpm build` succeeds; `pnpm lint` and `pnpm typecheck` are clean.
- `pnpm test:e2e` Playwright happy-path passes for both lesson players.
- Lighthouse accessibility score ≥ 95 on `/`, `/setup`, and a representative
  lesson page; report committed to `lighthouse/`.
- `python3 ci/check_nfr.py` still exits 0 after your changes.
- The CSP on lesson pages forbids outbound `connect-src` except to the model
  files; verify with `curl -I` on the deployed page.

Deliverables:
- A working app deployed to a preview URL (Vercel preview is fine).
- `README.md` at the repo root with: setup, dev, test, deploy.
- `docs/ARCHITECTURE.md` summarising the stack and the eight architectural
  decisions above.
- All four pages (`/`, `/setup`, `/learn/...`, `/practice`) implemented.
- CI green on the new frontend jobs and the existing ML gates.

---

## Definition of done — checklist

- [ ] PDR scope coverage matches the v1 column in `pdr-review/02-PDR-v2-Refined.md` §4.
- [ ] All eight "Architectural decisions to preserve" are visibly implemented.
- [ ] All "Hard requirements" pass review (privacy banner, on-device CSP,
      keyboard-only nav, mirror default, etc.).
- [ ] Acceptance criteria above are met.
- [ ] CI is green on a clean run.
- [ ] Lighthouse a11y ≥ 95 on three representative pages.
- [ ] `docs/ADR-001-stack.md` exists if you deviated from the recommended stack.

---

## Stretch goals (only if all of the above is done and green)

1. PWA installability + offline practice (cache models + curriculum JSON via
   service worker).
2. Educator dashboard prototype behind a `/educator` feature flag.
3. WebGPU execution provider for `onnxruntime-web` on supported browsers,
   with WASM fallback (measure the latency win in the HUD).
4. Add J and Z (motion letters) to the dynamic-sign model and curriculum.
5. Replace synthetic data with a real public dataset (WLASL or MS-ASL); the
   CI gate already exists to catch regressions.

---

## Notes for the agent

- When in doubt, prefer **smaller, shippable increments** over a big rewrite.
- The prototype HTML files are intentionally single-file, no-build artifacts
  so they double as documentation. Read them top-to-bottom before
  re-architecting; the inline comments encode design rationale.
- Do not collapse the ML/rule hybrid in the static player into pure ML "for
  simplicity" — see Architectural Decision #1.
- Do not change the JS `normalize()` functions without re-running the parity
  test. Drift here is silent and corrupts every score the user sees.
- If you hit a real-world ML failure (slice fails the gate), follow the
  pattern in `ml/ROBUSTNESS_GATE_DEMO.md`: detect → diagnose → fix at
  training time only → re-measure → ship.

Good luck. Build something the Deaf community would want to use.
