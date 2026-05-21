/**
 * MediaPipe Holistic Runner (§3.2, ADR-006)
 *
 * Replaces bare MediaPipe Hands in v2 with a single inference pass
 * that returns hands + face + pose simultaneously.
 *
 * GPU delegate selection (priority order):
 *   1. WebGL2 compute shaders  → preferred (~12 ms / frame)
 *   2. WebGL1 fallback        → ~22 ms / frame
 *   3. WASM scalar            → ~55 ms / frame
 */

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface HolisticResults {
  leftHandLandmarks: NormalizedLandmark[] | null;
  rightHandLandmarks: NormalizedLandmark[] | null;
  faceLandmarks: NormalizedLandmark[] | null;
  poseLandmarks: NormalizedLandmark[] | null;
}

declare global {
  interface Window {
    Holistic: new (opts: { locateFile: (f: string) => string }) => {
      setOptions: (opts: object) => void;
      onResults: (cb: (results: HolisticResults) => void) => void;
      send: (input: { image: HTMLVideoElement }) => Promise<void>;
    };
    drawConnectors: (ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[], conns: unknown, opts: object) => void;
    drawLandmarks: (ctx: CanvasRenderingContext2D, lm: NormalizedLandmark[], opts: object) => void;
    HAND_CONNECTIONS: unknown;
    FACE_CONNECTIONS: unknown;
    POSE_CONNECTIONS: unknown;
    Camera: new (video: HTMLVideoElement, opts: { onFrame: () => Promise<void>; width: number; height: number }) => { start: () => void; stop: () => void };
  }
}

export function createHolisticRunner(
  locateFile: (file: string) => string = (f) => `/models/mediapipe/${f}`,
) {
  if (typeof window === "undefined" || !window.Holistic) {
    throw new Error("MediaPipe Holistic not available");
  }

  const holistic = new window.Holistic({
    locateFile,
  });

  holistic.setOptions({
    modelComplexity: 1,         // 0=lite, 1=full, 2=heavy
    smoothLandmarks: true,
    enableSegmentation: false,  // saves ~8 ms
    smoothSegmentation: false,
    refineFaceLandmarks: true,  // needed for brow/mouth NMM
    minDetectionConfidence: 0.70,
    minTrackingConfidence: 0.60,
  });

  return holistic;
}

/**
 * Extract NMM features from face landmarks (W4)
 */
export function extractNMMFeatures(faceLandmarks: NormalizedLandmark[] | null): {
  brow: Float32Array | null;
  mouth: Float32Array | null;
} {
  if (!faceLandmarks || faceLandmarks.length < 468) {
    return { brow: null, mouth: null };
  }

  // MediaPipe FaceMesh landmark indices (§4.3)
  const BROW_INDICES = [
    70, 63, 105, 66, 107,   // left brow
    336, 296, 334, 293, 300, // right brow
  ];
  const MOUTH_INDICES = [
    61, 185, 40, 39, 37, 0, 267,
    269, 270, 409, 291,
    375, 321, 405, 314, 17, 84,
  ];

  const brow = new Float32Array(BROW_INDICES.length * 3);
  for (let i = 0; i < BROW_INDICES.length; i++) {
    const lm = faceLandmarks[BROW_INDICES[i]];
    if (lm) {
      brow[i * 3 + 0] = lm.x;
      brow[i * 3 + 1] = lm.y;
      brow[i * 3 + 2] = lm.z;
    }
  }

  const mouth = new Float32Array(MOUTH_INDICES.length * 3);
  for (let i = 0; i < MOUTH_INDICES.length; i++) {
    const lm = faceLandmarks[MOUTH_INDICES[i]];
    if (lm) {
      mouth[i * 3 + 0] = lm.x;
      mouth[i * 3 + 1] = lm.y;
      mouth[i * 3 + 2] = lm.z;
    }
  }

  return { brow, mouth };
}
