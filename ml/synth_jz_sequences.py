"""
Synthetic sequence generator for ASL motion letters J and Z.

J: Pinky extended, traces a J-shaped curve (down then left hook)
Z: Index extended, traces a Z-shaped zigzag (right, diagonal-left, right)

Both letters use a static handshape for the non-tracing fingers while
the active finger traces its characteristic path over T frames.

Output shape contract:
  X : (N, T, 21, 3)  float32  with T = 30 frames (~1s @ 30 FPS)
  y : (N,)           int64    0=J, 1=Z
"""
from __future__ import annotations
import numpy as np

T_FRAMES = 30
N_LANDMARKS = 21

LABELS = ["J", "Z"]

# -- helper: build handshape templates -----------------------------------

def _open_hand(scale: float = 1.0):
    """Return a (21, 3) baseline open-hand layout in palm-local coords."""
    pts = np.zeros((N_LANDMARKS, 3), dtype=np.float32)
    pts[0] = [0, 0, 0]                     # wrist
    pts[5]  = [-0.30, -0.45, 0]            # index MCP
    pts[9]  = [-0.10, -0.55, 0]            # middle MCP
    pts[13] = [ 0.10, -0.50, 0]            # ring MCP
    pts[17] = [ 0.30, -0.40, 0]            # pinky MCP
    pts[2]  = [-0.50, -0.05, 0]            # thumb MCP
    for tip, pip, mcp, dy in [
        (4, 3, 2, -0.55),
        (8, 6, 5, -0.55),
        (12, 10, 9, -0.65),
        (16, 14, 13, -0.55),
        (20, 18, 17, -0.45),
    ]:
        pts[pip] = pts[mcp] + np.array([0, dy * 0.45, 0], dtype=np.float32)
        pts[tip] = pts[mcp] + np.array([0, dy, 0], dtype=np.float32)
    pts[2] = pts[5] + np.array([-0.20, 0.20, 0], dtype=np.float32)
    pts[3] = pts[2] + np.array([-0.18, -0.10, 0], dtype=np.float32)
    pts[4] = pts[3] + np.array([-0.18, -0.10, 0], dtype=np.float32)
    return pts * scale

def _closed_fist(scale: float = 1.0):
    """Closed fist: tips folded toward palm."""
    pts = _open_hand(scale).copy()
    for tip, mcp in [(8,5),(12,9),(16,13),(20,17)]:
        pts[tip] = pts[mcp] + (pts[0] - pts[mcp]) * 0.4
    return pts

def _j_handshape(scale: float = 1.0):
    """J handshape: pinky extended, all other fingers curled (like I)."""
    pts = _closed_fist(scale).copy()
    # Extend pinky
    pts[18] = pts[17] + np.array([0, -0.20, 0], dtype=np.float32)
    pts[19] = pts[17] + np.array([0, -0.35, 0], dtype=np.float32)
    pts[20] = pts[17] + np.array([0, -0.50, 0], dtype=np.float32)
    return pts

def _z_handshape(scale: float = 1.0):
    """Z handshape: index extended, all other fingers curled (like D)."""
    pts = _closed_fist(scale).copy()
    # Extend index
    pts[6]  = pts[5]  + np.array([0, -0.25, 0], dtype=np.float32)
    pts[7]  = pts[5]  + np.array([0, -0.40, 0], dtype=np.float32)
    pts[8]  = pts[5]  + np.array([0, -0.55, 0], dtype=np.float32)
    # Thumb extended to side (like D)
    pts[2] = pts[5] + np.array([-0.15, 0.15, 0], dtype=np.float32)
    pts[3] = pts[2] + np.array([-0.12, -0.05, 0], dtype=np.float32)
    pts[4] = pts[3] + np.array([-0.12, -0.05, 0], dtype=np.float32)
    return pts

# -- trajectory generators ------------------------------------------------

def _j_trajectory(t: int, T: int, base_tip: np.ndarray) -> np.ndarray:
    """J trajectory: pinky tip traces J shape (down, then hook left).

    Phase 0-40%: move down
    Phase 40-100%: hook left and slightly up (the J curve)
    """
    phase = t / max(T - 1, 1)
    if phase < 0.4:
        # Downward stroke
        alpha = phase / 0.4
        offset = np.array([0, -0.30 * alpha, 0], dtype=np.float32)
    else:
        # Hook left (J curve)
        alpha = (phase - 0.4) / 0.6
        # Leftward arc with slight upward curve
        angle = np.pi * alpha * 0.8  # ~144 degree arc
        dx = -0.25 * np.sin(angle)
        dy = -0.30 + 0.10 * np.sin(angle * 0.5)
        offset = np.array([dx, dy, 0], dtype=np.float32)
    return base_tip + offset

def _z_trajectory(t: int, T: int, base_tip: np.ndarray) -> np.ndarray:
    """Z trajectory: index tip traces Z shape (right, diagonal-left, right).

    Phase 0-33%: move right
    Phase 33-66%: diagonal down-left
    Phase 66-100%: move right
    """
    phase = t / max(T - 1, 1)
    if phase < 0.33:
        # Rightward stroke
        alpha = phase / 0.33
        offset = np.array([0.25 * alpha, 0, 0], dtype=np.float32)
    elif phase < 0.66:
        # Diagonal down-left
        alpha = (phase - 0.33) / 0.33
        offset = np.array([0.25 - 0.25 * alpha, -0.15 * alpha, 0], dtype=np.float32)
    else:
        # Rightward stroke
        alpha = (phase - 0.66) / 0.34
        offset = np.array([-0.0 + 0.25 * alpha, -0.15, 0], dtype=np.float32)
    return base_tip + offset

# -- dataset generation ---------------------------------------------------

def _apply_noise(landmarks: np.ndarray, rng: np.random.Generator,
                 jitter: float = 0.008, rotation_deg: float = 12,
                 scale_var: float = 0.08) -> np.ndarray:
    """Add realistic variation to a single frame."""
    pts = landmarks.copy()
    # Random rotation in image plane
    deg = rng.uniform(-rotation_deg, rotation_deg)
    rot = np.deg2rad(deg)
    R = np.array([[np.cos(rot), -np.sin(rot), 0],
                  [np.sin(rot),  np.cos(rot), 0],
                  [0,            0,           1]], dtype=np.float32)
    anchor = pts[0:1, :].copy()
    pts = ((pts - anchor) @ R.T) + anchor
    # Scale variation
    s = rng.uniform(1.0 - scale_var, 1.0 + scale_var)
    pts = (pts - anchor) * s + anchor
    # Landmark noise
    pts += rng.normal(0, jitter, pts.shape).astype(np.float32)
    return pts

def _generate_j_sequence(rng: np.random.Generator, T: int = T_FRAMES) -> np.ndarray:
    """Generate a single J sequence (T, 21, 3)."""
    base = _j_handshape()
    pinky_tip_base = base[20].copy()
    sequence = np.zeros((T, N_LANDMARKS, 3), dtype=np.float32)

    for t in range(T):
        frame = base.copy()
        # Move pinky tip along J trajectory
        frame[20] = _j_trajectory(t, T, pinky_tip_base)
        # Slight movement of pinky PIP/DIP to follow
        frame[19] = frame[20] + (base[19] - pinky_tip_base) * 0.5
        frame[18] = frame[19] + (base[18] - base[19]) * 0.7
        # Add noise
        frame = _apply_noise(frame, rng)
        # Wrist drift
        frame[:, 0] += rng.uniform(-0.02, 0.02)
        frame[:, 1] += rng.uniform(-0.02, 0.02)
        sequence[t] = frame
    return sequence

def _generate_z_sequence(rng: np.random.Generator, T: int = T_FRAMES) -> np.ndarray:
    """Generate a single Z sequence (T, 21, 3)."""
    base = _z_handshape()
    index_tip_base = base[8].copy()
    sequence = np.zeros((T, N_LANDMARKS, 3), dtype=np.float32)

    for t in range(T):
        frame = base.copy()
        # Move index tip along Z trajectory
        frame[8] = _z_trajectory(t, T, index_tip_base)
        # Slight movement of index PIP/DIP to follow
        frame[7] = frame[8] + (base[7] - index_tip_base) * 0.5
        frame[6] = frame[7] + (base[6] - base[7]) * 0.7
        # Add noise
        frame = _apply_noise(frame, rng)
        # Wrist drift
        frame[:, 0] += rng.uniform(-0.02, 0.02)
        frame[:, 1] += rng.uniform(-0.02, 0.02)
        sequence[t] = frame
    return sequence

def make_dataset(n_per_class: int = 500, T: int = T_FRAMES,
                 seed: int = 42) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Generate synthetic J/Z sequence dataset.

    Returns:
        X: (N, T, 21, 3) float32
        y: (N,) int64 (0=J, 1=Z)
        labels: ["J", "Z"]
    """
    rng = np.random.default_rng(seed)
    sequences = []
    labels_arr = []

    for i in range(n_per_class):
        sequences.append(_generate_j_sequence(rng, T))
        labels_arr.append(0)
        sequences.append(_generate_z_sequence(rng, T))
        labels_arr.append(1)

    X = np.stack(sequences, axis=0)
    y = np.array(labels_arr, dtype=np.int64)
    return X, y, LABELS

if __name__ == "__main__":
    X, y, labels = make_dataset(n_per_class=100)
    print(f"X shape: {X.shape}")
    print(f"y shape: {y.shape}")
    print(f"Labels: {labels}")
    print(f"Class distribution: J={np.sum(y==0)}, Z={np.sum(y==1)}")
