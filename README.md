# SignTutor

**Live Demo:** https://signlanguage-three.vercel.app/

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000?logo=vercel&logoColor=white)](https://signlanguage-three.vercel.app/)

A browser-based, vision-driven sign language learning platform with on-device inference. Learn fingerspublik ASL signs using your webcam. All processing happens in your browser — no video or landmark data ever leaves your device.

## Quick Start

```bash
# Install dependencies
cd signtutor
npm install          # or: pnpm install

# Start development server
npm run dev          # or: pnpm dev
```

Visit `http://localhost:3000` and click **"Start your first lesson"**.

## Project Overview

### What it does
- **Fingerspelling (Alphabet)**: Practice A–Z with real-time hand tracking and instant feedback
- **Word Recognition**: Learn 100 common ASL conversation words
- **Dynamic Signs**: 8 multi-frame signs with temporal modeling
- **Data Collection Studio**: `/research/collect` — record your own signs to retrain models
- **Research Pages**: Continuous SLR exploration, multi-language evaluation

### Privacy by Design
- **On-device by default** — webcam frames and hand landmarks never leave the browser
- **No account required** — start in under 60 seconds
- **No analytics during practice** — only network requests are for model file downloads

## Local Development

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9 (recommended) or npm
- Webcam + HTTPS (or `localhost`) for MediaPipe Hands

### Commands (run from `signtutor/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload (Turbopack) |
| `npm run build` | Production build → `.next/` |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint (zero warnings in CI) |
| `npm run typecheck` | TypeScript strict mode |
| `npm run test` | Vitest unit tests (JS↔Python parity, normalization, curriculum) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:e2e` | Playwright E2E tests (Chromium) |

### First-time setup
```bash
cd signtutor
npm install          # installs deps + creates pnpm-lock.yaml
npm run dev          # starts at http://localhost:3000
```

**Camera permission**: Browser will prompt for webcam access on lesson pages. Use Chrome/Edge/Firefox on desktop; Safari on iOS 14.3+ works but requires HTTPS (use `ngrok` or `vercel dev` for local HTTPS).

## Architecture

```
signlanguage/
├── ml/                          # Python ML pipeline (training, export, evaluation)
│   ├── train_export_v2.py       # Static MLP (24 letters, 63-dim features)
│   ├── train_transformer_v2.py  # Dynamic Transformer (8 signs, 126-dim seq)
│   ├── train_word_model.py      # WordTransformer (100 words, 126-dim, T=60)
│   ├── features.py / seq_features.py  # Normalization (wrist-anchor + palm-scale)
│   ├── evaluate.py              # Accuracy, robustness sweep, threshold tuning
│   ├── data/                    # Dataset preparation (ASL Citizen, WLASL, ChicagoFS)
│   └── models/                  # Exported ONNX + label JSONs
│
├── signtutor/                   # Next.js 16 + React 19 frontend
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   │   ├── learn/           # Alphabet + Word lessons
│   │   │   ├── practice/        # Free-form practice mode
│   │   │   ├── research/        # Data collection + research tools
│   │   │   └── setup/           # Camera calibration
│   │   ├── components/          # Shared React components (UI, canvas, video)
│   │   └── lib/                 # Core logic
│   │       ├── normalize.ts     # JS port of features.py (per-frame)
│   │       ├── seq-features.ts  # JS port of seq_features.py (sequence)
│   │       ├── curriculum.ts    # Lesson definitions + progression
│   │       ├── landmark-db.ts   # IndexedDB storage for collected samples
│   │       ├── export-npz.ts    # Generates Python script → .npz for retraining
│   │       ├── loadExternals.ts # MediaPipe + ONNX Runtime Web lazy load
│   │       ├── vocabulary_200.ts# Word list + metadata
│   │       └── calibration.ts   # Camera + hand detection tuning
│   ├── public/models/           # ONNX models served as static assets
│   │   ├── fingerspell_mlp.onnx
│   │   ├── dynamic_signs_transformer.onnx
│   │   ├── word_transformer.onnx
│   │   └── *_labels.json
│   ├── __tests__/               # Vitest unit tests
│   └── e2e/                     # Playwright E2E tests
│
├── prototype/                   # Legacy vanilla JS prototype (kept for reference)
└── .github/workflows/ml-gate.yml # CI: ML gates + frontend checks + Vercel deploy
```

### Data Flow (Inference)

1. **Camera → MediaPipe Hands** → 21 landmarks/frame (x, y, z)
2. **Normalize (JS)** → `normalize.ts` (static) or `seq-features.ts` (dynamic/word)
   - Static: per-frame wrist-anchor + palm-scale → 63-dim vector
   - Dynamic/Word: sequence-level first-frame anchor + velocity → 126-dim/frame
3. **ONNX Runtime Web** → model inference in WebAssembly/WASM
4. **Post-process** → confidence threshold, smoothing, display

### Model Specs

| Model | Classes | Input | Latency (ONNX CPU) |
|-------|---------|-------|---------------------|
| Static MLP | 24 letters | 63-dim/frame | <1 ms |
| Dynamic Transformer | 8 signs | 126-dim × T | ~1 ms |
| WordTransformer | 100 words | 126-dim × 60 | ~1.2 ms |

## ML Pipeline (Retraining)

### Static Alphabet (24 letters)
```bash
cd ml
python train_export_v2.py          # trains sklearn MLP → fingerspell_mlp.onnx + labels.json
```

### Dynamic Signs (8 signs)
```bash
python train_transformer_v2.py --rotation-aug  # rotation augmentation closes NFR-10
```

### Word Recognition (100 words)
```bash
# Synthetic data (fast, for CI)
python train_word_model.py --source synth
python evaluate.py --source synth --benchmark --sweep

# Real data (ASL Citizen / WLASL)
python -m ml.data.prepare_word_dataset --source asl_citizen --manifest path/to/manifest.json
python train_word_model.py --source asl_citizen --pretrained ml/models/dynamic_transformer_v2.pt --freeze-encoder
python evaluate.py --source asl_citizen --benchmark --sweep

# Copy to frontend for browser serving
cp ml/models/word_transformer.onnx signtutor/public/models/
cp ml/models/word_labels.json signtutor/public/models/
```

### Synthetic Data Generators
- `synth_landmarks.py` — static letter landmarks
- `synth_sequences.py` — dynamic sign sequences
- `synth_jz_sequences.py` — J/Z motion patterns

## CI/CD Pipeline

`.github/workflows/ml-gate.yml` runs on every push to `main`/`develop` and PRs:

1. **ml-gate** (20 min)
   - Train static MLP + dynamic Transformer (with rotation augmentation)
   - Robustness sweep on dynamic model
   - Sync models to `prototype/models/`
   - Regenerate JS↔Python parity samples
   - Enforce release gates (`ci/check_nfr.py`)
   - Upload eval reports as artifacts

2. **frontend-gate** (15 min)
   - pnpm install + lint + typecheck + unit tests + build
   - Playwright E2E (commented out by default)
   - Lighthouse a11y audit on `/`, `/setup`, `/learn/asl/fingerspelling/A` (≥95)
   - Upload lighthouse/playwright reports

3. **deploy-vercel** (after frontend-gate passes)
   - Deploys to Vercel production on `main` branch
   - Requires secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

### Local CI Commands
```bash
# ML gate (from repo root)
cd ml && python train_export_v2.py
cd ml && python train_transformer_v2.py --rotation-aug
cd ml && python eval_robustness.py
node ci/run_parity.mjs
python ci/check_nfr.py

# Frontend gate (from signtutor/)
cd signtutor && npm run lint && npm run typecheck && npm run test && npm run build
```

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel → detects Next.js in `signtutor/`
3. Add environment variables if needed
4. Deploy

The `vercel.json` at repo root uses legacy `builds` config to point at `signtutor/package.json`.

### Manual Build
```bash
cd signtutor && npm run build
# Deploy .next/ folder to any static+serverless host supporting Next.js
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY signtutor/package*.json ./
RUN npm ci
COPY signtutor/ ./
RUN npm run build
CMD ["npm", "start"]
```

## Key Design Decisions (Preserved)

1. **On-device inference only** — no server-side ML, zero egress of biometric data
2. **MediaPipe Hands** — lightweight, proven hand landmark model
3. **ONNX Runtime Web** — cross-platform WASM inference, no WebGL dependency
4. **Per-frame normalization parity** — JS `normalize.ts` matches Python `features.py` bit-for-bit
5. **Sequence normalization parity** — JS `seq-features.ts` matches Python `seq_features.py`
6. **Rotation augmentation** — closes dynamic sign robustness gap (NFR-10)
7. **IndexedDB for collected data** — persists locally, exportable as JSON/NPZ
8. **Curriculum-driven lessons** — JSON-like config in `curriculum.ts` for easy iteration

## Hardware Requirements

| Mode | Min CPU | Rec GPU | ONNX CPU Latency |
|------|---------|---------|------------------|
| Alphabet | any | — | <1 ms |
| 8 Dynamic | any | — | ~1 ms |
| 100 Words | 4-core | GTX 1060+ | ~1.2 ms |

## Contributing

1. Fork → branch → PR
2. Run `npm run lint && npm run typecheck && npm run test` in `signtutor/`
3. For ML changes, run relevant `ml/train_*.py` and `ml/evaluate.py`
4. Ensure parity tests pass (`node ci/run_parity.mjs`)

## License

MIT