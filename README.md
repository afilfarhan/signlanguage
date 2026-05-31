# SignTutor

A browser-based, vision-driven sign language learning platform with on-device inference.

Learn fingerspelling and common ASL signs using your webcam. All processing happens in your browser — no video or landmark data ever leaves your device.

## Quick start

```bash
# Install dependencies
cd signtutor
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` and click **"Start your first lesson"**.

## Available commands

| Command | Description |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build (outputs `.next/`) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (zero warnings tolerance in CI) |
| `npm run typecheck` | TypeScript strict type checking |
| `npm run test` | Vitest unit tests (incl. JS↔Python parity) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end tests |

## Testing

- **Unit tests** (`__tests__/`) run in jsdom via Vitest. They cover the
  `normalize()` and `normalizeSequence()` pipelines, finger-state logic,
  collision groups, and the JS↔Python parity test.
- **E2E tests** (`e2e/`) run in Chromium via Playwright. They verify the
  static and dynamic lesson shells load correctly, navigation works, and
  controls are present.

## Deployment

The app is a standard Next.js application. Deploy to Vercel (or any static+
serverless host that supports Next.js):

```bash
# Build for production
cd signtutor && npm run build
# Then deploy the `.next` folder
```

Model files under `public/models/` are served as static assets.

## Project structure

| Path | Description |
|---|---|
| `src/app/` | Next.js App Router pages |
| `src/lib/` | Shared logic (norms, curriculum, storage) |
| `src/components/` | Shared React components |
| `public/models/` | ONNX models + label JSONs served as static assets |
| `__tests__/` | Vitest unit tests |
| `e2e/` | Playwright end-to-end tests |
| `docs/ARCHITECTURE.md` | Stack, data flows, and the eight preserved architectural decisions |

## Privacy

- **On-device by default** — no webcam frames or hand landmarks leave the device.
- **No account required** — start your first lesson in under 60 seconds.
- **No analytics during practice** — the only network requests on lesson pages are to load model files.

For details, see the [Privacy Policy](/privacy) page.

## ML Pipeline

### Alphabet (static) — 24 letters
- **Model**: sklearn MLP → `fingerspell_mlp.onnx` (63-dim per-frame features)
- **Normalization**: per-frame wrist-anchor + palm-scale (`features.py`)
- **Training**: `python ml/train_export_v2.py`

### Dynamic signs — 8 signs
- **Model**: Transformer Encoder (d=128, 4 layers, 8 heads) → `dynamic_signs_transformer.onnx`
- **Normalization**: sequence-level first-frame anchor + velocity (`seq_features.py`, 126-dim)
- **Training**: `python ml/train_transformer.py`

### Word recognition — 100 words
- **Model**: WordTransformer (d=128, 4 layers, 8 heads, T=60) → `word_transformer.onnx`
- **Vocab**: `ml/models/vocab_v1.json` (100 ASL conversation words)
- **Normalization**: same `seq_features.py` contract (126-dim)
- **Training**: `python ml/train_word_model.py --source synth`
- **Evaluation**: `python ml/evaluate.py --source synth --benchmark --sweep`
- **Inference**: `python -m ml.inference.recogniser --source dry-run --mode word`

### Retrain on real data
```bash
# 1. Prepare dataset (ASL Citizen or WLASL)
python -m ml.data.prepare_word_dataset --source asl_citizen --manifest path/to/manifest.json

# 2. Train (optionally from pretrained dynamic model)
python ml/train_word_model.py --source asl_citizen --pretrained ml/models/dynamic_transformer_v2.pt --freeze-encoder

# 3. Evaluate
python ml/evaluate.py --source asl_citizen --benchmark --sweep

# 4. Copy to public/models for browser serving
copy ml\models\word_transformer.onnx signtutor\public\models\
copy ml\models\word_labels.json signtutor\public\models\
```

### Hardware requirements

| Mode | Min CPU | Rec GPU | Latency (ONNX CPU) | Latency (PyTorch GPU) |
|---|---|---|---|---|
| Alphabet | any | — | <1 ms | — |
| 8 dynamic | any | — | ~1 ms | — |
| 100 words | 4-core | GTX 1060+ | ~1.2 ms | ~2.7 ms (CPU) / <1 ms (GPU) |

### Latency / Accuracy tradeoff

Use `--sweep` to find the optimal confidence threshold. Higher thresholds give
better precision at the cost of coverage (some predictions are rejected).

## License

MIT
"# signlang" 
"# signlang" 
