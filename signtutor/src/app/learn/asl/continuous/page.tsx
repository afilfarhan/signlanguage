"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { normalizeSequenceFixed, WORD_T_FRAMES, N_LANDMARKS, FEATURE_DIM } from "@/lib/seq-features";
import { loadPrefs, type Prefs } from "@/lib/storage";
import { loadMediaPipe, loadONNX, getONNXBackend, createSessionOptions, type MediaPipeLibs, type ONNXLibs, type ONNXBackendInfo, type MediaPipeHolisticResults } from "@/lib/loadExternals";
import { extractNMMFeatures, getNMMDescription, isNMMDataReliable, type NMMFeatures } from "@/lib/nmm";
import { StreamingCTCDecoder, GreedyCTCDecoder, type DecodedSegment } from "@/lib/streaming-ctc";

type MediaPipeHolistic = { 
  setOptions: (o: object) => void; 
  onResults: (cb: (r: MediaPipeHolisticResults) => void) => void; 
  send: (i: { image: HTMLVideoElement }) => Promise<void>; 
  close: () => void;
};
type MediaPipeCamera = { start: () => void; stop: () => void };
type OrtSession = { run: (f: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> };

interface WordTransformerOutput {
  logits: { data: Float32Array };
  embeddings?: { data: Float32Array }; // Encoder output: [1, T, 128]
}

const SAMPLE_PHRASES = [
  { id: "hello-how-are-you", gloss: "HELLO HOW ARE YOU", description: "Greeting phrase" },
  { id: "what-is-your-name", gloss: "WHAT IS YOUR NAME", description: "Introduction question" },
  { id: "nice-to-meet-you", gloss: "NICE TO MEET YOU", description: "Polite greeting" },
  { id: "i-am-fine-thank-you", gloss: "I AM FINE THANK YOU", description: "Positive response" },
  { id: "see-you-later", gloss: "SEE YOU LATER", description: "Farewell" },
  { id: "help-me-please", gloss: "HELP ME PLEASE", description: "Request for assistance" },
  { id: "i-understand", gloss: "I UNDERSTAND", description: "Confirmation" },
  { id: "i-dont-know", gloss: "I DONT KNOW", description: "Negation example" },
];

export default function ContinuousSLRPage() {
  const router = useRouter();

  useEffect(() => {
    const saved = loadPrefs();
    if (!saved.completedAt) {
      router.replace("/setup");
    }
  }, [router]);

  const [prefs] = useState<Prefs>(() => {
    if (typeof window === "undefined") return { language: "asl", handedness: "right", mirror: true };
    return loadPrefs();
  });
  const [modelReady, setModelReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [selectedPhrase, setSelectedPhrase] = useState(SAMPLE_PHRASES[0].id);
  const [detected, setDetected] = useState("—");
  const [confidence, setConfidence] = useState("—");
  const [transcript, setTranscript] = useState<DecodedSegment[]>([]);
  const [tip, setTip] = useState("Select a phrase, start camera, then click 'Start Decoding' and sign continuously.");
  const [hudHand, setHudHand] = useState("No hand detected");
  const [hudLatency, setHudLatency] = useState("— ms");
  const [fps, setFps] = useState("—");
  const [loadingExternals, setLoadingExternals] = useState(false);
  const [externalsError, setExternalsError] = useState("");
  const [backendInfo, setBackendInfo] = useState<ONNXBackendInfo | null>(null);
  const [wordModelLabels, setWordModelLabels] = useState<string[]>([]);
  const [nmmFeatures, setNmmFeatures] = useState<NMMFeatures | null>(null);
  const [nmmReliable, setNmmReliable] = useState(false);
  const [showNMM, setShowNMM] = useState(true);
  const [decoderType, setDecoderType] = useState<"beam" | "greedy">("beam");

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const encoderSessionRef = useRef<OrtSession | null>(null);
  const fullSessionRef = useRef<OrtSession | null>(null);
  const handsRef = useRef<MediaPipeHolistic | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const featureBufferRef = useRef<Float32Array[]>([]);
  const fpsCounterRef = useRef({ frames: 0, t0: performance.now() });
  const frameCountRef = useRef(0);
  const decoderRef = useRef<StreamingCTCDecoder | GreedyCTCDecoder | null>(null);
  const mpLibsRef = useRef<MediaPipeLibs | null>(null);
  const onnxLibsRef = useRef<ONNXLibs | null>(null);
  const modelLabelsRef = useRef<string[]>([]);

  // Load word model labels
  useEffect(() => {
    fetch("/models/word_labels.json")
      .then((r) => r.json())
      .then((wMeta) => {
        modelLabelsRef.current = wMeta.labels;
        setWordModelLabels(wMeta.labels);
        
        // Initialize decoder with labels
        if (decoderType === "beam") {
          decoderRef.current = new StreamingCTCDecoder(wMeta.labels);
        } else {
          decoderRef.current = new GreedyCTCDecoder(wMeta.labels);
        }
      })
      .catch(console.error);
  }, [decoderType]);

  // Initialize ONNX + MediaPipe
  useEffect(() => {
    let cancelled = false;
    let animationId: number;

    async function init() {
      setLoadingExternals(true);
      try {
        // Load MediaPipe Holistic
        const mpLibs = await loadMediaPipe();
        if (cancelled) return;
        mpLibsRef.current = mpLibs;

        // Load ONNX Runtime
        const onnxLibs = await loadONNX();
        if (cancelled) return;
        onnxLibsRef.current = onnxLibs;

        const backend = await getONNXBackend();
        if (cancelled) return;
        setBackendInfo(backend);

        // Create encoder session (full model for now, we'll extract embeddings)
        const sessionOpts = createSessionOptions(backend, "word");
        const fullSession = await onnxLibs.InferenceSession.create("/models/word_transformer_fp16.onnx", sessionOpts);
        if (cancelled) return;
        fullSessionRef.current = fullSession;

        // For now, use the same session for both - we'll need a separate encoder model for true embeddings
        encoderSessionRef.current = fullSession;

        setModelReady(true);
        setTip("Select a phrase, start camera, then click 'Start Decoding' and sign continuously.");
      } catch (e) {
        if (cancelled) return;
        setExternalsError(e instanceof Error ? e.message : "Failed to load models");
        console.error(e);
      } finally {
        if (!cancelled) setLoadingExternals(false);
      }
    }

    init();

    // FPS counter
    animationId = requestAnimationFrame(function tick() {
      const now = performance.now();
      const c = fpsCounterRef.current;
      c.frames++;
      if (now - c.t0 >= 1000) {
        setFps(`${c.frames} fps`);
        c.frames = 0;
        c.t0 = now;
      }
      animationId = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      try { cameraRef.current?.stop(); } catch {}
      try { handsRef.current?.close(); } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [decoderType]);

  const startCamera = useCallback(async () => {
    if (!videoRef.current || !mpLibsRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const holistic = new mpLibsRef.current.Holistic({ 
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.4.1675469240/${f}` 
      });
      holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      holistic.onResults(onHolisticResults);
      handsRef.current = holistic;

      const camera = new mpLibsRef.current.Camera(videoRef.current, {
        onFrame: async () => { await holistic.send({ image: videoRef.current! }); },
        width: 1280,
        height: 720,
      });
      cameraRef.current = camera;
      camera.start();

      setRunning(true);
      setHudHand("Camera started — waiting for hand/face");
      featureBufferRef.current = [];
      frameCountRef.current = 0;
      decoderRef.current?.reset();
      setTranscript([]);
      setDetected("—");
      setConfidence("—");
    } catch (e) {
      setExternalsError(e instanceof Error ? e.message : "Camera access denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    try { cameraRef.current?.stop(); } catch {}
    try { handsRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRunning(false);
    setHudHand("Camera stopped");
  }, []);

  const startDecoding = useCallback(() => {
    if (!modelReady || !running) return;
    setDecoding(true);
    decoderRef.current?.reset();
    setTranscript([]);
    setTip("Signing... Speak continuously. Results appear below.");
  }, [modelReady, running]);

  const stopDecoding = useCallback(() => {
    setDecoding(false);
    setTip("Decoding stopped. Click 'Start Decoding' to resume.");
  }, []);

  const onHolisticResults = useCallback(
    async (results: MediaPipeHolisticResults) => {
      const ctx = overlayRef.current?.getContext("2d");
      if (!ctx || !overlayRef.current) return;
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

      // Extract hand landmarks (right hand preferred)
      const rightHand = results.rightHandLandmarks || null;
      const leftHand = results.leftHandLandmarks || null;
      const lm = rightHand || leftHand || null;

      // Extract NMM features
      const nmm = extractNMMFeatures(results);
      setNmmFeatures(nmm);
      setNmmReliable(isNMMDataReliable(results));

      // Draw landmarks
      const libs = mpLibsRef.current;
      if (libs && lm) {
        setHudHand("Hand detected");
        libs.drawConnectors(ctx, lm, libs.HAND_CONNECTIONS, { color: "#00e5b0", lineWidth: 3 });
        libs.drawLandmarks(ctx, lm, libs.HAND_CONNECTIONS, { color: "#4f8cff", lineWidth: 1, radius: 3 });
      }
      if (libs && showNMM && results.faceLandmarks) {
        libs.drawConnectors(ctx, results.faceLandmarks, libs.FACEMESH_TESSELATION, { color: "#4f8cff20", lineWidth: 0.5 });
        libs.drawConnectors(ctx, results.faceLandmarks, libs.FACEMESH_RIGHT_EYEBROW, { color: "#ff6b6b", lineWidth: 1.5 });
        libs.drawConnectors(ctx, results.faceLandmarks, libs.FACEMESH_LEFT_EYEBROW, { color: "#ff6b6b", lineWidth: 1.5 });
        libs.drawConnectors(ctx, results.faceLandmarks, libs.FACEMESH_LIPS, { color: "#ffd93d", lineWidth: 1 });
      }

      // Build feature vector for WordTransformer (126-dim: 21 landmarks * 3 * 2 hands? No, single hand)
      // WordTransformer expects 126-dim per frame (42 hand landmarks * 3)
      if (lm && encoderSessionRef.current && onnxLibsRef.current && modelLabelsRef.current.length > 0) {
        const arr = new Float32Array(FEATURE_DIM); // 126
        for (let i = 0; i < N_LANDMARKS; i++) {
          arr[i * 3 + 0] = lm[i]?.x ?? 0;
          arr[i * 3 + 1] = lm[i]?.y ?? 0;
          arr[i * 3 + 2] = lm[i]?.z ?? 0;
        }
        featureBufferRef.current.push(arr);
        
        // Keep sliding window of WORD_T_FRAMES (60 frames = 2 seconds at 30fps)
        if (featureBufferRef.current.length > WORD_T_FRAMES + 10) {
          featureBufferRef.current.shift();
        }

        frameCountRef.current++;

        // Run encoder every 3 frames (~10fps inference) when decoding
        if (decoding && frameCountRef.current % 3 === 0 && featureBufferRef.current.length >= WORD_T_FRAMES) {
          const t0 = performance.now();
          try {
            // Normalize sequence
            const flat = normalizeSequenceFixed(featureBufferRef.current, WORD_T_FRAMES);
            
            // Run full model to get logits (we need encoder output ideally)
            const tensor = new onnxLibsRef.current!.Tensor("float32", flat, [1, WORD_T_FRAMES, FEATURE_DIM]);
            const out = await encoderSessionRef.current!.run({ input: tensor }) as unknown as WordTransformerOutput;
            
            const logits = out.logits.data; // [100] - vocab_size
            const dt = performance.now() - t0;
            setHudLatency(`${dt.toFixed(0)} ms`);

            // Step decoder
            if (decoderRef.current) {
              const newSegments = decoderRef.current.step(logits);
              
              // Add NMM tags to new segments
              if (newSegments.length > 0 && nmmReliable) {
                const nmmTags = getNMMDescription(nmm);
                for (const seg of newSegments) {
                  seg.nmmTags = nmmTags;
                }
              }

              // Update transcript
              const fullTranscript = decoderRef.current.getFullTranscript();
              setTranscript(fullTranscript);
              
              // Update detected/confidence from latest segment
              if (newSegments.length > 0) {
                const latest = newSegments[newSegments.length - 1];
                setDetected(latest.label);
                setConfidence(`${(latest.confidence * 100).toFixed(0)}%`);
              }
            }
          } catch (e) {
            console.error("Inference error:", e);
          }
        }
      } else if (!lm) {
        setHudHand("No hand detected");
      }
    },
    [decoding, showNMM]
  );

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Header */}
      <header className="border-b border-line bg-elevated/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/learn" className="text-muted hover:text-foreground transition-colors text-sm">
            ← Learn
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Continuous SLR</h1>
          <span className="text-muted text-sm">Streaming CTC Decoder</span>
          <div className="flex-1" />
          {backendInfo && (
            <span className={`px-2 py-0.5 rounded text-xs font-mono ${
              backendInfo.name === "webgpu" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
            }`}>
              {backendInfo.label}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 grid gap-6">
        {/* Phrase Selection */}
        <section className="rounded-xl border border-line bg-elevated/50 p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Practice Phrase</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SAMPLE_PHRASES.map((phrase) => (
              <button
                key={phrase.id}
                onClick={() => { setSelectedPhrase(phrase.id); setDecoding(false); }}
                disabled={decoding}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedPhrase === phrase.id
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-line bg-elevated/50 hover:border-muted hover:bg-elevated"
                } disabled:opacity-50`}
              >
                <div className="font-mono text-sm font-semibold tracking-wide">{phrase.gloss}</div>
                <div className="text-xs text-muted mt-1">{phrase.description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Camera & Overlay */}
        <section className="rounded-xl border border-line bg-elevated/50 overflow-hidden relative">
          <div className="relative aspect-video bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              style={{ transform: prefs.mirror ? "scaleX(-1)" : "none" }}
            />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: prefs.mirror ? "scaleX(-1)" : "none" }}
            />
            {!running && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <button
                  onClick={startCamera}
                  disabled={loadingExternals || !modelReady}
                  className="px-6 py-3 rounded-lg bg-accent text-accent-foreground font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {loadingExternals ? "Loading models..." : "Start Camera"}
                </button>
              </div>
            )}
            {externalsError && (
              <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded text-sm">
                {externalsError}
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="p-4 flex flex-wrap gap-3 items-center bg-elevated/30 border-t border-line">
            <button
              onClick={running ? stopCamera : startCamera}
              disabled={loadingExternals || !modelReady}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                running ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
              } disabled:opacity-50`}
            >
              {running ? "Stop Camera" : "Start Camera"}
            </button>
            
            <button
              onClick={decoding ? stopDecoding : startDecoding}
              disabled={!running || !modelReady}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                decoding ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              } disabled:opacity-50`}
            >
              {decoding ? "Stop Decoding" : "Start Decoding"}
            </button>

            <select
              value={decoderType}
              onChange={(e) => setDecoderType(e.target.value as "beam" | "greedy")}
              disabled={decoding}
              className="px-3 py-2 rounded-lg border border-line bg-elevated text-sm text-foreground"
            >
              <option value="beam">Beam Search (10)</option>
              <option value="greedy">Greedy (Fast)</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={showNMM}
                onChange={(e) => setShowNMM(e.target.checked)}
                className="rounded border-line bg-elevated text-accent"
              />
              Show NMM
            </label>

            <div className="flex-1" />
            
            {/* HUD */}
            <div className="flex items-center gap-4 text-sm font-mono text-muted">
              <span>Hand: {hudHand}</span>
              <span>Latency: {hudLatency}</span>
              <span>FPS: {fps}</span>
              <span>Buffer: {featureBufferRef.current.length}/{WORD_T_FRAMES}</span>
            </div>
          </div>
        </section>

        {/* Live Transcript */}
        <section className="rounded-xl border border-line bg-elevated/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Live Transcript</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-mono ${
              decoding ? "bg-green-500/20 text-green-400" : "bg-muted text-muted"
            }`}>
              {decoding ? "DECODING" : "IDLE"}
            </span>
          </div>
          
          <div className="min-h-[120px] max-h-64 overflow-y-auto space-y-2 font-mono">
            {transcript.length === 0 ? (
              <div className="text-muted text-center py-8">
                {decoding ? "Waiting for signs..." : "Start decoding to see transcript"}
              </div>
            ) : (
              transcript.map((seg, idx) => (
                <div
                  key={`${seg.label}-${seg.startFrame}-${idx}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    idx === transcript.length - 1 && decoding
                      ? "border-accent bg-accent/10 animate-pulse"
                      : "border-line bg-elevated/50"
                  }`}
                >
                  <span className="text-xs text-muted w-16">{seg.startFrame}→{seg.endFrame}</span>
                  <span className="flex-1 font-semibold text-lg">{seg.label}</span>
                  <span className="text-xs text-muted w-20 text-right">
                    {(seg.confidence * 100).toFixed(0)}%
                  </span>
                  {seg.nmmTags && seg.nmmTags.length > 0 && (
                    <span className="flex gap-1 flex-wrap">
                      {seg.nmmTags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Current detected sign */}
          {detected !== "—" && (
            <div className="mt-4 p-3 rounded-lg bg-elevated border border-line">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Current:</span>
                <span className="font-mono text-xl font-semibold text-foreground">{detected}</span>
                <span className="text-sm text-muted">{confidence}</span>
              </div>
            </div>
          )}

          {/* Tip */}
          <div className="mt-4 rounded-xl border border-dashed border-line bg-accent/5 p-3 text-sm text-muted" role="status">
            {tip}
          </div>
        </section>

        {/* NMM Panel */}
        {nmmFeatures && (
          <section className="rounded-xl border border-line bg-elevated/50 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              Non-Manual Markers
              <span className={`px-2 py-0.5 rounded text-xs ${nmmReliable ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {nmmReliable ? "RELIABLE" : "LOW CONFIDENCE"}
              </span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-elevated">
                <div className="text-muted">Brow Raise</div>
                <div className="font-mono">L: {(nmmFeatures.leftBrowRaise * 100).toFixed(0)}% R: {(nmmFeatures.rightBrowRaise * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 rounded bg-elevated">
                <div className="text-muted">Brow Furrow</div>
                <div className="font-mono">{(nmmFeatures.browFurrow * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 rounded bg-elevated">
                <div className="text-muted">Eye Openness</div>
                <div className="font-mono">L: {(nmmFeatures.leftEyeOpenness * 100).toFixed(0)}% R: {(nmmFeatures.rightEyeOpenness * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 rounded bg-elevated">
                <div className="text-muted">Mouth Open</div>
                <div className="font-mono">{(nmmFeatures.mouthOpen * 100).toFixed(0)}%</div>
              </div>
              <div className="p-2 rounded bg-elevated">
                <div className="text-muted">Head Pose</div>
                <div className="font-mono">Yaw: {nmmFeatures.headYaw.toFixed(1)}° Pitch: {nmmFeatures.headPitch.toFixed(1)}°</div>
              </div>
              <div className="p-2 rounded bg-elevated">
                <div className="text-muted">Grammatical</div>
                <div className="font-mono flex gap-1 flex-wrap">
                  {nmmFeatures.isQuestion && <span className="px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">Q</span>}
                  {nmmFeatures.isWhQuestion && <span className="px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded">WH</span>}
                  {nmmFeatures.isNegation && <span className="px-1 py-0.5 bg-red-500/20 text-red-400 rounded">NEG</span>}
                  {nmmFeatures.isAffirmation && <span className="px-1 py-0.5 bg-green-500/20 text-green-400 rounded">AFF</span>}
                  {nmmFeatures.isTopic && <span className="px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded">TOP</span>}
                </div>
              </div>
              <div className="p-2 rounded bg-elevated md:col-span-2">
                <div className="text-muted">Description</div>
                <div className="font-mono">{getNMMDescription(nmmFeatures).join(", ") || "neutral"}</div>
              </div>
            </div>
          </section>
        )}

        {/* Model Info */}
        <section className="rounded-xl border border-line bg-elevated/50 p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Model Info</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted">Backend</div>
              <div className="font-mono">{backendInfo?.label || "—"}</div>
            </div>
            <div>
              <div className="text-muted">Vocabulary</div>
              <div className="font-mono">{wordModelLabels.length} signs</div>
            </div>
            <div>
              <div className="text-muted">Sequence Length</div>
              <div className="font-mono">{WORD_T_FRAMES} frames (2s)</div>
            </div>
            <div>
              <div className="text-muted">Feature Dim</div>
              <div className="font-mono">{FEATURE_DIM} (42 landmarks × 3)</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}