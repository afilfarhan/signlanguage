# SignTutor Architecture

> Stack, conventions, and the eight non-obvious decisions that keep the
> on-device ML pipeline correct.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (`@theme` inline) |
| Fonts | `next/font/google` (Geist Sans / Mono) |
| ML runtime | `onnxruntime-web` (WASM exec provider) + MediaPipe Hands (CDN) |
| State | `localStorage` for prefs (`signtutor.prefs`) and progress (`signtutor.progress`) |
| Testing | Vitest (unit) + Playwright (E2E) |
| CI / CD | GitHub Actions: ML gates + frontend gates |

---

## Directory layout (what lives where)

| Path | Purpose |
|---|---|
| `src/app/` | Next.js App Router pages and layout |
| `src/lib/` | Pure logic: feature normalisation, curriculum, storage, types |
| `src/components/` | Shared React components (`<Header>`) |
| `public/models/` | ONNX models + JSON label files served as static assets |
| `__tests__/` | Vitest unit tests (parity + lib helpers) |
| `e2e/` | Playwright end-to-end tests |
| `docs/` | Architecture + ADRs |

---

## The eight architectural decisions (ALL preserved)

### 1. Hybrid ML + rule classifier

The static-sign player runs **both** the MLP *and* the rule classifier at
all times. The MLP provides calibrated probabilities and a discriminative
top-K; the rule layer provides finger-level interpretability.

Why it matters: the MLP alone cannot tell you *which* finger is wrong. The
per-finger panel is driven by `fingerStates()` + `PATTERNS`, not by the
MLP. The mode toggle in the UI switches which source is used for the final
verdict, but both run concurrently.

### 2. Auto-fallback to rule mode

If the ONNX model fails to load (CDN blocked, corrupted file,
browser crash), the page stays usable. The fallback is surfaced in the UI
as a non-scary indicator (orange “Rule-based fallback” badge).

### 3. Collision-aware verdict

Some letter pairs are visually identical in the synthetic training data
(`A=E=M=N=S=T`, etc.). The verdict treats same-collision-group neighbours as
`close`, not `miss`, with a friendly explanation. `COLLISION_GROUPS` lives in
`src/lib/normalize.ts`; swapping to real data later will make this a no-op,
but the logic stays in place.

### 4. Dynamic-sign feature pipeline anchors on the *first frame*

Per-frame normalisation would destroy global trajectory — the exact signal
that distinguishes HELLO from THANKS from PLEASE. `normalizeSequence()`
centers the *entire* sequence on the wrist position of frame 0, then
computes inter-frame deltas. This is deliberately not the same as normalising
each frame independently.

### 5. `--rotation-aug` is required at training time

The dynamic Transformer fails the NFR-10 rotation gate without rotation
augmentation. The CI workflow (`ml-gate.yml`) passes the flag; removing it
would break robustness.

### 6. Lesson-time lighting check stays on-device

The camera-setup wizard samples downscaled frames, computes mean luminance
and standard deviation, and never uploads a single pixel to any server. This
is enforced by the Content-Security-Policy on `/learn/*` and `/practice`.

### 7. Latency HUD shows MediaPipe and classifier separately

`mp ${latency}ms · clf ${latency}ms` is deliberately kept as two numbers so
developers can see whether a slowdown is in detection or inference. The HUD is
hidden behind `?debug=1`.

### 8. Mirror the webcam by default

Mirroring is on by default and flips both the demo video *and* the
recognition geometry. The toggle is available in the setup wizard and the
lesson players; preferences are persisted to `localStorage`.

---

## Data flow (static player)

```
webcam frame
    │
    ▼
+---------------+
| MediaPipe     │  →  21 hand landmarks
| Hands (CDN)   |
+---------------+
    │
    ▼
+---------------+
| normalize()   │  →  Float32Array(63) wrist-centred, scaled by
| (src/lib/)    │     wrist→middle-MCP distance
+---------------+
    │
    ├── ONNX MLP  →  top-5 probabilities (optional, ML mode)
    │
    └── fingerStates() + PATTERNS  →  per-finger panel + rule verdict
```

---

## Data flow (dynamic player)

```
webcam frame ──► MediaPipe Hands ──► 21 landmarks per frame
                                           │
                                           ▼
                              45-frame sliding buffer
                                           │
                                           ▼
                         normalizeSequence()  ──►  Float32Array(45×126)
                                           │
                                           ▼
                                    ONNX Transformer
                                           │
                                    top-5 probabilities + verdict
```

---

## Privacy model

- **No webcam frames leave the device** — enforced by CSP `connect-src`
  restrictions.
- **No hand-landmark data is transmitted** — `normalize()` runs entirely in
  the browser.
- The only network requests on lesson pages are to load `*.onnx` model files.
- No analytics payloads or telemetry are sent during practice.

---

## CI / CD gates

| Gate | Command | Enforced in |
|---|---|---|
| JS↔Python parity | `npm run test` (Vitest) | `frontend-gate` job |
| Unit tests | `npm run test` | `frontend-gate` job |
| Type check | `npm run typecheck` | `frontend-gate` job |
| Lint | `npm run lint` | `frontend-gate` job |
| E2E (Playwright) | `npm run test:e2e` | `frontend-gate` job |
| Lighthouse a11y | `lighthouse` CLI | `frontend-gate` job (≥ 95) |
| ML training | `python3 ml/train_export.py` | `ml-gate` job |
| Robustness | `python3 ml/eval_robustness.py` | `ml-gate` job |
| NFR enforcement | `python3 ci/check_nfr.py` | `ml-gate` job |

---

## Environment variables

| Variable | Purpose |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Override `baseURL` for E2E tests (CI vs. local) |
