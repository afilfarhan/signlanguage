/**
 * External script loader for MediaPipe Hands and ONNX Runtime
 */

export interface MediaPipeLibs {
  drawConnectors: (ctx: CanvasRenderingContext2D, lm: { x: number; y: number; z: number }[], conns: unknown, opts: object) => void;
  drawLandmarks: (ctx: CanvasRenderingContext2D, lm: { x: number; y: number; z: number }[], opts: object) => void;
  HAND_CONNECTIONS: unknown;
  Hands: new (opts: { locateFile: (f: string) => string }) => {
    setOptions: (opts: object) => void;
    onResults: (cb: (results: { multiHandLandmarks?: { x: number; y: number; z: number }[][] }) => void) => void;
    send: (input: { image: HTMLVideoElement }) => Promise<void>;
  };
  Camera: new (video: HTMLVideoElement, opts: { onFrame: () => Promise<void>; width: number; height: number }) => {
    start: () => void;
    stop: () => void;
  };
}

export interface ONNXLibs {
  InferenceSession: {
    create: (path: string, opts?: object) => Promise<{
      run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
    }>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
}

let mediaPipePromise: Promise<MediaPipeLibs> | null = null;
let onnxPromise: Promise<ONNXLibs> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/** Load MediaPipe Hands + drawing + camera from CDN */
export async function loadMediaPipe(): Promise<MediaPipeLibs> {
  if (mediaPipePromise) return mediaPipePromise;

  mediaPipePromise = (async () => {
    await Promise.all([
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js"),
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js"),
      loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js"),
    ]);

    const w = window as unknown as {
      Hands: MediaPipeLibs["Hands"];
      Camera: MediaPipeLibs["Camera"];
      drawConnectors: MediaPipeLibs["drawConnectors"];
      drawLandmarks: MediaPipeLibs["drawLandmarks"];
      HAND_CONNECTIONS: MediaPipeLibs["HAND_CONNECTIONS"];
    };

    if (!w.Hands || !w.Camera) {
      throw new Error("MediaPipe libraries failed to load onto window");
    }

    return w as MediaPipeLibs;
  })();

  return mediaPipePromise;
}

/** Load ONNX Runtime via script tag (sets window.ort) */
export async function loadONNX(): Promise<ONNXLibs> {
  if (onnxPromise) return onnxPromise;

  onnxPromise = (async () => {
    await loadScript("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort.min.js");

    const w = window as unknown as {
      ort: ONNXLibs;
    };

    if (!w.ort) {
      throw new Error("onnxruntime-web failed to load");
    }

    return w.ort;
  })();

  return onnxPromise;
}
