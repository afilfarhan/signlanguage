# ADR-005: PersonalAdapter — Encoder Embedding Format, Adapter Shape, and Storage Schema

## Status
Accepted (W5 — On-Device Personalization)

## Context
A single frozen model cannot adapt to individual hand sizes, signing styles, or lighting. We want per-user adaptation with zero data leaving the device, using a tiny trainable layer over the fixed encoder embedding.

## Decision
- Export the Transformer with an `embedding` output (128-d, pooled encoder output).
- In the browser, keep a lightweight `PersonalAdapter`:
  - Input: `embedding: Float32Array(128)`
  - Parameters: `W: Float32Array(128 × n_classes)`, `b: Float32Array(n_classes)`
  - Optimizer: vanilla SGD with cross-entropy, `lr=0.01`
- Storage:
  - Serialize `{ W: Array.from(W), b: Array.from(b), attempts: number }` to `localStorage`.
- Enable after ≥ 20 confirmed attempts to avoid cold-start noise.

## Rejected Alternatives
- Full fine-tuning in browser: too slow (MBs of weights), kills battery.
- Server-side adaptation: violates on-device privacy guarantee.
- Prompt-based adaptation (LoRA with rank=1): over-engineered for a 1 KB state budget.

## Consequences
- `PersonalAdapter.ts` must implement tiny matmul (128 × n_classes) in pure JS; no dependencies.
- Privacy gate must assert no `fetch` / `XHR` sends embeddings or adapter weights.
- UI surfaces a "Personalized" badge after 20 confirmed attempts, with a reset drawer.
