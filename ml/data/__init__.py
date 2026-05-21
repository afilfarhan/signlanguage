"""
ml/data/ — Real dataset loaders for SignTutor v2 (W1)

Each loader emits identical shapes to the synthetic generators:
  - Static:  (N, 21, 3)  hand landmarks
  - Dynamic: (N, 45, 21, 3)  hand landmark sequences

All loaders support:
  - `--source` CLI flag to select dataset
  - Signer-disjoint train/val/test splits
  - Caching to ml/data/cache/{dataset}/{split}.npz

Usage:
    python -m ml.data.wlasl --split train
    python -m ml.data.chicago_fs --split test
"""
