"""
Landmark -> feature vector.

Same normalization is applied at training time and at inference time in the
browser. This is the contract between Python (training) and JS (serving):
    input shape: (N, 63)  = 21 landmarks * 3 coords, after normalization
    pipeline:
      1. translate so wrist (landmark 0) is at origin
      2. scale so the wrist->middle-finger-MCP distance == 1.0
      3. flatten to 63 floats
This makes the model invariant to camera framing and hand size, which is
exactly what we want for a fingerspelling classifier.
"""
import numpy as np

WRIST = 0
MIDDLE_MCP = 9

def normalize(landmarks: np.ndarray) -> np.ndarray:
    """landmarks: (..., 21, 3) -> (..., 63) normalized features."""
    if landmarks.ndim == 2:
        landmarks = landmarks[None]
        squeeze = True
    else:
        squeeze = False

    # 1. translate
    translated = landmarks - landmarks[:, WRIST:WRIST+1, :]

    # 2. scale by wrist->middle-MCP distance (xy only, robust enough)
    ref = translated[:, MIDDLE_MCP, :2]
    scale = np.linalg.norm(ref, axis=1, keepdims=True)
    scale = np.where(scale < 1e-6, 1.0, scale)
    translated[..., :2] /= scale[:, None, :]
    translated[..., 2:3] /= scale[:, None, :]  # scale z by same factor

    flat = translated.reshape(translated.shape[0], -1).astype(np.float32)
    return flat[0] if squeeze else flat
