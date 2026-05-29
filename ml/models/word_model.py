"""
Word-level ASL recognition model — Transformer Encoder with optional frozen backbone.

Architecture:
    Input projection (126 -> d_model)
    + Learned positional embedding
    -> N × TransformerEncoderLayer (Pre-LN, GELU)
    -> Adaptive average pool over time
    -> Classification head (d_model -> vocab_size)

Supports:
    - Loading existing DynamicTransformerV2 weights as frozen backbone
    - CTC head (for sentence-level, future)
    - ONNX export with dynamic batch axis

Config driven via WordModelConfig or CLI args.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import Optional

import torch
import torch.nn as nn
import numpy as np


@dataclass
class WordModelConfig:
    vocab_size: int = 100
    t_frames: int = 60
    feature_dim: int = 126
    d_model: int = 128
    n_heads: int = 8
    n_layers: int = 4
    ff_dim: int = 256
    dropout: float = 0.1
    mode: str = "word"
    head_type: str = "softmax"
    ctc_blank: int = -1
    pretrained_path: Optional[str] = None
    freeze_encoder: bool = False

    def save(self, path: str):
        with open(path, "w") as f:
            json.dump(asdict(self), f, indent=2)

    @classmethod
    def load(cls, path: str) -> "WordModelConfig":
        with open(path) as f:
            return cls(**json.load(f))


class WordTransformer(nn.Module):
    """Transformer encoder for word-level sign language recognition."""

    def __init__(self, config: WordModelConfig):
        super().__init__()
        self.config = config

        self.input_proj = nn.Linear(config.feature_dim, config.d_model)
        self.pos_emb = nn.Embedding(config.t_frames, config.d_model)
        nn.init.trunc_normal_(self.pos_emb.weight, std=0.02)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=config.d_model,
            nhead=config.n_heads,
            dim_feedforward=config.ff_dim,
            dropout=config.dropout,
            batch_first=True,
            norm_first=True,
            activation="gelu",
        )
        self.encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=config.n_layers
        )
        self.pool = nn.AdaptiveAvgPool1d(1)

        if config.head_type == "softmax":
            self.classifier = nn.Linear(config.d_model, config.vocab_size)
        elif config.head_type == "ctc":
            self.ctc_blank = config.vocab_size
            self.classifier = nn.Linear(config.d_model, config.vocab_size + 1)
        else:
            raise ValueError(f"Unknown head_type: {config.head_type}")

        self._load_pretrained(config)

    def _load_pretrained(self, config: WordModelConfig):
        if config.pretrained_path is None:
            return
        import os
        if not os.path.exists(config.pretrained_path):
            print(f"WARNING: pretrained weights not found at {config.pretrained_path}")
            return
        state = torch.load(config.pretrained_path, map_location="cpu", weights_only=False)
        own_state = self.state_dict()
        loaded, skipped = 0, 0
        for k, v in state.items():
            if k in own_state and own_state[k].shape == v.shape:
                own_state[k] = v
                loaded += 1
            else:
                skipped += 1
        self.load_state_dict(own_state)
        print(f"Loaded {loaded} pretrained params, skipped {skipped} (shape mismatch)")
        if config.freeze_encoder:
            for name, param in self.named_parameters():
                if "classifier" not in name:
                    param.requires_grad = False
            trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
            total = sum(p.numel() for p in self.parameters())
            print(f"Froze encoder: {trainable:,} trainable / {total:,} total params")

    def forward(self, x: torch.Tensor):
        B, T, D = x.shape
        positions = torch.arange(T, device=x.device)
        h = self.input_proj(x) + self.pos_emb(positions)
        h = self.encoder(h)
        emb = self.pool(h.transpose(1, 2)).squeeze(-1)
        logits = self.classifier(emb)
        return logits, emb

    def forward_with_embedding(self, x: torch.Tensor):
        B, T, D = x.shape
        positions = torch.arange(T, device=x.device)
        h = self.input_proj(x) + self.pos_emb(positions)
        h = self.encoder(h)
        emb = self.pool(h.transpose(1, 2)).squeeze(-1)
        logits = self.classifier(emb)
        return logits, emb

    def export_onnx(self, path: str, opset: int = 17):
        dummy = torch.randn(1, self.config.t_frames, self.config.feature_dim, dtype=torch.float32)
        outputs = ["logits", "embedding"]
        torch.onnx.export(
            self,
            dummy,
            path,
            input_names=["sequence"],
            output_names=outputs,
            dynamic_axes={
                "sequence": {0: "batch"},
                "logits": {0: "batch"},
                "embedding": {0: "batch"},
            },
            opset_version=opset,
            do_constant_folding=True,
            dynamo=False,
        )
        size_kb = os.path.getsize(path) / 1024
        print(f"Exported ONNX: {path} ({size_kb:.1f} KB)")


import os

class SignSegmenter:
    """Heuristic sign boundary detection using wrist velocity.

    Detects sign boundaries when wrist velocity drops below a threshold
    for a minimum number of consecutive frames (pause/rest detection).
    """

    def __init__(self, velocity_threshold: float = 0.01, min_pause_frames: int = 5):
        self.velocity_threshold = velocity_threshold
        self.min_pause_frames = min_pause_frames
        self._pause_count = 0

    def compute_wrist_velocity(self, frame_landmarks: np.ndarray, prev_landmarks: np.ndarray | None) -> float:
        if prev_landmarks is None:
            return 0.0
        wrist_delta = frame_landmarks[0] - prev_landmarks[0]
        return float(np.linalg.norm(wrist_delta))

    def is_boundary(self, frame_landmarks: np.ndarray, prev_landmarks: np.ndarray | None) -> bool:
        vel = self.compute_wrist_velocity(frame_landmarks, prev_landmarks)
        if vel < self.velocity_threshold:
            self._pause_count += 1
        else:
            self._pause_count = 0
        return self._pause_count >= self.min_pause_frames

    def reset(self):
        self._pause_count = 0


class WordCTCHead(nn.Module):
    """CTC classification head for sentence-level recognition (future).

    Wraps a WordTransformer with CTC-compatible output (vocab_size + 1 blank).
    """

    def __init__(self, config: WordModelConfig):
        super().__init__()
        if config.head_type != "ctc":
            config.head_type = "ctc"
            config.ctc_blank = config.vocab_size
        self.config = config
        self.model = WordTransformer(config)
        self.blank_idx = config.vocab_size

    def forward(self, x: torch.Tensor, lengths: torch.Tensor | None = None):
        B, T, D = x.shape
        positions = torch.arange(T, device=x.device)
        h = self.model.input_proj(x) + self.model.pos_emb(positions)
        h = self.model.encoder(h)
        h_pooled = h
        logits = self.model.classifier(h_pooled)
        log_probs = torch.nn.functional.log_softmax(logits, dim=-1)
        if lengths is None:
            lengths = torch.full((B,), T, dtype=torch.long, device=x.device)
        return log_probs, lengths
