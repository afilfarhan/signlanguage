# ADR-002: Dataset Choice, Licence Stance, and Signer Demographics Analysis

## Status
Accepted (W1 — Real Data Foundation)

## Context
v1 trained entirely on synthetic data. v2 must use real, licensed data with documented provenance. We need to select datasets that provide enough real signers, span the curriculum (fingerspelling + 200 isolated signs), and permit non-commercial educational use. We must also understand and document signer demographics to audit fairness slices.

## Decision
We ingest the following datasets in priority order:
1. **ChicagoFSWild+** (26 fingerspelling classes, ~160 signers) → static classifier training
2. **WLASL2000** (2,000 classes, 119 signers) → dynamic sign training
3. **MS-ASL** (1,000 classes, 222 signers) → cross-dataset evaluation only
4. **ASL Citizen** (2,731 signs, 52 signers) → supplementary static + dynamic

## Rejected Alternatives
- **Synthetic-only data**: Regresses accuracy on real hand shapes (skin tone, hand size, camera angle). Already the v1 baseline; we are replacing it.
- **Surrey16 / BSLdict**: BSL-only datasets; saved for W7 multi-language beta.

## Consequences
- Licence, consent, and demographic metadata must accompany every dataset.
- Every dataset requires an entry in `ml/data/LICENSES.md`.
- CI enforces a grep gate: any un-documented dataset path fails the build.
