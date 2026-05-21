# ADR-003: Signer-Disjoint Split Strategy and CI Audit

## Status
Accepted (W1 — Real Data Foundation)

## Context
Random frame-level splits leak signer identity into train/test and overstate accuracy. We need a split strategy that is fair and auditable in CI.

## Decision
- Split **by signer identity**, not by frame.
- Each dataset loader emits `signer_id` per sample, even if the loader synthesises it from filename/path patterns.
- Before training, assert `train_signer_ids.isdisjoint(test_signer_ids)`.
- CI runs `ci/check_signer_disjoint.py` on every PR; failure blocks merge.

## Rejected Alternatives
- Random 70/20/10 split: leaks signers, inflates metrics, already used in v1.
- Stratified split by class: still leaks signers within classes.

## Consequences
- Lower headline accuracy numbers, but honest and reproducible.
- Dataset loaders must expose signer identity; some public datasets require parsing filenames to extract signer IDs.
