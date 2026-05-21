#!/usr/bin/env python3
"""Check that every dataset path in ml/data/ has a matching entry in ml/data/LICENSES.md"""

import sys
from pathlib import Path

LICENSES_MD = Path("ml/data/LICENSES.md")
DATA_DIR = Path("ml/data")

def main() -> int:
    content = LICENSES_MD.read_text(encoding="utf-8")
    missing = []
    for entry in DATA_DIR.iterdir():
        if entry.is_dir() and entry.name not in ("__pycache__", "cache"):
            if entry.name not in content:
                missing.append(entry.name)
    if missing:
        print(f"❌ Missing licence entries for datasets: {missing}", file=sys.stderr)
        return 1
    print("✅ All dataset licences documented.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
