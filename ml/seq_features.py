"""
Sequence-level feature normalization for the dynamic-sign model.

Key design decision (and a fix on the first version of this file):
We normalize the *entire sequence as a whole*, not each frame independently.
Per-frame translation would put the wrist at the origin of every frame and
destroy the global trajectory — but trajectory is exactly what distinguishes
"HELLO" (forehead → outward) from "THANKS" (chin → outward) from "PLEASE"
(circular at chest). The model needs to see *where* the hand moves over time.

Per-sequence pipeline (applied identically in Python at training time and in
JS at inference time):

  1. Compute the hand scale once from the first frame (wrist→middle-MCP distance).
  2. Translate every frame by the *first-frame wrist* position. Camera framing
     is removed, but the relative trajectory of the wrist across frames is kept.
  3. Divide every frame by the same hand scale. Hand size is removed.
  4. Append per-frame velocity (delta vs. previous frame) to make motion
     direction explicit (helps the Transformer with short windows).

Final feature vector per frame: 21*3 (positions) + 21*3 (velocities) = 126 floats.
Sequence shape into the model: (T, 126), with T=45.
"""
import numpy as np

WRIST = 0
MIDDLE_MCP = 9

def normalize_sequence(seq: np.ndarray) -> np.ndarray:
    """seq: (T, 21, 3) -> (T, 126)."""
    T = seq.shape[0]
    pos = seq.astype(np.float32).copy()

    # 1. Translate the whole sequence by the first-frame wrist (preserves trajectory).
    anchor = pos[0, WRIST:WRIST+1, :].copy()         # (1, 3)
    pos -= anchor[None, :, :]                        # broadcast over (T, 21, 3)

    # 2. One global scale from the first frame's hand span.
    scale_xy = np.linalg.norm(pos[0, MIDDLE_MCP, :2])
    if scale_xy < 1e-6:
        scale_xy = 1.0
    pos /= scale_xy

    # 3. Velocities from the normalized positions.
    vel = np.zeros_like(pos)
    vel[1:] = pos[1:] - pos[:-1]

    out = np.concatenate(
        [pos.reshape(T, -1), vel.reshape(T, -1)], axis=1
    ).astype(np.float32)
    return out

def normalize_batch(X: np.ndarray) -> np.ndarray:
    """X: (N, T, 21, 3) -> (N, T, 126)."""
    return np.stack([normalize_sequence(s) for s in X], axis=0)
