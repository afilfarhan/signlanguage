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

-  **On-device by default** — no webcam frames or hand landmarks leave the device.
-  **No account required** — start your first lesson in under 60 seconds.
-  **No analytics during practice** — the only network requests on lesson pages are to load model files.

For details, see the [Privacy Policy](/privacy) page.

## License

MIT
"# signlang" 
"# signlang" 
