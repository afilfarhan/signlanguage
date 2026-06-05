"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { loadMediaPipe } from "@/lib/loadExternals";
import {
  saveSample,
  getAllSamples,
  getStats,
  clearAllSamples,
  deleteSample,
  type RecordingSample,
} from "@/lib/landmark-db";
import { WORD_T_FRAMES, N_LANDMARKS } from "@/lib/seq-features";
import { generateNpzPython } from "@/lib/export-npz";
import Link from "next/link";

interface Landmark { x: number; y: number; z: number }
interface MPResults { multiHandLandmarks?: Landmark[][] }
interface MPHands {
  setOptions: (o: object) => void;
  onResults: (cb: (r: MPResults) => void) => void;
  send: (i: { image: HTMLVideoElement }) => Promise<void>;
}
interface MPLibs {
  Hand: new (opts: { locateFile: (f: string) => string }) => MPHands;
  HAND_CONNECTIONS: unknown;
  drawConnectors: (ctx: CanvasRenderingContext2D, lm: Landmark[], conns: unknown, opts: object) => void;
  drawLandmarks: (ctx: CanvasRenderingContext2D, lm: Landmark[], opts: object) => void;
}

const WORD_LIST = [
  "HELLO", "GOODBYE", "YES", "NO", "PLEASE", "THANKS", "SORRY", "HELP",
  "WANT", "NEED", "LIKE", "LOVE", "KNOW", "THINK", "FEEL", "SEE",
  "HEAR", "SAY", "TELL", "ASK", "GIVE", "TAKE", "COME", "GO",
  "EAT", "DRINK", "SLEEP", "WORK", "PLAY", "LEARN", "TEACH", "READ",
  "WRITE", "BUY", "PAY", "OPEN", "CLOSE", "STOP", "START", "WAIT",
  "FRIEND", "FAMILY", "MOTHER", "FATHER", "BABY", "HOME", "SCHOOL",
  "FOOD", "WATER", "GOOD", "BAD", "HAPPY", "SAD", "ANGRY", "SCARED",
  "BIG", "SMALL", "NEW", "OLD", "FAST", "SLOW", "HOT", "COLD",
  "MAN", "WOMAN", "BOY", "GIRL", "PERSON", "NAME", "WHAT", "WHERE",
  "WHEN", "WHO", "HOW", "WHY", "HOW-MUCH", "HOW-MANY", "MORE", "LESS",
  "ALL", "NONE", "EVERY", "SAME", "DIFFERENT", "MAYBE", "ALWAYS", "NEVER",
  "TODAY", "TOMORROW", "YESTERDAY", "NOW", "BEFORE", "AFTER", "WITH", "WITHOUT",
  "CAN", "CANNOT", "MUST", "SHOULD", "TRY",
];

export default function CollectPage() {
  const [selectedWord, setSelectedWord] = useState<string>(WORD_LIST[0]);
  const [recording, setRecording] = useState(false);
  const [bufferCount, setBufferCount] = useState(0);
  const [handDetected, setHandDetected] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [totalSamples, setTotalSamples] = useState(0);
  const [error, setError] = useState("");
  const [mediaReady, setMediaReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<MPHands | null>(null);
  const mpLibsRef = useRef<MPLibs | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const recordingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const s = await getStats();
      setStats(s);
      setTotalSamples(Object.values(s).reduce((a, b) => a + b, 0));
    })();
  }, [recording]);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const mpLibs = await loadMediaPipe() as unknown as MPLibs & { Hands: MPLibs["Hand"] };
      mpLibsRef.current = mpLibs;

      const hands = new mpLibs.Hands({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      });
      handsRef.current = hands;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMediaReady(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const clearBuffer = useCallback(() => {
    bufferRef.current = [];
    setBufferCount(0);
  }, []);

  const beginRecording = useCallback(() => {
    recordingRef.current = true;
    bufferRef.current = [];
    setRecording(true);
    setBufferCount(0);
  }, []);

useEffect(() => {
  if (!handsRef.current || !mpLibsRef.current || !mediaReady) return;

  handsRef.current.onResults((results: MPResults) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

  const lm = results.multiHandLandmarks?.[0] || null;
  if (lm) {
    setHandDetected(true);
    const mpl = mpLibsRef.current;
    if (mpl) {
      mpl.drawConnectors(ctx, lm, mpl.HAND_CONNECTIONS, { color: "#00e5b0", lineWidth: 3 });
      mpl.drawLandmarks(ctx, lm, { color: "#4f8cff", lineWidth: 1, radius: 3 });
    }
    const frame: number[][] = [];
    for (let i = 0; i < N_LANDMARKS; i++) {
      frame.push([lm[i].x, lm[i].y, lm[i].z || 0]);
    }
    bufferRef.current.push(new Float32Array(frame.flat()));
    setBufferCount(bufferRef.current.length);
  } else {
      setHandDetected(false);
    }
  });

  const frameLoop = async () => {
    if (handsRef.current && videoRef.current && recordingRef.current) {
      await handsRef.current.send({ image: videoRef.current });
    }
    requestAnimationFrame(frameLoop);
  };
  const raf = requestAnimationFrame(frameLoop);
  return () => cancelAnimationFrame(raf);
}, [mediaReady]);

  const saveRecording = useCallback(async () => {
    if (bufferRef.current.length < WORD_T_FRAMES) {
      setError(`Need at least ${WORD_T_FRAMES} frames. Got ${bufferRef.current.length}.`);
      return;
    }
  const sample: RecordingSample = {
    id: `${selectedWord}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    word: selectedWord,
    landmarks: Array.from(bufferRef.current).map((f) => {
      const flat = Array.from(f);
      const out: number[][] = [];
      for (let i = 0; i < N_LANDMARKS; i++) {
        out.push([flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2]]);
      }
      return out;
    }),
    timestamp: Date.now(),
    handedness: "right",
  };
    await saveSample(sample);
    recordingRef.current = false;
    setRecording(false);
    clearBuffer();
    const s = await getStats();
    setStats(s);
    setTotalSamples(Object.values(s).reduce((a, b) => a + b, 0));
  }, [selectedWord, clearBuffer]);

  const handleExport = useCallback(async () => {
    const samples = await getAllSamples();
    if (samples.length === 0) {
      setError("No samples recorded yet.");
      return;
    }
    const blob = new Blob([JSON.stringify(samples, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asl-collected-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportNpz = useCallback(async () => {
    const samples = await getAllSamples();
    if (samples.length === 0) {
      setError("No samples recorded yet.");
      return;
    }
    const pythonScript = generateNpzPython(samples);
    const blob = new Blob([pythonScript], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `build_dataset.py`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleClear = useCallback(async () => {
    if (!confirm("Delete ALL recorded samples? This cannot be undone.")) return;
    await clearAllSamples();
    setStats({});
    setTotalSamples(0);
  }, []);

  const handleDeleteOne = useCallback(async (id: string) => {
    await deleteSample(id);
    const s = await getStats();
    setStats(s);
    setTotalSamples(Object.values(s).reduce((a, b) => a + b, 0));
  }, []);

  const currentWordCount = stats[selectedWord] || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      <div className="mb-6">
        <Link
          href="/research"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent/80"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Research
        </Link>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Data Collection Studio
        </h1>
        <p className="mt-2 text-muted">
          Record yourself signing each word to build the real training dataset.
          All data stays on your device. Export as JSON or ready-to-use Python + NumPy (.npz) for model retraining.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Camera panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-line bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Webcam Capture</h2>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-medium border ${handDetected ? "border-ok/30 bg-ok/5 text-ok" : "border-line bg-elevated text-muted"}`}>
                  {handDetected ? "Hand detected" : "No hand"}
                </span>
                <span className="rounded-full border border-line bg-elevated px-2 py-0.5 text-[10px] font-mono text-muted">
                  {bufferCount}/{WORD_T_FRAMES} frames
                </span>
              </div>
            </div>
            <div className="relative aspect-video bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              {!mediaReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={startCamera}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent/90"
                  >
                    Start Camera
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Word selector + controls */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Target Word: <span className="text-foreground font-bold text-sm ml-1">{selectedWord}</span>
            </h2>
            <select
              value={selectedWord}
              onChange={(e) => { setSelectedWord(e.target.value); clearBuffer(); }}
              className="mb-4 w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-foreground"
            >
              {WORD_LIST.map((w) => (
                <option key={w} value={w}>{w} ({stats[w] || 0})</option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={beginRecording}
                disabled={!mediaReady || recording}
                className="rounded-lg bg-accent2 px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent2/90 disabled:opacity-50"
              >
                {recording ? "Recording…" : "● Record Sample"}
              </button>
              <button
                onClick={saveRecording}
                disabled={!recording || bufferCount < WORD_T_FRAMES}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                Save ({bufferCount}/{WORD_T_FRAMES})
              </button>
              <button
                onClick={clearBuffer}
                disabled={!mediaReady}
                className="rounded-lg border border-line bg-elevated px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
              >
                Clear Buffer
              </button>
            </div>

            <p className="mt-3 text-xs text-muted">
              Tip: Keep the camera at arm's length. Make sure your whole hand is in frame.
              Each sign should take 1-2 seconds. Aim for <strong className="text-foreground">5-10 recordings per word</strong> with slight variation in angle, speed, and position.
            </p>
          </div>
        </div>

        {/* Sidebar — stats + export */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Collection Progress</h2>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-2xl font-display font-bold text-foreground">{totalSamples}</span>
              <span className="text-sm text-muted">total recordings</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min(100, (totalSamples / (WORD_LIST.length * 10)) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-dim">Goal: {WORD_LIST.length * 10} samples (10/word)</p>
          </div>

          {/* Word breakdown */}
          <div className="rounded-2xl border border-line bg-surface p-5 max-h-[50vh] overflow-auto">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              Per-Word Count <span className="text-dim font-normal">(click to target)</span>
            </h2>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {WORD_LIST.map((w) => {
                const count = stats[w] || 0;
                const pct = Math.min(100, (count / 10) * 100);
                return (
                  <button
                    key={w}
                    onClick={() => { setSelectedWord(w); clearBuffer(); }}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-all text-left ${
                      w === selectedWord
                        ? "border-accent bg-accent/5"
                        : "border-line bg-elevated hover:border-accent/30"
                    }`}
                  >
                    <span className="font-mono font-medium truncate flex-1">{w}</span>
                    <span className={`font-mono ${count >= 5 ? "text-ok" : count > 0 ? "text-warn" : "text-dim"}`}>{count}</span>
                    <span className="h-1.5 w-8 overflow-hidden rounded-full bg-background">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Export & Train</h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleExport}
                className="rounded-lg border border-line bg-elevated px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground hover:border-accent/30"
              >
                Export as JSON ({totalSamples})
              </button>
              <button
                onClick={handleExportNpz}
                disabled={totalSamples === 0}
                className="rounded-lg bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
              >
                Export build_dataset.py (→ .npz)
              </button>
              <button
                onClick={handleClear}
                disabled={totalSamples === 0}
                className="rounded-lg border border-bad/20 bg-bad/5 px-3 py-2 text-xs font-medium text-bad transition-colors hover:bg-bad/10 disabled:opacity-50"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-bad/30 bg-bad/5 p-4 text-sm text-bad" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
