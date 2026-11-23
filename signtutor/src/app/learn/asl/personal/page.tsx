"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WORD_T_FRAMES, N_LANDMARKS, FEATURE_DIM } from "@/lib/seq-features";
import { loadPrefs, type Prefs } from "@/lib/storage";
import { loadMediaPipe, loadONNX, getONNXBackend, createSessionOptions, type MediaPipeLibs, type ONNXLibs, type ONNXBackendInfo, type MediaPipeHolisticResults } from "@/lib/loadExternals";
import { extractNMMFeatures, getNMMDescription, isNMMDataReliable, type NMMFeatures } from "@/lib/nmm";
import { PersonalAdapter, createPersonalAdapter, type SupportExample } from "@/lib/personal-adapter";
import { loadPersonalModel, savePersonalModel, listPersonalSigns, deletePersonalSign, exportPersonalData, importPersonalData, clearPersonalData } from "@/lib/personal-db";

type MediaPipeHolistic = { 
  setOptions: (o: object) => void; 
  onResults: (cb: (r: MediaPipeHolisticResults) => void) => void; 
  send: (i: { image: HTMLVideoElement }) => Promise<void>; 
  close: () => void;
};
type MediaPipeCamera = { start: () => void; stop: () => void };
type OrtSession = { run: (f: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> };

const MAX_EXAMPLES = 5;

export default function PersonalSignsPage() {
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
  const [recording, setRecording] = useState(false);
  const [newSignLabel, setNewSignLabel] = useState("");
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [hudHand, setHudHand] = useState("No hand detected");
  const [fps, setFps] = useState("—");
  const [loadingExternals, setLoadingExternals] = useState(false);
  const [externalsError, setExternalsError] = useState("");
  const [backendInfo, setBackendInfo] = useState<ONNXBackendInfo | null>(null);
  const [wordModelLabels, setWordModelLabels] = useState<string[]>([]);
  const [nmmFeatures, setNmmFeatures] = useState<NMMFeatures | null>(null);
  const [nmmReliable, setNmmReliable] = useState(false);
  const [showNMM, setShowNMM] = useState(true);
  const [personalSigns, setPersonalSigns] = useState<{ label: string; exampleCount: number; createdAt: number }[]>([]);
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [selectedSignExamples, setSelectedSignExamples] = useState<SupportExample[]>([]);
  const [tip, setTip] = useState("Add a new personal sign or select existing to manage examples.");
  const [isExporting, setIsExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const encoderSessionRef = useRef<OrtSession | null>(null);
  const handsRef = useRef<MediaPipeHolistic | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const featureBufferRef = useRef<Float32Array[]>([]);
  const fpsCounterRef = useRef({ frames: 0, t0: performance.now() });
  const frameCountRef = useRef(0);
  const recordingFramesRef = useRef<Float32Array[]>([]);
  const adapterRef = useRef<PersonalAdapter | null>(null);
  const mpLibsRef = useRef<MediaPipeLibs | null>(null);
  const onnxLibsRef = useRef<ONNXLibs | null>(null);
  const modelLabelsRef = useRef<string[]>([]);

  useEffect(() => {
    async function loadSigns() {
      try {
        const signs = await listPersonalSigns();
        setPersonalSigns(signs);
      } catch (e) {
        console.error("Failed to load personal signs:", e);
      }
    }
    loadSigns();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let animationId: number;

    async function init() {
      setLoadingExternals(true);
      try {
        const mpLibs = await loadMediaPipe();
        if (cancelled) return;
        mpLibsRef.current = mpLibs;

        const onnxLibs = await loadONNX();
        if (cancelled) return;
        onnxLibsRef.current = onnxLibs;

        const backend = await getONNXBackend();
        if (cancelled) return;
        setBackendInfo(backend);

        const sessionOpts = createSessionOptions(backend, "word");
        const fullSession = await onnxLibs.InferenceSession.create("/models/word_transformer_fp16.onnx", sessionOpts);
        if (cancelled) return;
        encoderSessionRef.current = fullSession;

        const wMeta = await fetch("/models/word_labels.json").then(r => r.json());
        modelLabelsRef.current = wMeta.labels;
        setWordModelLabels(wMeta.labels);

        const adapter = createPersonalAdapter();
        const savedModel = await loadPersonalModel();
        if (savedModel) {
          adapter.importModel(savedModel);
        }
        await adapter.initialize(
          fullSession,
          onnxLibs,
          wMeta.labels
        );
        adapterRef.current = adapter;

        const signs = await listPersonalSigns();
        setPersonalSigns(signs);

        setModelReady(true);
        setTip("Add a new personal sign or select existing to manage examples.");
      } catch (e) {
        if (cancelled) return;
        setExternalsError(e instanceof Error ? e.message : "Failed to load models");
        console.error(e);
      } finally {
        if (!cancelled) setLoadingExternals(false);
      }
    }

    init();

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

  useEffect(() => {
    if (!selectedSign || !adapterRef.current) {
      setSelectedSignExamples([]);
      return;
    }
    const model = adapterRef.current.exportModel();
    const examples = model.supportSet[selectedSign] || [];
    setSelectedSignExamples(examples);
  }, [selectedSign]);

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
      setHudHand("Camera started &mdash; waiting for hand");
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
    setRecording(false);
    setHudHand("Camera stopped");
  }, []);

  const startRecording = useCallback(() => {
    if (!running || !modelReady) return;
    setRecording(true);
    recordingFramesRef.current = [];
    setRecordingProgress(0);
    setTip(`Recording examples for "${newSignLabel}"... Perform the sign clearly.`);
  }, [running, modelReady, newSignLabel]);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    if (recordingFramesRef.current.length === 0) return;

    const adapter = adapterRef.current;
    if (!adapter) return;

    try {
      const sequences = chunkSequence(recordingFramesRef.current, WORD_T_FRAMES);
      if (sequences.length === 0) {
        setTip("Not enough frames recorded. Try signing longer.");
        return;
      }

      await adapter.addExamples(newSignLabel.toUpperCase(), sequences);
      
      await savePersonalModel(adapter.exportModel());
      
      const signs = await listPersonalSigns();
      setPersonalSigns(signs);
      
      setTip(`Added ${sequences.length} example(s) for "${newSignLabel.toUpperCase()}"`);
      setNewSignLabel("");
      setSelectedSign(newSignLabel.toUpperCase());
    } catch (e) {
      setTip(e instanceof Error ? e.message : "Failed to add examples");
    }
  }, [newSignLabel]);

  const handleDeleteSign = useCallback(async (label: string) => {
    if (!confirm(`Delete personal sign "${label}" and all its examples?`)) return;
    
    const adapter = adapterRef.current;
    if (adapter) {
      adapter.removeSign(label);
      await savePersonalModel(adapter.exportModel());
    }
    await deletePersonalSign(label);
    
    const signs = await listPersonalSigns();
    setPersonalSigns(signs);
    
    if (selectedSign === label) {
      setSelectedSign(null);
    }
    setTip(`Deleted "${label}"`);
  }, [selectedSign]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const json = await exportPersonalData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `signtutor-personal-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setTip("Personal model exported");
    } catch {
      setTip("Export failed");
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      await importPersonalData(text);
      
      const adapter = adapterRef.current;
      if (adapter) {
        const savedModel = await loadPersonalModel();
        if (savedModel) adapter.importModel(savedModel);
      }
      
      const signs = await listPersonalSigns();
      setPersonalSigns(signs);
      setTip("Personal model imported");
    } catch {
      setTip("Import failed: invalid file");
    }
    e.target.value = "";
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Delete ALL personal signs? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure?")) return;
    
    const adapter = adapterRef.current;
    if (adapter) {
      const newAdapter = createPersonalAdapter();
      adapterRef.current = newAdapter;
      await initializeAdapter(newAdapter);
    }
    await clearPersonalData();
    setPersonalSigns([]);
    setSelectedSign(null);
    setTip("All personal data cleared");
  }, []);

  async function initializeAdapter(adapter: PersonalAdapter) {
    if (!encoderSessionRef.current || !onnxLibsRef.current) return;
    await adapter.initialize(
      encoderSessionRef.current,
      onnxLibsRef.current,
      modelLabelsRef.current
    );
  }

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

        if (recording) {
          recordingFramesRef.current.push(arr);
          const progress = Math.min(100, (recordingFramesRef.current.length / WORD_T_FRAMES) * 100);
          setRecordingProgress(progress);
          
          if (recordingFramesRef.current.length >= WORD_T_FRAMES * 2) {
            stopRecording();
          }
        }
      } else if (!lm) {
        setHudHand("No hand detected");
      }
    },
    [recording, showNMM, stopRecording]
  );

  function chunkSequence(frames: Float32Array[], seqLen: number): Float32Array[][] {
    const sequences: Float32Array[][] = [];
    for (let i = 0; i + seqLen <= frames.length; i += seqLen) {
      sequences.push(frames.slice(i, i + seqLen));
    }
    return sequences;
  }

  return (
    <div className="min-h-screen bg-base flex flex-col">
      <header className="border-b border-line bg-elevated/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/learn" className="text-muted hover:text-foreground transition-colors text-sm">
            &larr; Learn
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Personal Signs</h1>
          <span className="text-muted text-sm">Few-Shot Adapter</span>
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
            {recording && (
              <div className="absolute top-4 left-4 right-4 flex flex-col gap-2">
                <div className="bg-red-500/90 text-white px-4 py-2 rounded text-center font-semibold animate-pulse">
                  RECORDING: {newSignLabel.toUpperCase() || "NEW SIGN"}
                </div>
                <div className="bg-elevated/90 rounded overflow-hidden h-2">
                  <div 
                    className="bg-red-500 h-full transition-all duration-100" 
                    style={{ width: `${recordingProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-white/80">
                  {recordingFramesRef.current.length} / {WORD_T_FRAMES * 2} frames
                </p>
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
            
            <div className="flex-1 flex items-center gap-2" style={{ minWidth: 200 }}>
              <input
                type="text"
                value={newSignLabel}
                onChange={(e) => setNewSignLabel(e.target.value.toUpperCase())}
                placeholder="New sign label (e.g., MYNAME)"
                disabled={recording || !running}
                maxLength={20}
                className="flex-1 px-3 py-2 rounded-lg border border-line bg-elevated text-foreground placeholder:text-muted disabled:opacity-50 uppercase"
              />
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={!running || !modelReady || (!recording && !newSignLabel.trim())}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  recording ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                } disabled:opacity-50`}
              >
                {recording ? "Stop Recording" : "Record Examples"}
              </button>
            </div>

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

        <section className="rounded-xl border border-line bg-elevated/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Your Personal Signs</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted cursor-pointer">
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="sr-only"
                />
              </label>
              <button
                onClick={handleExport}
                disabled={isExporting || personalSigns.length === 0}
                className="px-3 py-1.5 text-xs rounded-lg border border-line bg-elevated text-muted hover:text-foreground hover:border-muted disabled:opacity-50 transition-colors"
              >
                {isExporting ? "Exporting..." : "Export"}
              </button>
              {personalSigns.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {personalSigns.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <svg className="mx-auto h-12 w-12 text-muted/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg">No personal signs yet</p>
              <p className="text-sm mt-1">Add your name sign, dialect variations, or any custom vocabulary</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {personalSigns.map((sign) => (
                <button
                  key={sign.label}
                  onClick={() => setSelectedSign(sign.label === selectedSign ? null : sign.label)}
                  className={`p-3 rounded-lg border transition-all text-left ${
                    selectedSign === sign.label
                      ? "border-accent bg-accent/10"
                      : "border-line bg-elevated/50 hover:border-muted hover:bg-elevated"
                  }`}
                >
                  <div className="font-mono text-lg font-semibold tracking-wide">{sign.label}</div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted">
                    <span>{sign.exampleCount} / {MAX_EXAMPLES} examples</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSign(sign.label); }}
                      className="px-2 py-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedSign && (
          <section className="rounded-xl border border-line bg-elevated/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Examples for &quot;{selectedSign}&quot;</h2>
              <span className="text-xs text-muted">{selectedSignExamples.length} / {MAX_EXAMPLES}</span>
            </div>

            {selectedSignExamples.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <p>No examples recorded yet</p>
                <p className="text-sm mt-1">Enter the label above and click &quot;Record Examples&quot;</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selectedSignExamples.map((ex, idx) => (
                  <div key={ex.id} className="p-3 rounded-lg border border-line bg-elevated/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono">Example {idx + 1}</span>
                      <span className="text-muted">Quality: {(ex.quality || 1) * 100}%</span>
                    </div>
                    <div className="mt-2 text-[10px] text-muted font-mono">
                      {new Date(ex.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedSignExamples.length >= MAX_EXAMPLES && (
              <p className="mt-3 text-xs text-muted text-center">Maximum examples reached. Delete sign to start over.</p>
            )}
          </section>
        )}

        <div className="rounded-xl border border-dashed border-line bg-accent/5 p-3 text-sm text-muted" role="status">
          {tip}
        </div>

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
                <div className="font-mono">Yaw: {nmmFeatures.headYaw.toFixed(1)}&deg; Pitch: {nmmFeatures.headPitch.toFixed(1)}&deg;</div>
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

        <section className="rounded-xl border border-line bg-elevated/50 p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Adapter Info</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted">Backend</div>
              <div className="font-mono">{backendInfo?.label || "&mdash;"}</div>
            </div>
            <div>
              <div className="text-muted">Base Vocabulary</div>
              <div className="font-mono">{wordModelLabels.length} signs</div>
            </div>
            <div>
              <div className="text-muted">Personal Signs</div>
              <div className="font-mono">{personalSigns.length} / 50</div>
            </div>
            <div>
              <div className="text-muted">Embedding Dim</div>
              <div className="font-mono">128</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}