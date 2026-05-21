# Sign Reference Licences

Every animated GIF, image, and video served as a reference in the app must be listed here with its licence, source URL, and attribution string.

## Fingerspelling References (A–Z)
| File | Source | Licence | Attribution |
|------|--------|---------|-------------|
| `public/refs/asl/fingerspelling/A.webp` | ASL University (Lifeprint) | CC BY-NC / Educational use | © Lifeprint.com |
| `public/refs/asl/fingerspelling/A.gif` | ASL University (Lifeprint) | CC BY-NC / Educational use | © Lifeprint.com |
| `public/refs/asl/fingerspelling/B.webp` | ASL University (Lifeprint) | CC BY-NC / Educational use | © Lifeprint.com |
| `public/refs/asl/fingerspelling/B.gif` | ASL University (Lifeprint) | CC BY-NC / Educational use | © Lifeprint.com |
| ... | ... | ... | ... |
| `public/refs/asl/fingerspelling/Z.webp` | ASL University (Lifeprint) | CC BY-NC / Educational use | © Lifeprint.com |
| `public/refs/asl/fingerspelling/Z.gif` | ASL University (Lifeprint) | CC BY-NC / Educational use | © Lifeprint.com |

## Dynamic Sign References
| File | Source | Licence | Attribution |
|------|--------|---------|-------------|
| `public/refs/asl/vocab/hello.mp4` | WLASL Dataset | Research / Educational | WLASL |
| `public/refs/asl/vocab/thank_you.mp4` | WLASL Dataset | Research / Educational | WLASL |
| ... | ... | ... | ... |

## CI Enforcement
- `ci/check_ref_licenses.py` verifies every file under `public/refs/` has a matching entry in this file.
- Failure blocks PR merge.
