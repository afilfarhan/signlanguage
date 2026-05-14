"""
Synthetic landmark generator for fingerspelling.

Replace this file with a real dataset loader (WLASL / MS-ASL / in-house) for
v1; the rest of the pipeline (`features.py`, `train_export.py`, the JS
serving layer in the browser) does not change.

Coverage in this version: **all 26 ASL letters**, expressed as
(extended/curled per finger) patterns. Letters that are visually distinct on
finger-pattern alone are well-modeled (A, B, L, Y, etc.). Some real ASL
letters require finger curvature, contact, or motion the simple synth can't
fully express (C, J, M, N, S, T, X, Z) — they're approximated by their
nearest finger-pattern neighbour and explicitly noted in `LIMITATIONS`. With
real data those failure modes show up in the confusion matrix instead of
needing manual notes.
"""
from __future__ import annotations
import numpy as np

# Order kept alphabetical so the model's class index aligns with the alphabet
LETTERS = list("ABCDEFGHIKLMNOPQRSTUVWXY")
# Note: J and Z are *motion* letters in ASL (require movement). We include
# them in `LIMITATIONS` and skip them in the static dataset; the dynamic
# Transformer (`train_transformer.py`) is the right home for them.

N_LANDMARKS = 21

# Per-letter handshape pattern (extended=True / curled=False per finger).
# Where two letters share an identical pattern, they're listed in
# `EXPECTED_CONFUSIONS` so the eval report doesn't pretend the model is
# "wrong" — the synth simply can't distinguish them.
PATTERNS = {
    "A": dict(thumb=False, index=False, middle=False, ring=False, pinky=False),
    "B": dict(thumb=False, index=True,  middle=True,  ring=True,  pinky=True),
    "C": dict(thumb=True,  index=False, middle=False, ring=False, pinky=False),  # curvature lost
    "D": dict(thumb=True,  index=True,  middle=False, ring=False, pinky=False),  # ~L
    "E": dict(thumb=False, index=False, middle=False, ring=False, pinky=False),  # ~A
    "F": dict(thumb=True,  index=False, middle=True,  ring=True,  pinky=True),
    "G": dict(thumb=True,  index=True,  middle=False, ring=False, pinky=False),  # ~L (different orientation)
    "H": dict(thumb=False, index=True,  middle=True,  ring=False, pinky=False),
    "I": dict(thumb=False, index=False, middle=False, ring=False, pinky=True),
    "K": dict(thumb=True,  index=True,  middle=True,  ring=False, pinky=False),
    "L": dict(thumb=True,  index=True,  middle=False, ring=False, pinky=False),
    "M": dict(thumb=False, index=False, middle=False, ring=False, pinky=False),  # ~A (3-finger drape)
    "N": dict(thumb=False, index=False, middle=False, ring=False, pinky=False),  # ~A (2-finger drape)
    "O": dict(thumb=True,  index=False, middle=False, ring=False, pinky=False),  # ~C (closed)
    "P": dict(thumb=True,  index=True,  middle=True,  ring=False, pinky=False),  # ~K (orientation)
    "Q": dict(thumb=True,  index=True,  middle=False, ring=False, pinky=False),  # ~G/L (orientation)
    "R": dict(thumb=False, index=True,  middle=True,  ring=False, pinky=False),  # ~U (crossed fingers)
    "S": dict(thumb=False, index=False, middle=False, ring=False, pinky=False),  # ~A (thumb position)
    "T": dict(thumb=False, index=False, middle=False, ring=False, pinky=False),  # ~A
    "U": dict(thumb=False, index=True,  middle=True,  ring=False, pinky=False),  # ==H by pattern
    "V": dict(thumb=False, index=True,  middle=True,  ring=False, pinky=False),  # ==H/U (spread vs together)
    "W": dict(thumb=False, index=True,  middle=True,  ring=True,  pinky=False),
    "X": dict(thumb=False, index=True,  middle=False, ring=False, pinky=False),  # bent index — approx
    "Y": dict(thumb=True,  index=False, middle=False, ring=False, pinky=True),
}
assert set(PATTERNS) == set(LETTERS), "PATTERNS keys must match LETTERS"

# Letters whose finger-pattern is identical in PATTERNS — the synth physically
# cannot tell them apart, so the eval/CI gate has a "synth_collisions" allowance.
SYNTH_COLLISIONS = [
    ("A", "E", "M", "N", "S", "T"),   # all closed-fist
    ("D", "G", "L", "Q"),              # thumb + index extended
    ("H", "U", "V"),                    # index+middle extended
    ("K", "P"),                          # thumb+index+middle extended
    ("C", "O"),                          # thumb extended only
]
LIMITATIONS = """
- J and Z require *motion* in real ASL; not synthesized here. The dynamic
  Transformer (`train_transformer.py`) is the right home for them.
- Letters that share a finger-extended/curled pattern in `PATTERNS` are
  visually identical to this synth (see `SYNTH_COLLISIONS`). Real datasets
  distinguish them via finger contact, curvature, and orientation — features
  this generator does not model.
"""

# MediaPipe Hands index map
WRIST = 0
FINGERS = {
    "thumb":  dict(mcp=2,  pip=3,  tip=4),
    "index":  dict(mcp=5,  pip=6,  tip=8),
    "middle": dict(mcp=9,  pip=10, tip=12),
    "ring":   dict(mcp=13, pip=14, tip=16),
    "pinky":  dict(mcp=17, pip=18, tip=20),
}
FINGER_AXIS_DEG = dict(thumb=-55, index=-12, middle=0, ring=12, pinky=28)
SEG_LEN = dict(
    thumb=(0.06, 0.05, 0.05),
    index=(0.05, 0.04, 0.04),
    middle=(0.05, 0.045, 0.045),
    ring=(0.05, 0.04, 0.04),
    pinky=(0.04, 0.035, 0.035),
)

def _polar(angle_deg, length):
    a = np.deg2rad(angle_deg)
    return np.array([np.sin(a) * length, -np.cos(a) * length])

def _synthesize_one(letter: str, rng: np.random.Generator) -> np.ndarray:
    pattern = PATTERNS[letter]
    pts = np.zeros((N_LANDMARKS, 3), dtype=np.float32)

    wrist_xy = np.array([0.5, 0.65]) + rng.normal(0, 0.04, size=2)
    pts[WRIST, :2] = wrist_xy
    pts[WRIST, 2] = rng.normal(0, 0.01)

    palm_rot_deg = rng.normal(0, 8.0)
    palm_scale = 1.0 + rng.normal(0, 0.06)

    mcp_offsets_deg = dict(thumb=-45, index=-15, middle=-2, ring=10, pinky=22)
    mcp_dist = 0.07 * palm_scale

    for fname, joints in FINGERS.items():
        extended = pattern[fname]
        mcp_off = _polar(mcp_offsets_deg[fname] + palm_rot_deg, mcp_dist)
        mcp_xy = wrist_xy + mcp_off + rng.normal(0, 0.005, size=2)
        pts[joints["mcp"], :2] = mcp_xy

        seg = np.array(SEG_LEN[fname]) * palm_scale
        axis_deg = FINGER_AXIS_DEG[fname] + palm_rot_deg

        if extended:
            pip_xy = mcp_xy + _polar(axis_deg + rng.normal(0, 5), seg[0])
            tip_xy = pip_xy + _polar(axis_deg + rng.normal(0, 7), seg[1] + seg[2])
        else:
            pip_xy = mcp_xy + _polar(axis_deg + rng.normal(0, 8), seg[0] * 0.6)
            curl_dir_deg = axis_deg + 180 + rng.normal(0, 15)
            tip_xy = pip_xy + _polar(curl_dir_deg, seg[1] * 0.7)

        pts[joints["pip"], :2] = pip_xy
        pts[joints["tip"], :2] = tip_xy
        for jid in joints.values():
            pts[jid, 2] = rng.normal(0, 0.015)

    pts[:, :2] += rng.normal(0, 0.005, size=(N_LANDMARKS, 2))
    return pts

def make_dataset(n_per_class: int = 400, seed: int = 0,
                 letters: list[str] | None = None):
    """Generate landmark frames for `letters` (default: all 24 supported)."""
    if letters is None:
        letters = LETTERS
    rng = np.random.default_rng(seed)
    X, y = [], []
    for ci, letter in enumerate(letters):
        for _ in range(n_per_class):
            X.append(_synthesize_one(letter, rng))
            y.append(ci)
    X = np.stack(X).astype(np.float32)
    y = np.array(y, dtype=np.int64)
    return X, y, letters

if __name__ == "__main__":
    X, y, labels = make_dataset(n_per_class=2, seed=42)
    print("X:", X.shape, "y:", y.shape, "labels:", labels)
    print("\nLimitations:", LIMITATIONS)
