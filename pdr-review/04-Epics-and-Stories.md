# Epics & User Stories — Jira-Ready Backlog

Derived from PDR v2. Format is intentionally close to a Jira import shape so
this can be pasted into a tracker with minimal rework.

**Conventions**
- **Epic key:** `EPIC-##`, **Story key:** `S-##`, **Spike:** `SPK-##`, **Task:** `T-##`.
- Estimates use story points on a Fibonacci scale (1, 2, 3, 5, 8, 13).
- Acceptance criteria are written in **Given/When/Then** form.
- Every story names the PDR requirement(s) it satisfies.

---

## Release plan

| Release | Theme | Includes epics |
|---|---|---|
| **M1 — Spike** | Vertical slice proves the architecture works in a browser. | EPIC-01, EPIC-02 (subset), EPIC-09 (subset) |
| **M2 — MVP** | One language end-to-end: fingerspelling + 25 signs. | EPIC-01..06, EPIC-08, EPIC-09, EPIC-10 |
| **M3 — Closed beta** | Instrumentation, fairness eval, privacy review. | EPIC-07, EPIC-11, EPIC-12 |
| **M4 — v1 launch** | 200 signs, second-language preview, marketing site. | EPIC-04 (expansion), EPIC-13 |
| **M5 — v2** | NMM scoring, educator dashboard, PWA/offline, continuous research preview. | EPIC-14, EPIC-15, EPIC-16, EPIC-17 |

---

## EPIC-01 — Camera & on-device runtime
**Goal:** Reliable, private webcam capture and landmark extraction across target browsers.
**PDR refs:** §7.1, NFR-3, NFR-6.

### S-01 · Camera permission & setup wizard · 5 pts
**As** a first-time learner
**I want** a guided camera setup
**So that** my webcam is framed and lit well before my first attempt
**AC:**
- *Given* I land on the home page, *when* I click "Start lesson", *then* I see a 4-step wizard: language → camera permission → lighting check → framing guide.
- *Given* my room is too dark, *then* the wizard shows a non-blocking helper and lets me proceed anyway.
- *Given* I deny camera permission, *then* I see a clear recovery path with browser-specific instructions.

### S-02 · MediaPipe Hands landmark pipeline · 5 pts
**AC:**
- *Given* the camera is active, *when* a hand is in frame, *then* 21 landmarks are extracted at ≥15 FPS p50 on a 2020-class laptop.
- Per-frame inference latency is exposed in a developer HUD.

### S-03 · Browser support matrix · 3 pts
**AC:** Works on latest 2 of Chrome, Edge, Safari, Firefox; graceful fallback message on unsupported browsers.

### SPK-01 · WebGPU vs. WASM benchmark · 3 pts
Investigate landmark-extraction perf on WebGPU vs. WebGL vs. WASM across 5 reference devices; produce a recommendation memo.

---

## EPIC-02 — Recognition & structured feedback
**Goal:** Per-attempt verdict + actionable corrective feedback.
**PDR refs:** FR-3.1..3.5, NFR-9.

### S-04 · Static fingerspelling classifier (MVP, rule-based) · 5 pts
**AC:** ≥80 % top-1 on 5 letters in self-collected dev set; surfaces confidence; <50 ms per frame.

### S-05 · Static fingerspelling classifier (v1, learned MLP via ONNX) · 8 pts
**AC:** ≥85 % top-1 on held-out signers across full alphabet; loaded via `onnxruntime-web`.

### S-06 · Dynamic isolated-sign classifier (Transformer over landmark windows) · 13 pts
**AC:** ≥80 % top-1 on 25 signs across held-out signers; sliding window 45 frames.

### S-07 · Structured feedback taxonomy engine · 5 pts
**AC:** Every attempt produces 4 component scores (handshape, orientation, location, movement); v2 adds NMM.

### S-08 · Confidence-gated verdict · 3 pts
**AC:** *Given* model confidence < threshold, *then* UI says "didn't catch that, try again" — never "wrong".

### S-09 · Most-actionable single tip · 3 pts
**AC:** UI surfaces exactly one corrective tip per attempt, derived from the weakest component.

### SPK-02 · Calibration of confidence thresholds · 3 pts
Pick thresholds that hit < 5 % false-positive "wrong" rate on the dev set.

---

## EPIC-03 — Lesson player UI
**Goal:** The split-screen practice interface.
**PDR refs:** FR-2.1..2.4, §4 UI.

### S-10 · Split-screen layout · 3 pts
**AC:** Demo on left, webcam on right; responsive collapse to stacked on <980px.

### S-11 · Demo player controls · 5 pts
**AC:** play/pause, scrub, 0.5× / 0.75× / 1× speed, loop, mirror toggle, side-by-side slow-motion replay of last attempt.

### S-12 · Multi-angle demo support · 3 pts
**AC:** When >1 angle is available, learner can switch front ↔ ¾.

### S-13 · Per-sign description panel · 2 pts
**AC:** Every sign has a written "how to form this sign" panel + caption.

---

## EPIC-04 — Curriculum & content
**Goal:** The actual signs and the structure that teaches them.
**PDR refs:** §2, §4 progression.

### S-14 · Curriculum data model · 3 pts
**AC:** Skills form a DAG; prerequisites unlock children; serializable JSON schema.

### S-15 · Mastery model · 5 pts
**AC:** Mastery requires N successful attempts with calibrated confidence over M sessions; values configurable per skill.

### S-16 · Spaced-repetition review queue (FSRS) · 5 pts
**AC:** Daily review surfaces signs the learner is forgetting first.

### S-17 · "Free practice" unscored mode · 2 pts
**AC:** Learner can practice any sign with no scoring shown.

### S-18 · Native-signer recording sprint (alphabet + 25 signs) · 13 pts
Logistics + cost + production. *Owned by content lead, not engineering.*

### S-19 · Native-signer recording sprint (200 signs, v1) · 13 pts
Same as S-18 at scale.

---

## EPIC-05 — Multi-language scaffolding
**Goal:** Selector exists; one variant ships fully; second is preview.
**PDR refs:** §2.

### S-20 · Language selector with i18n · 3 pts
**AC:** Selector shows ASL / BSL / ArSL with per-variant availability badges.

### S-21 · Per-language curriculum loader · 3 pts
**AC:** Curriculum module is loaded by language code; missing language degrades to "preview" page.

---

## EPIC-06 — Accessibility (WCAG 2.2 AA)
**Goal:** A product *for* the Deaf/HoH community must be exemplary on a11y.
**PDR refs:** FR-5.1..5.7, NFR-7.

### S-22 · Keyboard-only navigation · 3 pts
### S-23 · Focus rings & ARIA labels audit · 3 pts
### S-24 · Captions & transcripts on every video · 5 pts
### S-25 · Reduced-motion mode · 2 pts
### S-26 · High-contrast theme · 2 pts
### S-27 · Mirroring toggle (default ON) · 2 pts
### S-28 · Left-handed mode (flips demo + recognition) · 5 pts
### S-29 · Lighthouse a11y score ≥ 95 (release gate) · 3 pts

---

## EPIC-07 — Privacy & security
**Goal:** Webcam data never leaves the device by default.
**PDR refs:** §9, NFR-6.

### S-30 · "🔒 On-device" persistent UI indicator · 1 pt
### S-31 · CSP that forbids outbound connections during practice · 3 pts
### S-32 · Threat-model document & 3rd-party privacy review · 5 pts
### S-33 · One-click account & data deletion · 3 pts
### S-34 · COPPA/FERPA-ready flow for minors · 8 pts (deferred to v1)

---

## EPIC-08 — Onboarding & frictionless first session
**Goal:** Time-to-first-lesson < 60 s.
**PDR refs:** NFR-1.

### S-35 · No-account-required first lesson · 2 pts
### S-36 · Progress autosave to localStorage · 2 pts
### S-37 · Optional account & cross-device sync · 5 pts (v1)

---

## EPIC-09 — Data & model evaluation
**Goal:** We can quantitatively trust what we ship.
**PDR refs:** §8, NFR-9, NFR-10.

### S-38 · Held-out-signer eval split · 3 pts
### S-39 · Per-class confusion-matrix dashboard · 3 pts
### S-40 · Fairness slices (skin tone, handedness, lighting, angle) · 5 pts
### S-41 · Fairness gate as release blocker · 2 pts
### SPK-03 · Dataset license review (WLASL, MS-ASL, How2Sign, AUTSL, INCLUDE, KArSL) · 5 pts

---

## EPIC-10 — Trust & verdict UX
**Goal:** Never lose user trust to false-positive "wrong" verdicts.

### S-42 · Verdict states (match / close / miss / no-read) with copy review · 2 pts
### S-43 · "Was this correction helpful?" thumbs · 2 pts
### S-44 · Per-attempt confidence visualization · 2 pts

---

## EPIC-11 — Telemetry & analytics
**Goal:** Privacy-respecting, opt-in usage data to improve curriculum.

### S-45 · Anonymous, opt-in event telemetry (no video, no landmarks) · 3 pts
### S-46 · Activation funnel dashboard · 3 pts
### S-47 · Learning-efficacy dashboard (mastery rate, D7/D30 retention) · 5 pts

---

## EPIC-12 — Closed beta
### S-48 · Recruit 50 learners (≥30 % from Deaf-adjacent communities) · 3 pts
### S-49 · In-app feedback widget · 2 pts
### S-50 · Beta exit-criteria report · 3 pts

---

## EPIC-13 — Marketing site & launch
### S-51 · Landing page (a11y-first) · 5 pts
### S-52 · Pricing & plans (if applicable) · 3 pts
### S-53 · Help center · 5 pts

---

## EPIC-14 — Non-manual marker (NMM) scoring (v2)
**PDR refs:** FR-3.3 (v2 row).

### S-54 · MediaPipe FaceMesh integration · 5 pts
### S-55 · Brow / mouth / head-tilt feature extractors · 5 pts
### S-56 · NMM rule layer for question vs. statement, negation · 8 pts
### S-57 · Opt-in feature flag for NMM scoring · 2 pts

---

## EPIC-15 — Educator dashboard (v2)
### S-58 · Class roster & invites · 5 pts
### S-59 · Assignment creation · 5 pts
### S-60 · Per-student progress view (privacy-respecting) · 5 pts

---

## EPIC-16 — PWA / offline (v2)
### S-61 · Service worker for static assets + curriculum · 5 pts
### S-62 · Cached model files for offline practice · 5 pts
### S-63 · Install prompt & home-screen icon · 2 pts

---

## EPIC-17 — Continuous SLR research preview (v2)
### S-64 · Encoder-decoder Transformer (CTC) over landmark sequences · 13 pts
### S-65 · "Research preview" UX with explicit accuracy disclaimer · 2 pts

---

## Cross-cutting tasks (every release)

| Key | Task | Pts |
|---|---|---|
| T-01 | Deaf advisory board review of curriculum & terminology | 5 |
| T-02 | Native-signer talent contracts with credit & royalties | 3 |
| T-03 | Quarterly WCAG 2.2 AA audit | 5 |
| T-04 | Quarterly fairness-eval report | 3 |
| T-05 | Privacy review at every release with material data-flow change | 3 |
| T-06 | Browser perf regression suite | 5 |

---

## Definition of Ready (per story)

- [ ] PDR requirement IDs cited
- [ ] Acceptance criteria in Given/When/Then form
- [ ] UX mock attached if user-facing
- [ ] Test plan (incl. fairness slices for ML stories) attached
- [ ] Estimate agreed by team

## Definition of Done (per story)

- [ ] Acceptance criteria pass on Chrome, Edge, Safari, Firefox (latest 2)
- [ ] Lighthouse a11y ≥ 95 on touched pages
- [ ] No new outbound network call during practice (verified by CSP report)
- [ ] Telemetry events documented and opt-in respected
- [ ] Release notes updated
