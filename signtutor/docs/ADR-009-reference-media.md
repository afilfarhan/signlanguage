# ADR-009: Sign Reference Media Hosting: Bundled vs. CDN vs. On-Demand Fetch

## Status
Accepted (W1 — Sign Reference System)

## Context
Every sign taught needs at least one visual reference (image, GIF, or video). Hosting choices affect licence compliance, offline support, and page load.

## Decision
1. **In-house recordings** (preferred): bundled in `public/refs/`; gitignored source, CI downloads on cold cache.
2. **Lifeprint / ASL University**: Educational-use GIFs, bundled locally, attributed in `REFERENCE_LICENSES.md`.
3. **WLASL clips**: Research-use only, bundled locally, attributed.
4. **HandSpeak / SigningSavvy**: Supplementary; on-demand fetch with caching, blocked by default if no licence entry exists.

- All referenced media must have a matching entry in `signtutor/data/REFERENCE_LICENSES.md`.
- CI gate: `grep` for every media path in `public/refs/` and fail if no licence entry is found.

## Rejected Alternatives
- Hot-linking to external sources: fragile, breaks offline, risks licence violation.
- Only in-house recordings: impossible to scale to 200 signs quickly.

## Consequences
- `REFERENCE_LICENSES.md` must be kept up-to-date as new references are added.
- CI build re-downloads reference media on cache miss; build may be slower.
- Download script (`scripts/download_refs.sh`) is checked in and run in CI.
