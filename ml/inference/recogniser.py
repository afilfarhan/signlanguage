"""
Unified ASL recogniser — handles alphabet (static), word (dynamic), and sentence modes.

Supports:
- Webcam / video / numpy input
- Rolling frame buffer with configurable window
- Confidence threshold (default 0.75) with cooldown (default 1.5s)
- Automatic fallback: word -> alphabet fingerspelling when confidence is low
- Sign boundary detection via wrist velocity heuristic

Run:
    python -m ml.inference.recogniser --source webcam
    python -m ml.inference.recogniser --source video --path clip.mp4
    python -m ml.inference.recogniser --dry-run

Architecture contract:
    - Alphabet: per-frame normalization (features.py) -> MLP (63-dim)
    - Word: sequence normalization (seq_features.py) -> Transformer (T=60, 126-dim)
    - Both models loaded as ONNX via onnxruntime
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import deque
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MODELS_DIR = Path(__file__).parent.parent / "models"
PUBLIC_MODELS_DIR = Path(__file__).parent.parent.parent / "signtutor" / "public" / "models"

ALPHABET_MODEL = PUBLIC_MODELS_DIR / "fingerspell_mlp.onnx"
ALPHABET_LABELS = PUBLIC_MODELS_DIR / "labels.json"
WORD_MODEL = MODELS_DIR / "word_transformer.onnx"
WORD_LABELS = MODELS_DIR / "word_labels.json"
WORD_CONFIG = MODELS_DIR / "word_transformer_config.json"

CONFIDENCE_THRESHOLD = 0.75
COOLDOWN_SECONDS = 1.5
WORD_SEQ_LEN = 60
ALPHABET_FEATURE_DIM = 63
WORD_FEATURE_DIM = 126
WRIST = 0
MIDDLE_MCP = 9


def normalize_landmarks_static(landmarks: np.ndarray) -> np.ndarray:
    wrist = landmarks[0]
    translated = landmarks - wrist
    palm_width = np.linalg.norm(translated[MIDDLE_MCP])
    if palm_width < 1e-6:
        palm_width = 1.0
    scaled = translated / palm_width
    return scaled.astype(np.float32).flatten()


def normalize_sequence_word(buffer: np.ndarray) -> np.ndarray:
    from seq_features import normalize_sequence
    normed = normalize_sequence(buffer)
    T = normed.shape[0]
    if T < WORD_SEQ_LEN:
        padded = np.zeros((WORD_SEQ_LEN, 21, 6), dtype=np.float32)
        padded[:T] = normed
        normed = padded
    elif T > WORD_SEQ_LEN:
        start = (T - WORD_SEQ_LEN) // 2
        normed = normed[start:start + WORD_SEQ_LEN]
    flat = normed.reshape(WORD_SEQ_LEN, -1)
    if flat.shape[1] < WORD_FEATURE_DIM:
        pad = np.zeros((WORD_SEQ_LEN, WORD_FEATURE_DIM - flat.shape[1]), dtype=np.float32)
        flat = np.concatenate([flat, pad], axis=1)
    return flat[:, :WORD_FEATURE_DIM]


class MediaPipeHands:
    def __init__(self, max_hands: int = 1):
        import mediapipe as mp
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=max_hands,
            min_detection_confidence=0.70,
            min_tracking_confidence=0.60,
        )

    def detect(self, frame_bgr: np.ndarray) -> list[np.ndarray] | None:
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self.hands.process(frame_rgb)
        if not results.multi_hand_landmarks:
            return None
        hands = []
        for hand in results.multi_hand_landmarks:
            pts = np.array([[lm.x, lm.y, lm.z] for lm in hand.landmark], dtype=np.float32)
            hands.append(pts)
        return hands

    def close(self):
        self.hands.close()


class Recogniser:
    """Unified alphabet + word recogniser with sign segmentation."""

    def __init__(
        self,
        mode: str = "word",
        confidence_threshold: float = CONFIDENCE_THRESHOLD,
        cooldown_seconds: float = COOLDOWN_SECONDS,
        velocity_threshold: float = 0.01,
        min_pause_frames: int = 5,
    ):
        self.mode = mode
        self.confidence_threshold = confidence_threshold
        self.cooldown_seconds = cooldown_seconds
        self.velocity_threshold = velocity_threshold
        self.min_pause_frames = min_pause_frames

        self._frame_buffer: deque = deque(maxlen=WORD_SEQ_LEN + 20)
        self._last_prediction_time: float = 0.0
        self._pause_count: int = 0
        self._prev_wrist: Optional[np.ndarray] = None

        self._alphabet_sess: Optional[ort.InferenceSession] = None
        self._alphabet_labels: list[str] = []
        self._word_sess: Optional[ort.InferenceSession] = None
        self._word_labels: list[str] = []

        self._load_models()

    def _load_models(self):
        if ALPHABET_MODEL.exists():
            self._alphabet_sess = ort.InferenceSession(
                str(ALPHABET_MODEL), providers=["CPUExecutionProvider"]
            )
            with open(ALPHABET_LABELS) as f:
                meta = json.load(f)
            self._alphabet_labels = meta.get("labels", [])
            print(f"Loaded alphabet model: {len(self._alphabet_labels)} classes")
        else:
            print(f"WARNING: Alphabet model not found at {ALPHABET_MODEL}")

        if WORD_MODEL.exists():
            self._word_sess = ort.InferenceSession(
                str(WORD_MODEL), providers=["CPUExecutionProvider"]
            )
            with open(WORD_LABELS) as f:
                meta = json.load(f)
            self._word_labels = meta.get("labels", [])
            print(f"Loaded word model: {len(self._word_labels)} classes")
        else:
            print(f"WARNING: Word model not found at {WORD_MODEL}")
            if self.mode == "word":
                print("  Falling back to alphabet-only mode")
                self.mode = "alphabet"

    def _wrist_velocity(self, landmarks: np.ndarray) -> float:
        if self._prev_wrist is None:
            self._prev_wrist = landmarks[WRIST].copy()
            return 0.0
        vel = float(np.linalg.norm(landmarks[WRIST] - self._prev_wrist))
        self._prev_wrist = landmarks[WRIST].copy()
        return vel

    def _is_sign_boundary(self, vel: float) -> bool:
        if vel < self.velocity_threshold:
            self._pause_count += 1
        else:
            self._pause_count = 0
        return self._pause_count >= self.min_pause_frames

    def _classify_alphabet(self, landmarks: np.ndarray) -> dict:
        if self._alphabet_sess is None:
            return {"label": "?", "confidence": 0.0, "mode": "alphabet"}
        features = normalize_landmarks_static(landmarks)
        input_name = self._alphabet_sess.get_inputs()[0].name
        outputs = self._alphabet_sess.run(None, {input_name: features[np.newaxis].astype(np.float32)})
        probs = outputs[1][0]
        best_idx = int(np.argmax(probs))
        return {
            "label": self._alphabet_labels[best_idx] if best_idx < len(self._alphabet_labels) else "?",
            "confidence": float(probs[best_idx]),
            "mode": "alphabet",
        }

    def _classify_word(self) -> Optional[dict]:
        if self._word_sess is None:
            return None
        if len(self._frame_buffer) < 10:
            return None
        buffer = np.stack(list(self._frame_buffer), axis=0)
        features = normalize_sequence_word(buffer)
        input_name = self._word_sess.get_inputs()[0].name
        logits = self._word_sess.run(None, {input_name: features[np.newaxis].astype(np.float32)})[0][0]
        shifted = logits - np.max(logits)
        exp = np.exp(shifted)
        probs = exp / np.sum(exp)
        best_idx = int(np.argmax(probs))
        confidence = float(probs[best_idx])
        return {
            "label": self._word_labels[best_idx] if best_idx < len(self._word_labels) else "?",
            "confidence": confidence,
            "mode": "word",
        }

    def process_frame(self, landmarks: np.ndarray) -> Optional[dict]:
        now = time.time()
        vel = self._wrist_velocity(landmarks)
        self._frame_buffer.append(landmarks.copy())

        if self.mode == "alphabet":
            return self._classify_alphabet(landmarks)

        if now - self._last_prediction_time < self.cooldown_seconds:
            return None

        is_boundary = self._is_sign_boundary(vel)
        if not is_boundary and len(self._frame_buffer) < WORD_SEQ_LEN:
            if len(self._frame_buffer) >= 10 and now - self._last_prediction_time > self.cooldown_seconds * 2:
                pass
            else:
                return None

        result = self._classify_word()
        if result is None:
            return self._classify_alphabet(landmarks)

        if result["confidence"] >= self.confidence_threshold:
            self._last_prediction_time = now
            self._frame_buffer.clear()
            self._pause_count = 0
            return result

        fallback = self._classify_alphabet(landmarks)
        if fallback["confidence"] >= self.confidence_threshold:
            self._last_prediction_time = now
            return fallback

        return {"label": result["label"], "confidence": result["confidence"],
                "mode": "word", "low_confidence": True}

    def reset(self):
        self._frame_buffer.clear()
        self._last_prediction_time = 0.0
        self._pause_count = 0
        self._prev_wrist = None


def run_webcam(recogniser: Recogniser, camera_idx: int = 0, max_frames: int | None = None):
    cap = cv2.VideoCapture(camera_idx)
    if not cap.isOpened():
        print(f"Error: could not open camera {camera_idx}")
        return

    hands = MediaPipeHands()
    print("\nSignTutor Unified Recogniser — press 'q' to quit, 'r' to reset buffer\n")

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        detected = hands.detect(frame)
        if detected:
            for lm in detected:
                result = recogniser.process_frame(lm)
                if result:
                    label = result["label"]
                    conf = result["confidence"]
                    mode = result.get("mode", "?")
                    low = result.get("low_confidence", False)
                    tag = f"{'~' if low else ''}{label} ({conf:.0%}) [{mode}]"
                    cv2.putText(frame, tag, (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
                                0.9, (0, 255, 0) if not low else (0, 165, 255), 2)
                    if frame_idx % 10 == 0:
                        print(f"  {tag}")

        cv2.imshow("SignTutor Recogniser", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        elif key == ord("r"):
            recogniser.reset()
            print("  Buffer reset")

        if max_frames and frame_idx >= max_frames:
            break
        frame_idx += 1

    cap.release()
    cv2.destroyAllWindows()
    hands.close()
    print(f"Processed {frame_idx} frames")


def run_video(recogniser: Recogniser, video_path: str):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: could not open video {video_path}")
        return

    hands = MediaPipeHands()
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_idx = 0
    results_log = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        detected = hands.detect(frame)
        if detected:
            for lm in detected:
                result = recogniser.process_frame(lm)
                if result:
                    ts = frame_idx / fps
                    results_log.append({"time_s": round(ts, 2), **result})
                    print(f"  t={ts:.2f}s  {result['label']} ({result['confidence']:.0%}) [{result.get('mode', '?')}]")

        frame_idx += 1

    cap.release()
    hands.close()
    print(f"\nProcessed {frame_idx} frames, {len(results_log)} predictions")

    out_path = Path(video_path).stem + "_predictions.json"
    with open(out_path, "w") as f:
        json.dump(results_log, f, indent=2)
    print(f"Saved predictions -> {out_path}")


def dry_run(recogniser: Recogniser):
    print("Dry-run mode (synthetic data, no camera)")
    rng = np.random.default_rng(42)
    for i in range(WORD_SEQ_LEN + 10):
        lm = rng.uniform(0.3, 0.7, (21, 3)).astype(np.float32)
        lm[0] = [0.5, 0.6, 0.0]
        result = recogniser.process_frame(lm)
        if result:
            print(f"  Frame {i}: {result['label']} ({result['confidence']:.2%}) [{result.get('mode', '?')}]")
    print("Dry-run complete")


def main():
    parser = argparse.ArgumentParser(description="SignTutor Unified Recogniser")
    parser.add_argument("--source", choices=["webcam", "video", "dry-run"], default="webcam")
    parser.add_argument("--path", type=str, help="Video file path (for --source video)")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--mode", choices=["alphabet", "word"], default="word")
    parser.add_argument("--confidence", type=float, default=CONFIDENCE_THRESHOLD)
    parser.add_argument("--cooldown", type=float, default=COOLDOWN_SECONDS)
    parser.add_argument("--max-frames", type=int, default=None)
    args = parser.parse_args()

    recogniser = Recogniser(
        mode=args.mode,
        confidence_threshold=args.confidence,
        cooldown_seconds=args.cooldown,
    )

    if args.source == "dry-run":
        dry_run(recogniser)
    elif args.source == "video":
        if not args.path:
            print("Error: --path required for video source")
            return
        run_video(recogniser, args.path)
    else:
        run_webcam(recogniser, args.camera, args.max_frames)


if __name__ == "__main__":
    main()
