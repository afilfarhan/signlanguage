/**
 * External script loader for MediaPipe Hands and ONNX Runtime
 * Supports WebGPU execution provider with WASM fallback
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
    create: (path: string, opts?: ONNXSessionOptions) => Promise<ONNXSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => unknown;
}

export interface ONNXSessionOptions {
  executionProviders?: string[];
  graphOptimizationLevel?: 'basic' | 'extended' | 'all';
  enableMemPattern?: boolean;
  enableCpuMemArena?: boolean;
  // WebGPU-specific options
  'webgpu.enableGraphCapture'?: boolean;
  'webgpu.contextOptions'?: Record<string, unknown>;
}

export interface ONNXSession {
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
}

export interface ONNXBackendInfo {
  name: 'webgpu' | 'wasm';
  label: 'WebGPU' | 'WASM';
  supportsFP16: boolean;
  supportsGraphCapture: boolean;
}

/** Detect WebGPU support */
export async function detectWebGPU(): Promise<boolean> {
  if (!('gpu' in navigator)) return false;
  try {
    const nav = navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } };
    const adapter = await nav.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/** Get ONNX backend info based on WebGPU availability */
export async function getONNXBackendInfo(): Promise<ONNXBackendInfo> {
  const webgpuSupported = await detectWebGPU();
  return {
    name: webgpuSupported ? 'webgpu' : 'wasm',
    label: webgpuSupported ? 'WebGPU' : 'WASM',
    supportsFP16: webgpuSupported,
    supportsGraphCapture: webgpuSupported,
  };
}

let mediaPipePromise: Promise<MediaPipeLibs> | null = null;
let onnxPromise: Promise<ONNXLibs> | null = null;
let backendInfoPromise: Promise<ONNXBackendInfo> | null = null;

function loadScript(src: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error(`Timeout loading ${src}`));
    }, timeoutMs);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error(`Failed to load ${src}`)); };
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

/** Load ONNX Runtime via script tag (supports WebGPU + WASM) */
export async function loadONNX(): Promise<ONNXLibs> {
  if (onnxPromise) return onnxPromise;

  // Detect backend first
  const backendInfo = await getONNXBackendInfo();
  
  // Initialize backend info promise
  backendInfoPromise = Promise.resolve(backendInfo);

  onnxPromise = (async () => {
    const scriptSrc = backendInfo.name === 'webgpu'
      ? "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort.webgpu.min.js"
      : "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/ort.min.js";

    await loadScript(scriptSrc);

    const w = window as unknown as {
      ort: ONNXLibs;
    };

    if (!w.ort) {
      throw new Error(`onnxruntime-web (${backendInfo.name}) failed to load`);
    }

    return w.ort;
  })();

  return onnxPromise;
}

/** Get the detected backend info */
export async function getONNXBackend(): Promise<ONNXBackendInfo> {
  if (!backendInfoPromise) {
    await loadONNX();
  }
  return backendInfoPromise!;
}

/** Create session options optimized for the detected backend */
export function createSessionOptions(
  backendInfo: ONNXBackendInfo,
  modelType: 'static' | 'dynamic' | 'word' | 'jz' = 'static'
): ONNXSessionOptions {
  const baseOptions: ONNXSessionOptions = {
    executionProviders: [backendInfo.name],
    graphOptimizationLevel: 'all',
    enableMemPattern: true,
    enableCpuMemArena: true,
  };

  // Enable graph capture for static-shape models on WebGPU
  // Static models (MLP, J/Z) have fixed input shapes and benefit from graph capture
  // Dynamic/Word models have variable sequence lengths - graph capture may fail
  if (backendInfo.name === 'webgpu' && backendInfo.supportsGraphCapture) {
    const staticModels = ['static', 'jz'];
    if (staticModels.includes(modelType)) {
      baseOptions['webgpu.enableGraphCapture'] = true;
    }
  }

  return baseOptions;
}