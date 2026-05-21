# ADR-008: Per-Language Model Bundle Layout and Lazy-Loading Strategy

## Status
Accepted (W7 — Multi-Language Beta)

## Context
Adding a second sign language (BSL or ArSL) requires separate model bundles, reference media, and curriculum data. We must not inflate the initial page load.

## Decision
- Each language gets its own ONNX model bundle under `public/models/{lang}/`.
- Curriculum, reference media, and labels are loaded lazily on language switch.
- Prefetch triggers on hover/focus of the language selector.
- Cache headers: `Cache-Control: public, max-age=31536000, immutable` for versioned ONNX bundles.

## Rejected Alternatives
- Monolithic bundle with all languages: too large, defeats fast initial load.
- CDN per language (non-local): requires network egress, breaks on-device guarantee for model files.

## Consequences
- Build system must output versioned language bundles.
- Language selector must show a loading state while the bundle downloads.
- Beta disclaimer required for non-ASL languages.
