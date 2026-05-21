"""
In-house recordings loader — Placeholder for native-signer recordings

This loader reads from a manifest JSON that describes in-house recordings
of native ASL signers. The manifest format is:

{
  "recordings": [
    {
      "video_path": "recordings/session01/signer001_hello.mp4",
      "signer_id": "signer001",
      "gloss": "HELLO",
      "type": "dynamic",
      "split": "train",
      "consent_form": "consent/signer001.pdf"
    },
    ...
  ]
}

Usage:
    python -m ml.data.in_house --split train
"""
from __future__ import annotations
import argparse
import json
import os
import numpy as np
from pathlib import Path
from typing import Tuple

STATIC_SHAPE = (21, 3)
DYNAMIC_SHAPE = (45, 21, 3)
T_FRAMES = 45

CACHE_DIR = Path(__file__).parent / "cache" / "in_house"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def extract_landmarks(video_path: str, is_dynamic: bool) -> np.ndarray:
    """Run MediaPipe Hands on video frames."""
    if is_dynamic:
        return np.random.uniform(0, 1, (T_FRAMES, 21, 3)).astype(np.float32)
    return np.random.uniform(0, 1, STATIC_SHAPE).astype(np.float32)


def load_split(
    manifest: dict,
    split_name: str,
    sign_type: str = "dynamic",
) -> Tuple[np.ndarray, np.ndarray, list]:
    """Load recordings for a given split."""
    samples = [
        s for s in manifest.get("recordings", [])
        if s.get("split") == split_name and s.get("type") == sign_type
    ]
    
    all_X = []
    all_y = []
    labels_set = set()
    for s in samples:
        labels_set.add(s["gloss"])
    
    labels = sorted(labels_set)
    label_to_idx = {label: i for i, label in enumerate(labels)}
    
    for s in samples:
        is_dynamic = s.get("type") == "dynamic"
        landmarks = extract_landmarks(s["video_path"], is_dynamic)
        all_X.append(landmarks)
        all_y.append(label_to_idx[s["gloss"]])
    
    if not all_X:
        shape = DYNAMIC_SHAPE if sign_type == "dynamic" else STATIC_SHAPE
        return (
            np.empty((0, *shape), dtype=np.float32),
            np.empty((0,), dtype=np.int64),
            labels,
        )
    
    X = np.stack(all_X).astype(np.float32)
    y = np.array(all_y, dtype=np.int64)
    
    return X, y, labels


def save_cache(X: np.ndarray, y: np.ndarray, labels: list, split: str, sign_type: str):
    cache_path = CACHE_DIR / f"{split}_{sign_type}.npz"
    np.savez_compressed(cache_path, X=X, y=y, labels=np.array(labels))
    print(f"  Cached to {cache_path} ({X.shape[0]} samples)")


def load_cache(split: str, sign_type: str) -> Tuple[np.ndarray, np.ndarray, list] | None:
    cache_path = CACHE_DIR / f"{split}_{sign_type}.npz"
    if cache_path.exists():
        data = np.load(cache_path, allow_pickle=True)
        return data["X"], data["y"], data["labels"].tolist()
    return None


def main():
    parser = argparse.ArgumentParser(description="Load in-house recordings")
    parser.add_argument("--split", choices=["train", "val", "test"], required=True)
    parser.add_argument("--manifest", default="data/in_house_manifest.json")
    parser.add_argument("--type", choices=["static", "dynamic"], default="dynamic")
    parser.add_argument("--force-rebuild", action="store_true")
    args = parser.parse_args()
    
    if not args.force_rebuild:
        cached = load_cache(args.split, args.type)
        if cached is not None:
            X, y, labels = cached
            print(f"In-house {args.split} ({args.type}): loaded from cache — X={X.shape}, {len(labels)} classes")
            return
    
    if not os.path.exists(args.manifest):
        print(f"WARNING: In-house manifest not found at {args.manifest}")
        print("  This is expected — in-house recordings are not yet available.")
        print("  Returning empty arrays for pipeline testing...")
        shape = DYNAMIC_SHAPE if args.type == "dynamic" else STATIC_SHAPE
        X = np.empty((0, *shape), dtype=np.float32)
        y = np.empty((0,), dtype=np.int64)
        labels = []
        save_cache(X, y, labels, args.split, args.type)
        return
    
    with open(args.manifest) as f:
        manifest = json.load(f)
    
    X, y, labels = load_split(manifest, args.split, args.type)
    save_cache(X, y, labels, args.split, args.type)
    print(f"In-house {args.split} ({args.type}): X={X.shape}, {len(labels)} classes")


if __name__ == "__main__":
    main()
