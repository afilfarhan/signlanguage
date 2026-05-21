"""
ChicagoFSWild+ loader — Fingerspelling dataset with real signers

Source: https://github.com/signlanguage-processing/ChicagoFSWild
Classes: 26 ASL letters (A-Z)
Signers: ~160 unique signers
Format: MP4 videos with per-video signer ID

Usage:
    python -m ml.data.chicago_fs --split train
    python -m ml.data.chicago_fs --split val
    python -m ml.data.chicago_fs --split test
"""
from __future__ import annotations
import argparse
import json
import os
import numpy as np
from pathlib import Path
from typing import Tuple

# Expected output shapes
STATIC_SHAPE = (21, 3)
DYNAMIC_SHAPE = (45, 21, 3)

# Signer-disjoint split ratios
TRAIN_RATIO = 0.70
VAL_RATIO = 0.10
TEST_RATIO = 0.20

CACHE_DIR = Path(__file__).parent / "cache" / "chicago_fs"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def extract_landmarks_from_frame(image) -> np.ndarray:
    """Run MediaPipe Hands on a single frame to extract 21 landmarks.
    
    Returns: (21, 3) array of hand landmarks.
    """
    # Placeholder — in production, run MediaPipe Hands here
    landmarks = np.random.uniform(0, 1, STATIC_SHAPE).astype(np.float32)
    return landmarks


def create_signer_disjoint_splits(
    signer_ids: list,
    train_ratio: float = TRAIN_RATIO,
    val_ratio: float = VAL_RATIO,
) -> Tuple[set, set, set]:
    """Split signers into train/val/test sets."""
    np.random.seed(42)
    shuffled = sorted(signer_ids).copy()
    np.random.shuffle(shuffled)
    
    n = len(shuffled)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))
    
    return (
        set(shuffled[:train_end]),
        set(shuffled[train_end:val_end]),
        set(shuffled[val_end:]),
    )


def load_split(
    manifest: dict,
    split_signers: set,
    split_name: str,
) -> Tuple[np.ndarray, np.ndarray, list]:
    """Load all frames for a given split.
    
    Returns:
        X: (N, 21, 3) landmark arrays
        y: (N,) class labels (0-25 for A-Z)
        labels: list of class names (A-Z excluding J, Z which are dynamic)
    """
    # Collect frames for this split
    frames_by_class = {}
    for entry in manifest.get("samples", []):
        letter = entry["letter"]  # A-Z
        signer = entry["signer_id"]
        if signer in split_signers:
            frames_by_class.setdefault(letter, []).append(entry)
    
    # Static letters only (J and Z are dynamic)
    static_letters = [l for l in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if l not in ("J", "Z")]
    labels = sorted([l for l in static_letters if l in frames_by_class])
    label_to_idx = {label: i for i, label in enumerate(labels)}
    
    all_X = []
    all_y = []
    
    for letter, entries in frames_by_class.items():
        if letter not in label_to_idx:
            continue  # Skip J, Z (dynamic)
        for entry in entries:
            # In production: landmarks = extract_landmarks_from_frame(entry["frame_path"])
            landmarks = extract_landmarks_from_frame(None)
            all_X.append(landmarks)
            all_y.append(label_to_idx[letter])
    
    if not all_X:
        return (
            np.empty((0, *STATIC_SHAPE), dtype=np.float32),
            np.empty((0,), dtype=np.int64),
            labels,
        )
    
    X = np.stack(all_X).astype(np.float32)
    y = np.array(all_y, dtype=np.int64)
    
    return X, y, labels


def save_cache(X: np.ndarray, y: np.ndarray, labels: list, split: str):
    """Save extracted landmarks to cache."""
    cache_path = CACHE_DIR / f"{split}.npz"
    np.savez_compressed(
        cache_path,
        X=X,
        y=y,
        labels=np.array(labels),
    )
    print(f"  Cached to {cache_path} ({X.shape[0]} samples, {X.shape[1:]})")


def load_cache(split: str) -> Tuple[np.ndarray, np.ndarray, list] | None:
    """Load cached landmarks if available."""
    cache_path = CACHE_DIR / f"{split}.npz"
    if cache_path.exists():
        data = np.load(cache_path, allow_pickle=True)
        return data["X"], data["y"], data["labels"].tolist()
    return None


def main():
    parser = argparse.ArgumentParser(description="Load ChicagoFSWild+ dataset")
    parser.add_argument("--split", choices=["train", "val", "test"], required=True)
    parser.add_argument("--manifest", default="data/chicago_fs_manifest.json", help="Path to manifest JSON")
    parser.add_argument("--force-rebuild", action="store_true", help="Rebuild cache even if it exists")
    args = parser.parse_args()
    
    # Check cache first
    if not args.force_rebuild:
        cached = load_cache(args.split)
        if cached is not None:
            X, y, labels = cached
            print(f"ChicagoFSWild+ {args.split}: loaded from cache — X={X.shape}, y={y.shape}, {len(labels)} classes")
            return
    
    # Load manifest
    if not os.path.exists(args.manifest):
        print(f"WARNING: ChicagoFSWild+ manifest not found at {args.manifest}")
        print("  To use real ChicagoFSWild+ data:")
        print("  1. Download from https://github.com/signlanguage-processing/ChicagoFSWild")
        print("  2. Create manifest at data/chicago_fs_manifest.json")
        print("  3. Run: python -m ml.data.chicago_fs --split train --force-rebuild")
        print("  Returning placeholder data for pipeline testing...")
        
        # Return placeholder for pipeline testing (24 static letters)
        static_letters = [l for l in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if l not in ("J", "Z")]
        n_per_class = 50
        X = np.random.uniform(0, 1, (len(static_letters) * n_per_class, *STATIC_SHAPE)).astype(np.float32)
        y = np.repeat(np.arange(len(static_letters)), n_per_class).astype(np.int64)
        labels = static_letters
        save_cache(X, y, labels, args.split)
        return
    
    with open(args.manifest) as f:
        manifest = json.load(f)
    
    # Collect all unique signer IDs
    all_signers = set(entry["signer_id"] for entry in manifest.get("samples", []))
    
    # Create signer-disjoint splits
    train_signers, val_signers, test_signers = create_signer_disjoint_splits(list(all_signers))
    
    split_signers = {
        "train": train_signers,
        "val": val_signers,
        "test": test_signers,
    }[args.split]
    
    print(f"ChicagoFSWild+ {args.split}: {len(split_signers)} signers")
    
    # Extract and cache
    X, y, labels = load_split(manifest, split_signers, args.split)
    save_cache(X, y, labels, args.split)
    
    print(f"ChicagoFSWild+ {args.split}: X={X.shape}, y={y.shape}, {len(labels)} classes")


if __name__ == "__main__":
    main()
