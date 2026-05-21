# ADR-006: Holistic vs. Hands+Face Fusion and NMM Feature Strategy

## Status
Accepted (W4 — Non-Manual Marker Scoring)

## Context
NMM (facial expression, head movement, mouth morphemes) are critical for ASL grammar. We need a single CV pass that yields hand + face + pose landmarks with minimal latency cost.

## Decision
- Replace bare MediaPipe Hands with **MediaPipe Holistic** (single inference pass, ~12 ms on WebGL2).
- Use face landmarks directly from Holistic for NMM features:
  - **Brow**: 24 points (left/right brow clusters) → BrowHead (72 floats → 3 logits)
  - **Mouth**: 20 points (upper/lower lip, corners) → MouthHead (60 floats → 4 logits)
- Feature flag `NMM_SCORING` gates the NMM UI tile and the extra ONNX inference.
- Latency budget: NMM on must not increase P50 by more than 50 ms.
- Consent modal required before enabling NMM scoring (user must understand what is measured; no data leaves device).

## Rejected Alternatives
- Separate MediaPipe Hands + MediaPipe Face Mesh sequential passes: ~2× cost.
- Custom face detector (YOLOface/FaceMesh hybrid): unnecessary complexity, no WASM/WebGL runtime.

## Consequences
- `holisticRunner.ts` replaces `handsRunner.ts` as the single source of landmarks.
- NMM auxiliary heads are separate ONNX files, loaded only when the feature flag is on.
- `REFERENCE_LICENSES.md` must document media sources that include face recordings.
