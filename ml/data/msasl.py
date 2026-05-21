"""
MS-ASL loader — Microsoft American Sign Language dataset

Source: https://www.microsoft.com/en-us/research/project/ms-asl/
Classes: 1,000 ASL signs
Signers: 222 unique signers
Format: MP4 videos with per-video signer ID

Use case: Cross-dataset evaluation (not primary training)

Usage:
    python -m ml.data.msasl --split test
"""
from __future__ import annotations
import argparse
import json
import os
import numpy as np
from pathlib import Path
from typing import Tuple

# Expected output shapes
DYNAMIC_SHAPE = (45, 21, 3)
T_FRAMES = 45

CACHE_DIR = Path(__file__).parent / "cache" / "msasl"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def extract_landmarks_from_video(video_path: str) -> np.ndarray:
    """Run MediaPipe Hands offline to extract landmarks from a single video."""
    # Placeholder
    landmarks = np.random.uniform(0, 1, (T_FRAMES, 21, 3)).astype(np.float32)
    return landmarks


def load_split(
    manifest: dict,
    split_name: str,
) -> Tuple[np.ndarray, np.ndarray, list]:
    """Load all videos for a given split."""
    videos_by_class = {}
    for entry in manifest.get("samples", []):
        if entry.get("split") == split_name:
            gloss = entry["gloss"]
            videos_by_class.setdefault(gloss, []).append(entry)
    
    all_X = []
    all_y = []
    labels = sorted(videos_by_class.keys())
    label_to_idx = {label: i for i, label in enumerate(labels)}
    
    for gloss, entries in videos_by_class.items():
        for entry in entries:
            landmarks = extract_landmarks_from_video(entry.get("video_path", "placeholder.mp4"))
            all_X.append(landmarks)
            all_y.append(label_to_idx[gloss])
    
    if not all_X:
        return (
            np.empty((0, *DYNAMIC_SHAPE), dtype=np.float32),
            np.empty((0,), dtype=np.int64),
            labels,
        )
    
    X = np.stack(all_X).astype(np.float32)
    y = np.array(all_y, dtype=np.int64)
    
    return X, y, labels


def save_cache(X: np.ndarray, y: np.ndarray, labels: list, split: str):
    cache_path = CACHE_DIR / f"{split}.npz"
    np.savez_compressed(cache_path, X=X, y=y, labels=np.array(labels))
    print(f"  Cached to {cache_path} ({X.shape[0]} samples)")


def load_cache(split: str) -> Tuple[np.ndarray, np.ndarray, list] | None:
    cache_path = CACHE_DIR / f"{split}.npz"
    if cache_path.exists():
        data = np.load(cache_path, allow_pickle=True)
        return data["X"], data["y"], data["labels"].tolist()
    return None


def main():
    parser = argparse.ArgumentParser(description="Load MS-ASL dataset")
    parser.add_argument("--split", choices=["train", "val", "test"], required=True)
    parser.add_argument("--manifest", default="data/msasl_manifest.json")
    parser.add_argument("--force-rebuild", action="store_true")
    args = parser.parse_args()
    
    if not args.force_rebuild:
        cached = load_cache(args.split)
        if cached is not None:
            X, y, labels = cached
            print(f"MS-ASL {args.split}: loaded from cache — X={X.shape}, {len(labels)} classes")
            return
    
    if not os.path.exists(args.manifest):
        print(f"WARNING: MS-ASL manifest not found at {args.manifest}")
        print("  Returning placeholder data for pipeline testing...")
        X = np.random.uniform(0, 1, (100, *DYNAMIC_SHAPE)).astype(np.float32)
        y = np.random.randint(0, 8, (100,), dtype=np.int64)
        labels = ["HELLO", "GOODBYE", "YES", "NO", "PLEASE", "THANKS", "SORRY", "HELP"]
        save_cache(X, y, labels, args.split)
        return
    
    with open(args.manifest) as f:
        manifest = json.load(f)
    
    X, y, labels = load_split(manifest, args.split)
    save_cache(X, y, labels, args.split)
    print(f"MS-ASL {args.split}: X={X.shape}, {len(labels)} classes")


if __name__ == "__main__":
    main()
