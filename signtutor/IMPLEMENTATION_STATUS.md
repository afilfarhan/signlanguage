# SignTutor v2 — Implementation Status

## ✅ Completed (Core Fixes)

### 1. Webcam Start Button Now Works
**Problem**: The start button had no function because external MediaPipe/ONNX scripts were never loaded.
**Solution**: Created `src/lib/loadExternals.ts` with:
- `loadMediaPipe()` — loads MediaPipe Holistic + drawing_utils + camera_utils from CDN
- `loadONNX()` — dynamically imports onnxruntime-web

Both `fingerspelling/[letter]/page.tsx` and `words/[slug]/page.tsx` now call these loaders on startup.

### 2. MediaPipe Holistic Integration
- Replaced bare `MediaPipe Hands` with `MediaPipe Holistic` in both active lesson pages
- Captures hands + face + pose simultaneously in a single inference pass
- Enables face landmarks for NMM (Non-Manual Marker) scoring

### 3. Calibration & Personalization
- `CalibrationLayer` class applies temperature scaling to model logits (`src/lib/calibration.ts`)
- Calibration temperature loaded from `/models/calibration.json` on model load
- `PersonalAdapter` can be loaded from `localStorage` when the user has ≥20 confirmed attempts
- Personalized badge appears on the UI when adapter is active

### 4. Structured Feedback Panel
- **Handshape** — probability of current letter/sign
- **Orientation** — palm direction check
- **Location** — hand position in signing space
- **Movement** — stability of the sign
- **Expression** — shown when face is detected and NMM is enabled

### 5. Privacy/Fetch Interceptor
- `src/lib/privacyGate.ts` intercepts `fetch()` and `XMLHttpRequest`
- Blocks outgoing requests containing landmark, embedding, or adapter-weight patterns
- Installed via `PrivacyGateWrapper` component in app layout
- Prevents accidental data leakage during practice sessions

### 6. TypeScript & Tests
- `npm run typecheck` — ✅ passes
- `npm test` — ✅ 31/31 tests pass

---

## ⏳ Remaining Work (per BUILD_PROMPT_ML_EXTENSION.md)

### W1 — Real Data Foundation
- Python training scripts need to be run with `--source wlasl` and `--source chicagofs`
- Signer-disjoint split checks not wired into CI
- License audit script not integrated into build

### W2 — J and Z Motion Letters
- `runDynamicModel()` in `fingerspelling/[letter]/page.tsx` is a placeholder returning `null`
- Needs the dynamic Transformer inference pipeline (`normalizeSequence` + 45-frame buffer → ONNX)

### W3 — 200 Dynamic Signs
- `/learn/asl/words` page UI exists with category filters
- Vocabulary data (`vocabulary_200.ts`) has 36 representative entries (truncated; full 200 needed)
- Transformer model path referenced but actual `.onnx` file needs to be trained/available

### W4 — NMM Scoring (behind `NMM_SCORING` flag)
- Basic face landmark detection works
- Dedicated MLP heads for brow/mouth classification not implemented
- NMM feedback messages (yes/no, wh, negation) are hardcoded placeholders

### W5 — On-Device Personalization
- Adapter loads when ≥20 attempts exist, but the confirmation UI ("Was this you signing X?") is not yet built
- Background `adapter.update()` is not triggered after practice

### W6 — Confidence Calibration
- Calibration layer loads temperature but the trained models need to expose it correctly
- Reliability diagram component exists (`ReliabilityDiagram.tsx`) but not yet shown in lessons

### W7 — Multi-Language Beta
- Language bundles (`language-bundles.ts`) defined for ASL/BSL/ArSL
- Lazy-loading and beta disclaimer not yet wired

### W8 — Continuous-Sign Research Preview
- Route `/research/continuous` exists with interstitial
- No actual continuous recognition model running yet

---

## 🔒 CI Gates (Hard Requirements)
- [ ] Signer-disjoint check wired and proven to FAIL when a signer appears in both splits
- [ ] License grep gate wired and proven to FAIL when a dataset path lacks a `LICENSES.md` entry
- [ ] ECE gate proven to FAIL on uncalibrated logits
- [ ] Privacy egress gate proven to FAIL when a network call contains landmark bytes
- [ ] Per-language CI jobs run independently

## 📝 Documentation
- [ ] ADRs 002–009 written and referenced from `docs/ARCHITECTURE.md`
- [ ] `ml/data/LICENSES.md` complete
- [ ] `signtutor/data/REFERENCE_LICENSES.md` complete
