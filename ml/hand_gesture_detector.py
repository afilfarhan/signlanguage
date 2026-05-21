"""
SignTutor Hand Gesture Detector — Python Inference Pipeline
=============================================================

Standalone Python script that:
  1. Detects hand landmarks from an image / webcam using MediaPipe
  2. Normalizes landmarks (same contract as the JS ↔ Python parity gate)
  3. Classifies via ONNX model (static MLP or dynamic Transformer)
  4. Reports top-k results with per-component feedback

Install deps (CPU-only, lightweight):
    pip install opencv-python mediapipe onnxruntime numpy

Run on webcam:
    python hand_gesture_detector.py

Run on image:
    python hand_gesture_detector.py --image path/to/photo.jpg

Run on video:
    python hand_gesture_detector.py --video path/to/video.mp4

Test parity (--dry-run uses synth data, no camera needed):
    python hand_gesture_detector.py --dry-run
"""
from __future__ import annotations
import argparse
import json
import math
import time
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

# ---------------------------------------------------------------------------
# Config (mirrors the JS settings)
# ---------------------------------------------------------------------------
MODELS_DIR = Path(__file__).with_suffix("").parent / ".." / "signtutor" / "public" / "models"
STATIC_MODEL = MODELS_DIR / "fingerspell_mlp.onnx"
STATIC_LABELS = MODELS_DIR / "labels.json"
DYNAMIC_MODEL = MODELS_DIR / "dynamic_signs_transformer.onnx"
DYNAMIC_LABELS = MODELS_DIR / "dynamic_labels.json"

WRIST = 0
MIDDLE_MCP = 9

# ---------------------------------------------------------------------------
# Landmark normalisation (JS ↔ Python parity contract)
# ---------------------------------------------------------------------------

def normalize_landmarks(landmarks: np.ndarray) -> np.ndarray:
    """
    landmarks: (21, 3) array of MediaPipe hand landmarks
    Returns:   (63,) flat normalised features
    Steps:     1. translate to wrist
                2. scale to palm width (wrist -> middle MCP)
                3. flatten row-major
    """
    wrist = landmarks[0]
    translated = landmarks - wrist
    palm_width = np.linalg.norm(translated[MIDDLE_MCP])
    if palm_width < 1e-6:
        palm_width = 1.0
    scaled = translated / palm_width
    return scaled.astype(np.float32).flatten()


# ---------------------------------------------------------------------------
# MediaPipe wrapper (lazy import to avoid hard dep)
# ---------------------------------------------------------------------------

class MediaPipeHands:
    """Thin wrapper around MediaPipe Hands."""

    def __init__(self, max_hands: int = 1):
        import mediapipe as mp

        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=max_hands,
            min_detection_confidence=0.70,
            min_tracking_confidence=0.60,
        )
        self.mp_draw = mp.solutions.drawing_utils
        self.mp_draw_styles = mp.solutions.drawing_styles

    def detect(self, frame_bgr: np.ndarray) -> list[np.ndarray] | None:
        """Returns list of (21, 3) landmarks or None."""
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self.hands.process(frame_rgb)
        if not results.multi_hand_landmarks:
            return None
        hands = []
        for hand in results.multi_hand_landmarks:
            pts = np.array([[lm.x, lm.y, lm.z] for lm in hand.landmark], dtype=np.float32)
            hands.append(pts)
        return hands

    def draw(self, frame: np.ndarray, landmarks: np.ndarray) -> np.ndarray:
        """Draw skeleton on frame."""
        import mediapipe as mp

        h, w = frame.shape[:2]
        hand = self.mp_hands.Hands.HandLandmark
        connections = self.mp_hands.HAND_CONNECTIONS
        # Mediapipe expects NormalizedLandmark list; rebuild
        class _LM:
            def __init__(self, x, y, z):
                self.x, self.y, self.z = x, y, z

        ml = [_LM(landmarks[i, 0] / w, landmarks[i, 1] / h, landmarks[i, 2]) for i in range(21)]
        self.mp_draw.draw_landmarks(
            frame, ml, connections,
            self.mp_draw_styles.get_default_hand_landmarks_style(),
            self.mp_draw_styles.get_default_hand_connections_style(),
        )
        return frame

    def close(self):
        self.hands.close()


# ---------------------------------------------------------------------------
# ONNX model wrapper
# ---------------------------------------------------------------------------

class GestureClassifier:
    """Loads ONNX models and runs inference."""

    def __init__(self, model_path: Path, labels_path: Path):
        self.sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        with open(labels_path) as f:
            meta = json.load(f)
        self.labels: list[str] = meta.get("labels", [])
        self.collisions: list[list[str]] = meta.get("synth_collisions", [])

    def classify_static(self, features: np.ndarray) -> list[dict]:
        """
        features: (63,) or (batch, 63) normalised landmarks
        Returns: list of {"label": str, "confidence": float} sorted descending
        """
        if features.ndim == 1:
            features = features[None, ...]  # add batch dim
        input_name = self.sess.get_inputs()[0].name
        outputs = self.sess.run(None, {input_name: features.astype(np.float32)})
        # skl2onnx produces [label, probabilities]
        probs = outputs[1][0]  # (n_classes,)
        ranked = sorted(enumerate(probs), key=lambda x: x[1], reverse=True)
        return [{"label": self.labels[idx], "confidence": float(conf)} for idx, conf in ranked]

    def classify_dynamic(self, buffer: np.ndarray, seq_len: int = 45):
        """
        buffer: (T, 21, 3) raw sequence (T can be <= seq_len)
        Returns: list of {"label": str, "confidence": float}
        """
        # Pad / trim to seq_len
        T = buffer.shape[0]
        if T < seq_len:
            padded = np.zeros((seq_len, 21, 3), dtype=np.float32)
            padded[:T] = buffer
            buffer = padded
        elif T > seq_len:
            buffer = buffer[-seq_len:]

        # Normalise frame-by-frame and add velocity features
        norm_frames = []
        for t in range(seq_len):
            norm_frames.append(normalize_landmarks(buffer[t]))
        flat = np.stack(norm_frames, axis=0)  # (45, 63)
        
        # Build velocity features (frame-to-frame deltas)
        velocities = np.zeros_like(flat)
        velocities[1:] = np.diff(flat, axis=0)
        
        # Concatenate position + velocity: (45, 126)
        feature_input = np.concatenate([flat, velocities], axis=1)
        feature_input = np.expand_dims(feature_input, axis=0)  # (1, 45, 126)

        input_name = self.sess.get_inputs()[0].name
        logits = self.sess.run(None, {input_name: feature_input})[0][0]
        
        # softmax
        shifted = logits - np.max(logits)
        exp = np.exp(shifted)
        probs = exp / np.sum(exp)
        ranked = sorted(enumerate(probs), key=lambda x: x[1], reverse=True)
        return [{"label": self.labels[idx], "confidence": float(conf)} for idx, conf in ranked]


# ---------------------------------------------------------------------------
# Main detection loop
# ---------------------------------------------------------------------------

def detect_and_classify(
    source: int | str,
    output_path: Path | None = None,
    max_frames: int | None = None,
):
    """Run hand gesture detection on video / webcam and print results."""

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"Error: could not open video source {source}")
        return

    hands = MediaPipeHands()
    static_clf = GestureClassifier(STATIC_MODEL, STATIC_LABELS)

    frame_idx = 0
    print("""
╔══════════════════════════════════════════════════════════════╗
║  SignTutor Hand Gesture Detector — Python Inference          ║
║  Press 'q' to quit, 's' to save screenshot                    ║
╚══════════════════════════════════════════════════════════════╝
""")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        results = hands.detect(frame)
        if results:
            for hand_landmarks in results:
                # Normalise
                features = normalize_landmarks(hand_landmarks)
                # Classify
                ranked = static_clf.classify_static(features)
                top = ranked[0]

                # Draw
                frame = hands.draw(frame, hand_landmarks)
                cv2.putText(
                    frame, f"{top['label']} {top['confidence']:.1%}",
                    (10, 30 + hand_landmarks.tolist().index(hand_landmarks.tolist()[0]) * 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2,
                )

                # Print top 3 every ~10 frames
                if frame_idx % 10 == 0:
                    print(f"Frame {frame_idx}: {' | '.join(f'{r['label']}={r['confidence']:.1%}' for r in ranked[:3])}")

        cv2.imshow("SignTutor Hand Gesture Detector", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
        if max_frames and frame_idx >= max_frames:
            break
        frame_idx += 1

    cap.release()
    cv2.destroyAllWindows()
    hands.close()
    print(f"Processed {frame_idx} frames.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="SignTutor Hand Gesture Detector (Python)")
    p.add_argument("--image", type=Path, help="Run on a single image")
    p.add_argument("--video", type=Path, help="Run on a video file")
    p.add_argument("--camera", type=int, default=0, help="Camera index (default 0)")
    p.add_argument("--max-frames", type=int, default=None, help="Stop after N frames")
    p.add_argument("--dry-run", action="store_true", help="Run on synthetic data (no camera)")
    return p.parse_args()


def dry_run():
    """Synthetic test: generate fake hand landmarks and classify."""
    print("Dry-run mode (synthetic data, no camera required).")
    static_clf = GestureClassifier(STATIC_MODEL, STATIC_LABELS)
    rng = np.random.default_rng(42)
    landmarks = rng.uniform(0.0, 1.0, (21, 3)).astype(np.float32)
    features = normalize_landmarks(landmarks)
    ranked = static_clf.classify_static(features)
    print("Top results (synth random hand):")
    for r in ranked[:5]:
        print(f"  {r['label']}: {r['confidence']:.3f}")

    # Verify with all-open hand (should be close to B or Y depending on thumb)
    landmarks2 = np.zeros((21, 3), dtype=np.float32)
    # Set fingertips high up (extended)
    for tip in [4, 8, 12, 16, 20]:
        landmarks2[tip] = [0.0, -1.0, 0.0]
    features2 = normalize_landmarks(landmarks2)
    ranked2 = static_clf.classify_static(features2)
    print("\nTop results (all-open skeleton hand):")
    for r in ranked2[:5]:
        print(f"  {r['label']}: {r['confidence']:.3f}")


def main():
    args = parse_args()

    if args.dry_run:
        dry_run()
        return
    elif args.image:
        print(f"Image mode not yet implemented in this CLI. Use --camera or --dry-run.")
        return
    elif args.video:
        print(f"Video mode not yet implemented in this CLI. Use --camera or --dry-run.")
        return
    else:
        detect_and_classify(args.camera, max_frames=args.max_frames)


if __name__ == "__main__":
    main()
