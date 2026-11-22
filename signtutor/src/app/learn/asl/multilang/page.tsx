"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WORD_T_FRAMES, N_LANDMARKS, FEATURE_DIM } from "@/lib/seq-features";
import { loadPrefs, type Prefs } from "@/lib/storage";
import { loadMediaPipe, loadONNX, getONNXBackend, createSessionOptions, type MediaPipeLibs, type ONNXLibs, type ONNXBackendInfo, type MediaPipeHolisticResults } from "@/lib/loadExternals";
import { extractNMMFeatures, getNMMDescription, isNMMDataReliable, type NMMFeatures } from "@/lib/nmm";
import { createSignCLIP, type SignCLIPModel, type SignLanguage, getSupportedLanguages, getVocabulary, type LanguageVocabulary, LanguageDetector } from "@/lib/signclip";

type MediaPipeHolistic = { 
  setOptions: (o: object) => void; 
  onResults: (cb: (r: MediaPipeHolisticResults) => void) => void; 
  send: (i: { image: HTMLVideoElement }) => Promise<void>; 
  close: () => void;
};
type MediaPipeCamera = { start: () => void; stop: () => void };
type OrtSession = { run: (f: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> };

export default function MultiLangPage() {
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
  const [detecting, setDetecting] = useState(false);
  const [selectedLang, setSelectedLang] = useState<SignLanguage["code"]>("ASL");
  const [autoDetect, setAutoDetect] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [hudHand, setHudHand] = useState("No hand detected");
  const [fps, setFps] = useState("—");
  const [loadingExternals, setLoadingExternals] = useState(false);
  const [externalsError, setExternalsError] = useState("");
  const [backendInfo, setBackendInfo] = useState<ONNXBackendInfo | null>(null);
  const [nmmFeatures, setNmmFeatures] = useState<NMMFeatures | null>(null);
  const [nmmReliable, setNmmReliable] = useState(false);
  const [showNMM, setShowNMM] = useState(true);
  const [tip, setTip] = useState("Select a language, start camera, then click 'Auto-Detect' or browse vocabulary.");
  const [vocabulary, setVocabulary] = useState<LanguageVocabulary | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const encoderSessionRef = useRef<OrtSession | null>(null);
  const handsRef = useRef<MediaPipeHolistic | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const featureBufferRef = useRef<Float32Array[]>([]);
  const fpsCounterRef = useRef({ frames: 0, t0: performance.now() });
  const frameCountRef = useRef(0);
  const signclipRef = useRef<SignCLIPModel | null>(null);
  const detectorRef = useRef<LanguageDetector | null>(null);
  const mpLibsRef = useRef<MediaPipeLibs | null>(null);
  const onnxLibsRef = useRef<ONNXLibs | null>(null);
  const modelLabelsRef = useRef<string[]>([]);

  // Load vocabulary for selected language
  useEffect(() => {
    const vocab = getVocabulary(selectedLang);
    setVocabulary(vocab);
  }, [selectedLang]);

  // Initialize ONNX + MediaPipe + SignCLIP
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

        // Create encoder session
        const sessionOpts = createSessionOptions(backend, "word");
        const fullSession = await onnxLibs.InferenceSession.create("/models/word_transformer_fp16.onnx", sessionOpts);
        if (cancelled) return;
        encoderSessionRef.current = fullSession;

        // Load word model labels for base vocabulary
        const wMeta = await fetch("/models/word_labels.json").then(r => r.json());
        modelLabelsRef.current = wMeta.labels;

        // Initialize SignCLIP
        const signclip = createSignCLIP();
        // In production, we'd load a SignCLIP ONNX model here
        // await signclip.initialize(onnxLibs, "/models/signclip.onnx");
        // For now, use the mock implementation
        signclipRef.current = signclip;
        
        const detector = new LanguageDetector(signclip);
        detectorRef.current = detector;

        setModelReady(true);
        setTip("Select a language, start camera, then click 'Auto-Detect' or browse vocabulary.");
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
  }, []);

  // Toggle auto-detect
  useEffect(() => {
    if (autoDetect && detecting) {
      setDetecting(true);
      detectorRef.current?.reset();
      setDetectedLang(null);
    } else {
      setDetecting(false);
    }
  }, [autoDetect, detecting]);

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
      setHudHand("Camera started — waiting for hand");
      featureBufferRef.current = [];
      frameCountRef.current = 0;
    } catch (e) {
      setExternalsError(e instanceof Error ? e.message : "Camera access denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    try { cameraRef.current?.stop(); } catch {}
    try { handsRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRunning(false);
    setDetecting(false);
    setAutoDetect(false);
    setHudHand("Camera stopped");
  }, []);

  const onHolisticResults = useCallback(
    async (results: MediaPipeHolisticResults) => {
      const ctx = overlayRef.current?.getContext("2d");
      if (!ctx || !overlayRef.current) return;
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

      const rightHand = results.rightHandLandmarks || null;
      const leftHand = results.leftHandLandmarks || null;
      const lm = rightHand || leftHand || null;

      const nmm = extractNMMFeatures(results);
      setNmmFeatures(nmm);
      setNmmReliable(isNMMDataReliable(results));

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

      if (lm && encoderSessionRef.current && onnxLibsRef.current && modelLabelsRef.current.length > 0) {
        const arr = new Float32Array(FEATURE_DIM);
        for (let i = 0; i < N_LANDMARKS; i++) {
          arr[i * 3 + 0] = lm[i]?.x ?? 0;
          arr[i * 3 + 1] = lm[i]?.y ?? 0;
          arr[i * 3 + 2] = lm[i]?.z ?? 0;
        }
        featureBufferRef.current.push(arr);
        if (featureBufferRef.current.length > WORD_T_FRAMES + 10) {
          featureBufferRef.current.shift();
        }
        frameCountRef.current++;

        // Auto-detect language from embeddings
        if (detecting && signclipRef.current && detectorRef.current && frameCountRef.current % 10 === 0) {
          if (featureBufferRef.current.length >= 30) {
            try {
              const recentFrames = featureBufferRef.current.slice(-30);
              const embedding = await signclipRef.current.encodeVideo(recentFrames);
              const detection = await detectorRef.current.detect(embedding);
              if (detection) {
                setDetectedLang(detection.language);
                if (detection.confidence > 0.85) {
                  setAutoDetect(false);
                  setSelectedLang(detection.language as SignLanguage["code"]);
                  setTip(`Detected: ${detection.language} (${(detection.confidence * 100).toFixed(0)}% confidence)`);
                }
              }
            } catch (e) {
              console.error("Language detection error:", e);
            }
          }
        }
      } else if (!lm) {
        setHudHand("No hand detected");
      }
    },
    [detecting, showNMM]
  );

  const languages = useMemo(() => getSupportedLanguages(), []);

  const currentVocab = vocabulary;

  return (
    <div className="min-h-screen bg-base flex flex-col">
      <header className="border-b border-line bg-elevated/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/learn" className="text-muted hover:text-foreground transition-colors text-sm">
            ← Learn
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Multi-Language</h1>
          <span className="text-muted text-sm">SignCLIP Cross-Lingual</span>
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
        {/* Language Selector */}
        <section className="rounded-xl border border-line bg-elevated/50 p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Select Language</h2>
          <div className="flex flex-wrap gap-3">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setSelectedLang(lang.code); setAutoDetect(false); }}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                  selectedLang === lang.code
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-line bg-elevated/50 hover:border-muted hover:bg-elevated"
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div>
                  <div className="font-semibold">{lang.name}</div>
                  <div className="text-xs text-muted">{lang.nativeName}</div>
                </div>
                {selectedLang === lang.code && (
                  <span className="ml-auto px-2 py-0.5 text-xs bg-accent/20 text-accent rounded">Active</span>
                )}
              </button>
            ))}
          </div>

          {/* Auto-Detect Toggle */}
          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoDetect}
                onChange={(e) => setAutoDetect(e.target.checked)}
                disabled={!running || !modelReady}
                className="rounded border-line bg-elevated text-accent disabled:opacity-50"
              />
              <span className="text-sm {autoDetect ? 'text-accent' : 'text-muted'}">
                {autoDetect ? "Auto-Detecting..." : "Auto-Detect Language"}
              </span>
            </label>
            {detectedLang && (
              <span className="px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded border border-green-500/30">
                Detected: {detectedLang}
              </span>
            )}
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
            
            <div className="flex items-center gap-4 text-sm font-mono text-muted">
              <span>Hand: {hudHand}</span>
              <span>FPS: {fps}</span>
              <span>Buffer: {featureBufferRef.current.length}/{WORD_T_FRAMES}</span>
            </div>
          </div>
        </section>

        {/* Vocabulary Browser */}
        {currentVocab && (
          <section className="rounded-xl border border-line bg-elevated/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">
                {currentVocab.labels.length} {languages.find(l => l.code === selectedLang)?.name} Signs
              </h2>
              <span className="text-xs text-muted">Click to learn</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {currentVocab.labels.map((label) => {
                const desc = currentVocab.descriptions[label] || "";
                return (
                  <Link
                    key={label}
                    href={`/learn/asl/words/${label.toLowerCase().replace(/\s+/g, '_')}`}
                    className="p-3 rounded-lg border border-line bg-elevated/50 hover:border-muted hover:bg-elevated transition-colors group"
                  >
                    <div className="font-mono text-lg font-semibold tracking-wide">{label}</div>
                    <div className="text-xs text-muted mt-1 line-clamp-2">{desc}</div>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs text-accent group-hover:translate-x-1 transition-transform">
                      Practice
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                        <path d="M6.75 3.25L11.5 8L6.75 12.75" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Categories */}
            <div className="mt-6 space-y-3">
              {Object.entries(currentVocab.categories).map(([cat, labels]) => (
                <div key={cat} className="rounded-lg border border-line bg-elevated/30 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{cat}</h3>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label) => (
                      <Link
                        key={label}
                        href={`/learn/asl/words/${label.toLowerCase().replace(/\s+/g, '_')}`}
                        className="px-3 py-1.5 text-sm rounded-full border border-line bg-elevated text-muted hover:text-foreground hover:border-muted hover:bg-elevated transition-colors"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tip */}
        <div className="rounded-xl border border-dashed border-line bg-accent/5 p-3 text-sm text-muted" role="status">
          {tip}
        </div>

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
                <div className="text-muted">Head Pose</div>
                <div className="font-mono">Yaw: {nmmFeatures.headYaw.toFixed(1)}° Pitch: {nmmFeatures.headPitch.toFixed(1)}°</div>
              </div>
              <div className="p-2 rounded bg-elevated md:col-span-2">
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
              <div className="text-muted">Base Vocabulary</div>
              <div className="font-mono">{modelLabelsRef.current.length} signs</div>
            </div>
            <div>
              <div className="text-muted">Current Language</div>
              <div className="font-mono">{languages.find(l => l.code === selectedLang)?.name || selectedLang}</div>
            </div>
            <div>
              <div className="text-muted">SignCLIP Dim</div>
              <div className="font-mono">512</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}