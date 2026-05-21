#!/usr/bin/env python3
"""Check that train and test signers are disjoint."""

import sys
import json
from pathlib import Path

def load_signers(path: Path) -> set:
    with open(path, "r") as f:
        data = json.load(f)
    return set(data.get("signers", []))

def main(train_path: str, test_path: str) -> int:
    train = load_signers(Path(train_path))
    test = load_signers(Path(test_path))
    overlap = train & test
    if overlap:
        print(f"❌ Signer leak: {overlap}", file=sys.stderr)
        return 1
    print("✅ Train and test signers are disjoint.")
    return 0

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: check_signer_disjoint.py <train_meta.json> <test_meta.json>")
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1], sys.argv[2]))
