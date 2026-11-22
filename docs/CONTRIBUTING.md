# Contributing to SignTutor

Thank you for contributing to SignTutor! This guide covers development setup, coding standards, and the contribution workflow.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Python 3.11+ (for ML training)
- Git

### Setup

```bash
# Clone repository
git clone https://github.com/afilfarhan/signlanguage.git
cd signlanguage

# Install frontend dependencies
cd signtutor
pnpm install

# Install ML dependencies (optional, for training)
cd ../ml
pip install -r requirements.txt  # or use the CI script

# Start development server
cd ../signtutor
pnpm dev
```

### Run Tests

```bash
# Frontend
cd signtutor
pnpm test          # Unit tests
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm build         # Production build

# ML
cd ../ml
python -m pytest tests/  # If tests exist
```

## Development Workflow

### Branch Strategy

```
main ← feat/phase-X-name ← feat/phase-X-name-feature
```

Each phase follows the mandatory push protocol:

```bash
# 1. Create feature branch from main
git checkout main && git pull
git checkout -b feat/phase-X-name

# 2. Implement + test locally
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build

# 3. Commit with conventional commits
git add -A
git commit -m "feat(phase-X): description

- Detailed change 1
- Detailed change 2

Closes #ISSUE"

# 4. Push + PR
git push origin feat/phase-X-name
gh pr create --title "Phase X: Name" --body "$(cat PHASE_X_SUMMARY.md)"

# 5. CI must pass (ml-gate + frontend-gate)
# 6. Code review + approval
# 7. Squash merge to main
# 8. Tag phase completion
git tag phase-X-complete-YYYYMMDD
git push origin phase-X-complete-YYYYMMDD
```

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

- Detail 1
- Detail 2

Closes #123
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`

**Scopes:** `ml`, `frontend`, `api`, `ui`, `pwa`, `a11y`, `perf`, `docs`

## Coding Standards

### TypeScript

- **Strict mode** enabled — no `any` unless absolutely necessary
- **Explicit types** for public APIs
- **Functional components** with hooks
- **Path aliases**: `@/lib/*`, `@/components/*`, `@/app/*`

### React

- **Functional components** with hooks
- **Custom hooks** for reusable logic (`usePWA`, `useSWRegistration`)
- **Client components** marked with `"use client"`
- **Server components** by default (Next.js App Router)

### Styling

- **Tailwind CSS v4** with CSS variables
- **Design tokens** in `globals.css` (`--color-*`, `--radius-*`, etc.)
- **Dark mode only** (design system optimized for dark)
- **Responsive**: mobile-first, `sm:`, `md:`, `lg:`, `xl:`

### Accessibility (WCAG 2.2 AA)

- **Semantic HTML** — proper heading hierarchy, landmarks
- **Keyboard navigation** — all interactive elements focusable
- **Color contrast** — ≥4.5:1 for text, ≥3:1 for UI elements
- **ARIA labels** — for icon-only buttons, complex widgets
- **Focus visible** — custom focus styles matching brand
- **Reduced motion** — `@media (prefers-reduced-motion: reduce)`
- **Screen readers** — proper labels, live regions for dynamic content

### Performance

- **WebGPU first** — WebGPU EP with WASM fallback
- **FP16 models** — 2× smaller, faster on GPU
- **Graph capture** — for static-shape models
- **Code splitting** — dynamic imports for heavy pages
- **Service Worker** — cache models, CDN assets, static files
- **Lazy loading** — images, non-critical components

## ML Pipeline

### Training

```bash
cd ml
python train_export.py              # Static MLP
python train_transformer.py --rotation-aug  # Dynamic Transformer
```

### Export

```bash
# FP16 export (for WebGPU)
python train_export.py --fp16
python train_transformer.py --fp16 --rotation-aug
```

### Evaluation

```bash
python eval_robustness.py
python eval_parity.py  # JS↔Python feature parity
```

### CI Gates

The `ml-gate` job must pass:
1. Train static MLP → eval report
2. Train dynamic Transformer (with rotation aug) → eval report
3. Robustness sweep
4. Copy models to prototype
5. Regenerate parity samples
6. JS↔Python feature parity
7. NFR gates (accuracy, latency, robustness)

## Adding New Features

### New ML Model

1. Add training script in `ml/`
2. Export ONNX (FP32 + FP16)
3. Add to `signtutor/public/models/`
4. Update `loadExternals.ts` if new model type
4. Add inference in relevant page
5. Add parity test in `ci/`

### New Page/Route

1. Create in `signtutor/src/app/learn/asl/<feature>/page.tsx`
2. Add to curriculum in `signtutor/src/app/learn/page.tsx`
3. Follow accessibility patterns:
   - Semantic headings (`h1` → `h2` → `h3`)
   - `role="status"` for live updates
   - `aria-live="polite"` for announcements
   - Keyboard accessible controls
   - Color contrast ≥4.5:1

### New Component

1. Create in `signtutor/src/components/`
2. Export from component file
3. Follow existing patterns:
   - `"use client"` for interactive
   - Proper TypeScript types
   - JSDoc for public APIs
   - Accessibility attributes

## Documentation

### Required for New Features

- **API docs** — update `docs/API.md`
- **Model card** — if new ML model
- **Inline JSDoc** — public functions/classes
- **README updates** — if user-facing change

### Writing Style

- **Clear, concise** — avoid jargon
- **Code examples** — for all public APIs
- **TypeScript first** — types in examples
- **Accessibility notes** — where relevant

## Release Process

### Versioning

Semantic Versioning (SemVer): `MAJOR.MINOR.PATCH`

- **MAJOR** — breaking changes, architecture shifts
- **MINOR** — new features, backward compatible
- **PATCH** — bug fixes, docs, minor improvements

### Release Checklist

- [ ] All CI gates pass (`ml-gate`, `frontend-gate`)
- [ ] Lighthouse ≥95 all categories
- [ ] axe-core 0 violations WCAG 2.2 AA
- [ ] Models load <2s on 3G
- [ ] Inference <0.2ms WebGPU / <1ms WASM
- [ ] Documentation updated
- [ ] Release notes written
- [ ] Migration guide (if breaking)
- [ ] Tagged and deployed

### Release Notes Template

```markdown
# SignTutor vX.Y.Z

## Highlights
- Feature 1
- Feature 2

## New Features
- **Feature Name**: Description

## Improvements
- **Area**: Description

## Bug Fixes
- **Area**: Description

## Breaking Changes
- **Change**: Migration steps

## Documentation
- Updated: [links]

## Contributors
- @username
```

## Code Review Checklist

### Functionality
- [ ] Works as specified
- [ ] Edge cases handled
- [ ] No regressions

### Code Quality
- [ ] TypeScript strict mode passes
- [ ] ESLint passes
- [ ] No `any` without justification
- [ ] Proper error handling

### Accessibility
- [ ] Semantic HTML
- [ ] Keyboard navigable
- [ ] Color contrast ≥4.5:1
- [ ] ARIA labels where needed
- [ ] Focus visible
- [ ] Reduced motion respected

### Performance
- [ ] No unnecessary re-renders
- [ ] WebGPU used where available
- [ ] Models cached properly
- [ ] Bundle size reasonable

### Security
- [ ] No XSS vulnerabilities
- [ ] No sensitive data in logs
- [ ] CSP headers respected
- [ ] No eval/unsafe patterns

## Getting Help

- **Issues**: GitHub Issues for bugs/features
- **Discussions**: GitHub Discussions for questions
- **Discord**: [Link if available]
- **Email**: [security@ for vulnerabilities]

## License

By contributing, you agree that your contributions will be licensed under the project's license (MIT).