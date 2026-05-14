"""
Synthetic sign-language *sequence* generator.

Each example is a (T, 21, 3) tensor: T frames of 21 hand landmarks (x, y, z),
mirroring MediaPipe Hands output. We synthesize 8 isolated signs whose motion
is described by a small templating language so the dataset is reproducible
*and* the test cases for the model are explicit:

  - HELLO   : right hand starts near forehead, salutes outward (extended hand)
  - GOODBYE : open hand at chest, fingers wave (curl/uncurl) - 2 cycles
  - YES     : closed fist, nods up-down twice (vertical bob)
  - NO      : index+middle extended, "snap" closed twice (pinch)
  - PLEASE  : flat hand on chest, circular motion
  - THANKS  : flat hand from chin moving outward
  - SORRY   : closed fist on chest, circular motion
  - HELP    : closed fist on flat palm, lifts upward together

Why synthetic?
- Same rationale as `synth_landmarks.py`: we want the training/eval/export
  loop to be real *today*. Replace this file with a WLASL/MS-ASL loader for v1.

Output shape contract:
  X : (N, T, 21, 3)  float32  with T = 45 frames (~1.5s @ 30 FPS)
  y : (N,)           int64
"""
from __future__ import annotations
import numpy as np

T_FRAMES = 45
N_LANDMARKS = 21

LABELS = ["HELLO", "GOODBYE", "YES", "NO", "PLEASE", "THANKS", "SORRY", "HELP"]

# -- helper: build a base "open hand" landmark template --------------------
def _open_hand(scale: float = 1.0):
    """Return a (21, 3) baseline open-hand layout in palm-local coords."""
    pts = np.zeros((N_LANDMARKS, 3), dtype=np.float32)
    pts[0] = [0, 0, 0]                     # wrist
    pts[5]  = [-0.30, -0.45, 0]            # index MCP
    pts[9]  = [-0.10, -0.55, 0]            # middle MCP
    pts[13] = [ 0.10, -0.50, 0]            # ring MCP
    pts[17] = [ 0.30, -0.40, 0]            # pinky MCP
    pts[2]  = [-0.50, -0.05, 0]            # thumb MCP
    # phalanges (rough but consistent)
    for tip, pip, mcp, dy in [
        (4, 3, 2, -0.55),   # thumb (mostly to the side)
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

def _index_middle_extended(scale: float = 1.0):
    """Two-finger 'V' shape (used for NO)."""
    pts = _closed_fist(scale).copy()
    pts[6]  = pts[5]  + np.array([0, -0.30, 0], dtype=np.float32)
    pts[8]  = pts[5]  + np.array([0, -0.55, 0], dtype=np.float32)
    pts[10] = pts[9]  + np.array([0, -0.30, 0], dtype=np.float32)
    pts[12] = pts[9]  + np.array([0, -0.55, 0], dtype=np.float32)
    return pts

def _flat_hand(scale: float = 1.0):
    """Flat extended hand."""
    return _open_hand(scale)

# -- per-sign trajectories -------------------------------------------------
def _interp(a, b, alpha):
    return a * (1 - alpha) + b * alpha

def _wrist_path(name: str, t: np.ndarray):
    """Return wrist (x,y,z) per frame in image space (x,y in [0,1])."""
    # t in [0, 1]
    if name == "HELLO":
        # forehead -> outward right
        x = _interp(0.55, 0.85, t)
        y = _interp(0.18, 0.30, t)
    elif name == "GOODBYE":
        # roughly stationary at chest, slight up-down (waving)
        x = 0.55 + 0.02 * np.sin(2 * np.pi * 2 * t)
        y = 0.45 + 0.02 * np.sin(2 * np.pi * 2 * t)
    elif name == "YES":
        # vertical bob, near chest
        x = 0.55 + 0.005 * np.sin(2 * np.pi * 1 * t)
        y = 0.45 + 0.06 * np.sin(2 * np.pi * 2 * t)
    elif name == "NO":
        # near face; snap motion encoded in the *finger* curl, wrist mostly still
        x = 0.50 + 0.01 * np.sin(2 * np.pi * 2 * t)
        y = 0.32 + 0.005 * np.sin(2 * np.pi * 2 * t)
    elif name == "PLEASE":
        # circular at chest
        x = 0.55 + 0.05 * np.cos(2 * np.pi * 1 * t)
        y = 0.50 + 0.05 * np.sin(2 * np.pi * 1 * t)
    elif name == "THANKS":
        # chin -> outward (down + right)
        x = _interp(0.50, 0.70, t)
        y = _interp(0.30, 0.45, t)
    elif name == "SORRY":
        # circular at chest, smaller and slower than PLEASE
        x = 0.55 + 0.03 * np.cos(2 * np.pi * 1 * t)
        y = 0.50 + 0.03 * np.sin(2 * np.pi * 1 * t)
    elif name == "HELP":
        # straight up lift
        x = 0.55 + 0.0 * t
        y = _interp(0.55, 0.35, t)
    else:
        raise ValueError(name)
    z = np.zeros_like(x)
    return np.stack([x, y, z], axis=-1).astype(np.float32)  # (T, 3)

def _hand_shape_for_frame(name: str, alpha: float):
    """Return (21, 3) palm-local landmarks for this sign at fraction `alpha` (0..1) of the motion."""
    if name == "HELLO":
        return _flat_hand()
    if name == "GOODBYE":
        # Fingers periodically curl/uncurl ("waving")
        phase = 0.5 * (1 + np.sin(2 * np.pi * 2 * alpha))  # 0..1
        return _flat_hand() * (1 - 0.0) + (_closed_fist() - _flat_hand()) * (0.4 * phase)
    if name == "YES":
        return _closed_fist()
    if name == "NO":
        # "Snap": V-shape closes to fist twice across the clip
        phase = 0.5 * (1 + np.sin(2 * np.pi * 2 * alpha))
        return _index_middle_extended() * (1 - phase) + _closed_fist() * phase
    if name == "PLEASE":
        return _flat_hand()
    if name == "THANKS":
        return _flat_hand()
    if name == "SORRY":
        return _closed_fist()
    if name == "HELP":
        # Closed fist on top of flat hand: model as a closed fist (single-hand sim)
        return _closed_fist()
    raise ValueError(name)

# -- main synthesizer ------------------------------------------------------
def _synthesize_one(name: str, rng: np.random.Generator) -> np.ndarray:
    t = np.linspace(0, 1, T_FRAMES, dtype=np.float32)
    wrists = _wrist_path(name, t)               # (T, 3)
    # Augmentations: per-clip palm scale, rotation, image jitter, frame jitter
    palm_scale = 0.18 * (1 + rng.normal(0, 0.10))
    rot_deg = rng.normal(0, 12)
    rot = np.deg2rad(rot_deg)
    R = np.array([[np.cos(rot), -np.sin(rot), 0],
                  [np.sin(rot),  np.cos(rot), 0],
                  [0,            0,           1]], dtype=np.float32)
    cam_jitter = rng.normal(0, 0.01, size=(1, 3)).astype(np.float32)
    seq = np.zeros((T_FRAMES, N_LANDMARKS, 3), dtype=np.float32)
    for fi in range(T_FRAMES):
        local = _hand_shape_for_frame(name, t[fi]) * palm_scale          # (21,3) palm-local
        local = local @ R.T                                              # rotate
        local += rng.normal(0, 0.003, size=local.shape).astype(np.float32) # per-landmark noise
        seq[fi] = local + wrists[fi] + cam_jitter
    return seq

def make_dataset(n_per_class: int = 200, seed: int = 0):
    rng = np.random.default_rng(seed)
    X, y = [], []
    for ci, name in enumerate(LABELS):
        for _ in range(n_per_class):
            X.append(_synthesize_one(name, rng))
            y.append(ci)
    X = np.stack(X).astype(np.float32)  # (N, T, 21, 3)
    y = np.array(y, dtype=np.int64)
    return X, y, LABELS

if __name__ == "__main__":
    X, y, labels = make_dataset(n_per_class=2, seed=0)
    print("X:", X.shape, "y:", y.shape)
    print("First seq, first frame, first 3 landmarks:\n", X[0, 0, :3])
