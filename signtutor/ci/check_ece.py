#!/usr/bin/env python3
"""Compute Expected Calibration Error (ECE) from logits and labels."""

import sys
import json
import numpy as np
from pathlib import Path

def compute_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 10) -> float:
    assert len(probs) == len(labels)
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        in_bin = (probs.max(axis=1) > bin_boundaries[i]) & (probs.max(axis=1) <= bin_boundaries[i + 1])
        if in_bin.sum() == 0:
            continue
        bin_acc = (labels[in_bin] == probs.argmax(axis=1)[in_bin]).mean()
        bin_conf = probs[in_bin].max().mean()
        ece += (in_bin.sum() / len(labels)) * abs(bin_acc - bin_conf)
    return ece

def main(probs_path: str, labels_path: str, threshold: float = 0.05) -> int:
    probs = np.load(probs_path)
    labels = np.load(labels_path)
    ece = compute_ece(probs, labels)
    if ece > threshold:
        print(f"❌ ECE too high: {ece:.4f} > {threshold}", file=sys.stderr)
        return 1
    print(f"✅ ECE: {ece:.4f} ≤ {threshold}")
    return 0

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: check_ece.py <probs.npy> <labels.npy> [threshold=0.05]")
        raise SystemExit(2)
    threshold = float(sys.argv[3]) if len(sys.argv) > 3 else 0.05
    raise SystemExit(main(sys.argv[1], sys.argv[2], threshold))
