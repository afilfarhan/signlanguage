# Real Data Foundation

This document lists all datasets used for training and evaluation, their licences, and their provenance.

Every dataset referenced in `ml/data/` must have an entry here. CI enforces a grep gate that fails the build if any path is missing.

---

## Datasets

### ChicagoFSWild+
- **Classes**: 26 ASL fingerspelling letters (A–Z)
- **Signers**: ~160
- **Licence**: Research / Educational use (obtain from authors)
- **Use**: Static (fingerspelling) training, W1
- **Signer split**: Train 70 / Val 10 / Test 20 % (signer-disjoint)

### WLASL2000
- **Classes**: 2,000 ASL word signs
- **Signers**: 119
- **Licence**: Research / Educational use
- **Use**: Dynamic (isolated signs) training, W1, W3
- **Signer split**: Train 70 / Val 10 / Test 20 % (signer-disjoint)

### MS-ASL
- **Classes**: 1,000 ASL word signs
- **Signers**: 222
- **Licence**: Research only
- **Use**: Cross-dataset evaluation (not used for training)
- **Signer split**: N/A (used as external validation)

### ASL Citizen
- **Classes**: 2,731 signs
- **Signers**: 52
- **Licence**: Research / Educational use
- **Use**: Supplement static + dynamic training, W1, W3
- **Signer split**: Train 70 / Val 10 / Test 20 % (signer-disjoint)

---

## In-House Recordings
- **Licence**: Owned, all signers consented
- **Use**: Curriculum reference and future training
- **Note**: Placeholder loader exists; data ingest deferred to W3+

## CI Enforcement
- `ci/check_licenses.py` verifies every dataset path has a matching entry in this file.
- Failure blocks PR merge.
