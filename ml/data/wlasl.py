"""
WLASL2000 loader — Word-Level American Sign Language dataset

Source: https://dx.doi.org/10.1145/3394171.3413730
Classes: 2,000 ASL words
Signers: 119 unique signers
Format: MP4 videos with per-video signer ID

Usage:
    python -m ml.data.wlasl --split train
    python -m ml.data.wlasl --split val
    python -m ml.data.wlasl --split test
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
T_FRAMES = 45

# Signer-disjoint split ratios
TRAIN_RATIO = 0.70
VAL_RATIO = 0.10
TEST_RATIO = 0.20

CACHE_DIR = Path(__file__).parent / "cache" / "wlasl"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def load_wlasl_metadata(json_path: str) -> dict:
    """Load WLASL JSON metadata (class -> videos mapping).
    
    Expected format:
    {
        "gloss": "hello",
        "instances": [
            {"video_id": "v001", "signer_id": "s001", "bbox": [...]},
            ...
        ]
    }
    """
    with open(json_path) as f:
        data = json.load(f)
    return data


def extract_landmarks_from_video(video_path: str) -> np.ndarray:
    """Run MediaPipe Hands offline to extract landmarks from a single video.
    
    Returns: (N, 21, 3) array of hand landmarks, where N is the number of frames.
    Pads or trims to T_FRAMES for dynamic signs.
    """
    # This is a placeholder — in production, you'd run MediaPipe here
    # For now, return a synthetic placeholder that matches the expected shape
    # The real implementation would:
    # 1. Load video frames with cv2
    # 2. Run MediaPipe Hands on each frame
    # 3. Collect 21 landmarks × 3 coords per frame
    # 4. Pad/trim to T_FRAMES
    
    # Placeholder: random landmarks with realistic range
    landmarks = np.random.uniform(0, 1, (T_FRAMES, 21, 3)).astype(np.float32)
    return landmarks


def create_signer_disjoint_splits(
    metadata: dict,
    train_ratio: float = TRAIN_RATIO,
    val_ratio: float = VAL_RATIO,
) -> Tuple[set, set, set]:
    """Split signers (not videos) into train/val/test sets.
    
    This ensures no signer appears in multiple splits, preventing data leakage.
    """
    # Collect all unique signer IDs
    all_signers = set()
    for entry in metadata:
        for instance in entry.get("instances", []):
            all_signers.add(instance["signer_id"])
    
    # Sort for deterministic splits
    all_signers = sorted(all_signers)
    np.random.seed(42)
    np.random.shuffle(all_signers)
    
    n = len(all_signers)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))
    
    train_signers = set(all_signers[:train_end])
    val_signers = set(all_signers[train_end:val_end])
    test_signers = set(all_signers[val_end:])
    
    return train_signers, val_signers, test_signers


def load_split(
    metadata: dict,
    split_signers: set,
    split_name: str,
) -> Tuple[np.ndarray, np.ndarray, list]:
    """Load all videos for a given split, extract landmarks, and return tensors.
    
    Returns:
        X: (N, 45, 21, 3) landmark sequences
        y: (N,) class labels
        labels: list of class names
    """
    # Collect videos for this split
    videos_by_class = {}
    for entry in metadata:
        gloss = entry["gloss"]
        instances = [
            inst for inst in entry.get("instances", [])
            if inst["signer_id"] in split_signers
        ]
        if instances:
            videos_by_class[gloss] = instances
    
    # Extract landmarks
    all_X = []
    all_y = []
    labels = sorted(videos_by_class.keys())
    label_to_idx = {label: i for i, label in enumerate(labels)}
    
    for gloss, instances in videos_by_class.items():
        for inst in instances:
            # In production: landmarks = extract_landmarks_from_video(inst["video_path"])
            # Placeholder for now:
            landmarks = extract_landmarks_from_video("placeholder.mp4")
            all_X.append(landmarks)
            all_y.append(label_to_idx[gloss])
    
    if not all_X:
        # Return empty arrays with correct shape
        return (
            np.empty((0, *DYNAMIC_SHAPE), dtype=np.float32),
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
    parser = argparse.ArgumentParser(description="Load WLASL2000 dataset")
    parser.add_argument("--split", choices=["train", "val", "test"], required=True)
    parser.add_argument("--metadata", default="data/wlasl2000.json", help="Path to WLASL JSON")
    parser.add_argument("--force-rebuild", action="store_true", help="Rebuild cache even if it exists")
    args = parser.parse_args()
    
    # Check cache first
    if not args.force_rebuild:
        cached = load_cache(args.split)
        if cached is not None:
            X, y, labels = cached
            print(f"WLASL {args.split}: loaded from cache — X={X.shape}, y={y.shape}, {len(labels)} classes")
            return
    
    # Load metadata
    if not os.path.exists(args.metadata):
        print(f"WARNING: WLASL metadata not found at {args.metadata}")
        print("  To use real WLASL data:")
        print("  1. Download from https://dx.doi.org/10.1145/3394171.3413730")
        print("  2. Place JSON at data/wlasl2000.json")
        print("  3. Run: python -m ml.data.wlasl --split train --force-rebuild")
        print("  Returning placeholder data for pipeline testing...")
        
        # Return placeholder for pipeline testing
        X = np.random.uniform(0, 1, (100, *DYNAMIC_SHAPE)).astype(np.float32)
        y = np.random.randint(0, 8, (100,), dtype=np.int64)
        labels = ["HELLO", "GOODBYE", "YES", "NO", "PLEASE", "THANKS", "SORRY", "HELP"]
        save_cache(X, y, labels, args.split)
        return
    
    metadata = load_wlasl_metadata(args.metadata)
    
    # Create signer-disjoint splits
    train_signers, val_signers, test_signers = create_signer_disjoint_splits(metadata)
    
    split_signers = {
        "train": train_signers,
        "val": val_signers,
        "test": test_signers,
    }[args.split]
    
    print(f"WLASL {args.split}: {len(split_signers)} signers")
    
    # Extract and cache
    X, y, labels = load_split(metadata, split_signers, args.split)
    save_cache(X, y, labels, args.split)
    
    print(f"WLASL {args.split}: X={X.shape}, y={y.shape}, {len(labels)} classes")


if __name__ == "__main__":
    main()
