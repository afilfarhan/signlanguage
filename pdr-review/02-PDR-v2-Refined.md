# Product Design Requirement (PDR) v2
## Interactive Vision-Based Sign Language Learning Platform

**Status:** Draft for review
**Owner:** TBD
**Last updated:** v2 refinement
**Supersedes:** PDR v1

---

## 0. TL;DR

A browser-based, webcam-driven platform that teaches sign language through a "watch → sign → get feedback" loop. Inference runs **on-device** for privacy and latency. The MVP ships **one language end-to-end** (with a multi-language selector scaffolded for future variants), covers **fingerspelling + ~25 isolated signs**, and provides **split-screen practice with landmark-based real-time feedback**. Facial-expression (non-manual marker) scoring is a v2 feature behind a feature flag.

---

## 1. Background & Problem

Over 400 million people worldwide live with disabling hearing loss, and sign language is the primary language of millions in the Deaf community. Existing learning resources are dominated by passive video libraries; they cannot tell a learner *whether their sign was correct*. Sensor-glove approaches solve the feedback problem but are inaccessible to most learners. Recent advances in browser-side computer vision (MediaPipe Holistic, WebGL/WebGPU inference, Transformer-based isolated SLR) make a webcam-only, in-browser tutor feasible for the first time.

## 2. Goals & Non-Goals

### Goals (v1)
- G1. Let a hearing-aware learner reach **conversational fingerspelling fluency** in one chosen sign language.
- G2. Provide **instant, structured corrective feedback** for handshape, location, movement, and palm orientation.
- G3. Run **inference on-device** so no webcam frames leave the browser by default.
- G4. Be **WCAG 2.2 AA** conformant.
- G5. Be co-designed with **Deaf advisors and native signers**.

### Non-Goals (v1)
- N1. Real-time *translation* of continuous signing (research-grade problem; explicitly out of scope).
- N2. Voice-to-sign or text-to-sign avatar generation.
- N3. Native mobile apps (responsive web + PWA only).
- N4. Certification / accreditation.

---

## 3. Personas & Primary User Stories

### Personas
- **P1. "Hearing learner Hana"** — adult learner, no prior signing experience, wants to communicate with a Deaf colleague. Primary persona.
- **P2. "Family member Farid"** — parent of a Deaf child, motivated, irregular practice schedule.
- **P3. "Educator Eli"** — teaches an intro ASL class, wants to assign practice and see progress. (v2 persona.)

### User stories (MVP)
- **US-1** — As Hana, I can pick a sign language and start the first lesson within 60 seconds of landing on the site, without creating an account.
- **US-2** — As Hana, I can watch a native signer demonstrate a sign, then attempt it on my webcam and see whether I matched it.
- **US-3** — When my sign is wrong, I get a *specific* correction ("Your thumb should be tucked, not extended") rather than a binary fail.
- **US-4** — I can pause, replay the demo at 0.5×/0.75×/1×, and mirror the demo to match my camera view.
- **US-5** — I can practice without my video ever leaving my computer, and I can see a clear indicator that this is the case.
- **US-6** — I can return tomorrow and resume where I left off; the system surfaces signs I'm forgetting (spaced repetition).

---

## 4. Scope by Release

| Capability | MVP | v1 | v2 |
|---|---|---|---|
| Sign language coverage | 1 variant fully (recommend ASL) | + multi-language *selector* with 1 additional variant in beta | 3+ variants |
| Static fingerspelling (alphabet, digits) | ✅ | ✅ | ✅ |
| Isolated word lessons | 25 words | 200 words | 1,000+ words |
| Continuous sentence recognition | ❌ | ❌ (demo only) | ✅ (research preview) |
| Real-time handshape/location/movement/orientation feedback | ✅ | ✅ | ✅ |
| Non-manual marker (facial expression) feedback | ❌ | Behind feature flag, opt-in | ✅ |
| On-device inference | ✅ | ✅ | ✅ |
| Account / progress sync across devices | ❌ (local only) | ✅ optional | ✅ |
| Spaced repetition / mastery model | Basic | ✅ | ✅ + adaptive |
| Educator dashboard | ❌ | ❌ | ✅ |
| Offline / PWA | ❌ | ✅ | ✅ |

---

## 5. Functional Requirements

### 5.1 Onboarding & Camera Setup
- FR-1.1 First-run wizard: language selector → camera permission → lighting check → framing guide → handedness selector (left/right) → mirroring preference.
- FR-1.2 Detect insufficient lighting / off-frame hands and surface a non-blocking helper.
- FR-1.3 No account required to start a lesson.

### 5.2 Lesson Player
- FR-2.1 Each lesson item: **demo video** (native signer) + **objective** + **practice attempt** + **feedback** + **retry / next**.
- FR-2.2 Demo controls: play, pause, scrub, speed (0.5×, 0.75×, 1×), loop, mirror toggle, slow-motion replay of the user's last attempt side-by-side with the demo.
- FR-2.3 Multi-angle demo where available (front + 3/4 view).
- FR-2.4 Captions, written description, and a textual "how to form this sign" panel for every sign.

### 5.3 Recognition & Feedback
- FR-3.1 Continuous landmark extraction from webcam (hands, pose, face) at ≥15 FPS on a 2020-class laptop.
- FR-3.2 Sign classification with calibrated confidence; never label a sign "wrong" below a configured confidence threshold — instead show "didn't catch that, try again."
- FR-3.3 **Structured feedback taxonomy** for every attempt:
  - Handshape match (per-finger)
  - Location relative to body (forehead, chin, chest, neutral space)
  - Movement trajectory (direction, repetition count)
  - Palm orientation
  - (v2) Non-manual markers: brow raise/furrow, mouth shape, head tilt
- FR-3.4 Surface the *single most actionable* correction first; allow "see all feedback" expansion.
- FR-3.5 Confidence visualization: per-component traffic-light (✅ / ⚠️ / ❌) plus an aggregate score.

### 5.4 Progression & Practice
- FR-4.1 Curriculum is a DAG of skills; signs unlock when prerequisites are mastered.
- FR-4.2 Mastery = N successful attempts with calibrated confidence over M sessions; configurable per skill.
- FR-4.3 Daily review queue driven by spaced-repetition (SM-2 or FSRS).
- FR-4.4 "Free practice" mode without scoring for low-pressure exploration.

### 5.5 Accessibility (this is a feature, not a chore)
- FR-5.1 WCAG 2.2 AA conformance verified via automated + manual audit.
- FR-5.2 Captions and transcripts on every video.
- FR-5.3 Keyboard-only navigation for all flows.
- FR-5.4 Reduced-motion mode (no autoplay, no parallax).
- FR-5.5 High-contrast theme.
- FR-5.6 Camera mirroring toggle (default ON).
- FR-5.7 Left-handed mode flips both demos and recognition.

---

## 6. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Time-to-first-lesson | < 60 s from landing |
| NFR-2 | End-to-end feedback latency (attempt end → feedback shown) | < 300 ms p50, < 600 ms p95 |
| NFR-3 | Landmark-extraction frame rate | ≥ 15 FPS on 2020-class laptop, graceful degradation below |
| NFR-4 | Cold-start model load | < 4 s on broadband |
| NFR-5 | Browser support | Latest 2 of Chrome, Edge, Safari, Firefox |
| NFR-6 | No webcam frames or landmarks leave the device by default | Hard requirement |
| NFR-7 | Lighthouse Accessibility score | ≥ 95 |
| NFR-8 | Bundle size (initial) | ≤ 1.5 MB JS; models lazy-loaded |
| NFR-9 | Recognition top-1 accuracy on held-out signers | ≥ 85 % for fingerspelling, ≥ 80 % for isolated words (MVP target) |
| NFR-10 | Fairness gate | No skin-tone / handedness subgroup more than 5 pp below overall accuracy |

---

## 7. Technical Architecture

### 7.1 Client (browser)
- **Capture:** `getUserMedia` → `<video>` → offscreen canvas.
- **Landmarks:** MediaPipe Holistic (or equivalent) running via WebAssembly / WebGL / WebGPU. Outputs 21×2 hand landmarks (×2 hands), 33 pose landmarks, 468 face landmarks.
- **Recognition:**
  - *Static signs (fingerspelling):* per-frame MLP on hand landmarks with temporal smoothing.
  - *Dynamic isolated signs:* sliding-window Transformer or ST-GCN over landmark sequences (window ≈ 1.5–3 s).
  - *Continuous signing (v2 research preview):* CTC / encoder-decoder Transformer.
- **Runtime:** ONNX Runtime Web or TensorFlow.js, with WebGPU when available.
- **Feedback engine:** rule layer over landmark deltas (e.g., palm-normal vector, fingertip-to-wrist distances) producing the structured taxonomy in FR-3.3, combined with model confidence.

### 7.2 Server (minimal)
- Static content + signed CDN URLs for lesson videos.
- Optional account service (email-magic-link or OAuth) for progress sync.
- Anonymous, opt-in telemetry (no video, no landmarks — only event counters and aggregate accuracy).
- Optional consented "donate a clip" pipeline to grow the dataset.

### 7.3 Why not HMMs as the headline model
HMMs are reasonable as a comparative baseline and pedagogically informative, but landmark-based Transformers / ST-GCNs dominate modern SLR benchmarks (WLASL, AUTSL, MS-ASL) and are a better fit for browser inference because they operate on compact landmark sequences rather than raw pixels. We will keep an HMM baseline in the evaluation suite for transparency.

---

## 8. Data Strategy

### 8.1 Sources
- **Bootstrap datasets** (subject to license review): WLASL, MS-ASL, How2Sign, AUTSL, INCLUDE, KArSL.
- **In-house recording** with native signers, multiple skin tones, multiple lighting conditions, both handednesses, multiple camera heights/angles. Budget for at least one recording sprint before launch.
- **Consented user contributions** (post-launch, opt-in, with revocation).

### 8.2 Annotation
- Per-sign labels + per-component ground truth (handshape code, location code, movement primitive, orientation) so the structured-feedback layer can be evaluated, not just the top-1 label.

### 8.3 Evaluation
- Held-out **unseen signers** split (not random frames).
- **Fairness slices:** skin tone (Monk scale), handedness, age bracket, eyewear, lighting tier, camera angle.
- **Confusion matrix** published internally per release; regressions on any slice block release.

---

## 9. Privacy & Security

- Webcam frames and derived landmarks are processed in-browser and **never transmitted** in default mode. The UI shows a persistent "🔒 On-device" indicator while the camera is active.
- Cloud features (progress sync, clip donation) are strictly opt-in with granular consent.
- For minors: COPPA-compliant flow, parental consent gating, school/district FERPA addendum available.
- Threat model documented separately; covers permission fatigue, malicious extensions reading the video element, and prompt-injection via lesson content.
- Right to delete: one-click account+data deletion.

---

## 10. Accessibility & Inclusion

- WCAG 2.2 AA target with quarterly audits.
- Deaf cultural advisory board reviews curriculum, terminology, and UI copy before each major release.
- Native signers (paid, credited) for all demo videos.
- Inclusive imagery and signer diversity (skin tone, age, gender, body type, handedness).
- Plain-language UI copy; reading-level checked.

---

## 11. Success Metrics

### Activation
- % of new sessions that complete the camera setup wizard (target ≥ 80 %).
- % that complete the first lesson item (target ≥ 60 %).

### Learning efficacy
- Median time-to-first-correct sign (target < 5 min).
- D7 / D30 retention (target 25 % / 10 % at launch).
- Mastery growth: signs mastered per active week (target ≥ 5).

### Quality
- Recognition top-1 accuracy on held-out signers (NFR-9).
- Fairness gate (NFR-10).
- False-positive rate of "wrong sign" verdicts (target < 5 %, since these erode trust fastest).

### Trust
- Helpfulness rating on feedback ("Was this correction helpful?" thumbs) — target ≥ 75 % positive.

---

## 12. Roadmap (Indicative)

| Milestone | Duration | Exit criteria |
|---|---|---|
| **M0 — Discovery & advisory** | 4 wks | Deaf advisors onboarded; persona research; language choice locked; dataset/license decisions made. |
| **M1 — Technical spike** | 4 wks | End-to-end vertical slice: webcam → landmarks → 5-sign classifier → feedback panel, on-device, on 3 browsers. |
| **M2 — MVP build** | 10 wks | Fingerspelling + 25 signs, split-screen UI, structured feedback, accessibility audit passed. |
| **M3 — Closed beta** | 4 wks | 50 learners, instrumentation live, fairness evaluation passed, privacy review signed off. |
| **M4 — Public launch (v1)** | 4 wks | 200-sign curriculum, second-language selector in beta, marketing site, support flow. |
| **M5 — v2 features** | rolling | Non-manual marker scoring, educator dashboard, PWA/offline, continuous-sign research preview. |

---

## 13. Risks & Mitigations

(See `01-PDR-Review.md` §6 for full register.) Top three:

1. **Trust erosion from inaccurate corrections** → never label below confidence threshold; ship practice-without-scoring first; expose confidence.
2. **Privacy perception** → on-device by default; visible indicator; third-party privacy review before launch.
3. **Cultural / community pushback** → Deaf advisory board with veto on curriculum; paid native signer talent; transparency about model limitations.

---

## 14. Open Questions

- Primary monetization model? (B2C subscription, B2B school licensing, freemium, grant-funded?)
- Are minors a launch audience? (Affects compliance scope materially.)
- Which language ships first end-to-end? (Recommended: ASL, given dataset availability; final call belongs to advisors.)
- Build vs. buy for landmark extraction (MediaPipe Holistic vs. a custom WebGPU model)?
- Does the org have appetite for an open-source release of the recognition models? (Significant community-trust upside.)

---

## 15. Glossary

- **SLR** — Sign Language Recognition.
- **NMM** — Non-Manual Marker (facial expression, head movement, body posture carrying linguistic meaning).
- **Fingerspelling** — Spelling words letter-by-letter using the manual alphabet.
- **Handshape / Location / Movement / Orientation** — The four classical phonological parameters of a sign (Stokoe).
- **ST-GCN** — Spatio-Temporal Graph Convolutional Network.
- **CTC** — Connectionist Temporal Classification, used for sequence labeling without explicit alignment.
- **WCAG 2.2 AA** — Web Content Accessibility Guidelines, conformance level AA.
