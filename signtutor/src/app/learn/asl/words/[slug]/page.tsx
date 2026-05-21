"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { normalizeSequence, T_FRAMES, N_LANDMARKS, FEATURE_DIM } from "@/lib/seq-features";
import { DYNAMIC_SIGNS, SIGN_DESCRIPTIONS } from "@/lib/curriculum";
import { VOCABULARY_200, getSignById } from "@/lib/vocabulary_200";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";
import { loadMediaPipe, loadONNX, type MediaPipeLibs, type ONNXLibs } from "@/lib/loadExternals";

type MediaPipeHands = { setOptions: (o: object) => void; onResults: (cb: (r: MediaPipeResults) => void) => void; send: (i: { image: HTMLVideoElement }) => Promise<void> };
type MediaPipeCamera = { start: () => void; stop: () => void };
type OrtSession = { run: (f: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> };
interface MediaPipeResults { multiHandLandmarks?: { x: number; y: number; z: number }[][]; }

type Verdict = "match" | "close" | "miss";
interface RankedResult { label: string; prob: number; }

function computeTip(verdict: Verdict, top: RankedResult, target: string): string {
  const desc = SIGN_DESCRIPTIONS[target as keyof typeof SIGN_DESCRIPTIONS] || target;
  if (verdict === "match") return `<strong>Nice — that's "${target}".</strong> Try once more to confirm.`;
  if (verdict === "miss") return "Couldn't read your sign clearly — try again with the hand fully in frame and consistent lighting.";
  if (top.label === target) return `Looks like "${target}" but confidence is only ${(top.prob * 100) | 0}%. Slow down and exaggerate the motion slightly.`;
  return `That came out closer to <strong>"${top.label}"</strong>. Re-watch the demo: <i>${desc}</i>`;
}

const ML_SIGNS = new Set<string>(DYNAMIC_SIGNS as unknown as string[]);

export default function DynamicSignPage() {
  const params = useParams();
  const slug = (params.slug as string || "hello").toLowerCase();

  const vocabSign = getSignById(slug);
  const isMLSign = ML_SIGNS.has(slug.toUpperCase());
  const signGloss = vocabSign ? vocabSign.gloss : slug.toUpperCase();
  const signDescription = vocabSign ? vocabSign.description : (SIGN_DESCRIPTIONS[signGloss as keyof typeof SIGN_DESCRIPTIONS] || "");
  const signCategory = vocabSign ? vocabSign.category : "";

  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof window === "undefined") return { language: "asl", handedness: "right", mirror: true };
    return loadPrefs();
  });
  const [modelReady, setModelReady] = useState(false);
  const [modelLabels, setModelLabels] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [bufferCount, setBufferCount] = useState(0);
  const [detected, setDetected] = useState("—");
  const [confidence, setConfidence] = useState("—");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [topK, setTopK] = useState<RankedResult[]>([]);
  const [tip, setTip] = useState("Click Start camera, pick a target sign, then click Record attempt and perform the sign.");
  const [hudHand, setHudHand] = useState("No hand detected");
  const [hudLatency, setHudLatency] = useState("— ms");
  const [modelBadge, setModelBadge] = useState("Model: loading…");
  const [fps, setFps] = useState("—");
  const [loadingExternals, setLoadingExternals] = useState(false);
  const [externalsError, setExternalsError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<OrtSession | null>(null);
  const handsRef = useRef<MediaPipeHands | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const fpsCounterRef = useRef({ frames: 0, t0: 0 });
  const framesSinceInferRef = useRef(0);
  const targetRef = useRef(signGloss);
  const recordingRef = useRef(false);
  const continuousRef = useRef(false);
  const mpLibsRef = useRef<MediaPipeLibs | null>(null);
  const onnxLibsRef = useRef<ONNXLibs | null>(null);
  const modelLabelsRef = useRef<string[]>([]);

  useEffect(() => { targetRef.current = signGloss; }, [signGloss]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  const runInference = useCallback(async (session: OrtSession, buf: Float32Array[], target: string) => {
    if (buf.length < T_FRAMES) return;
    const t0 = performance.now();
    const flat = normalizeSequence(buf);
    if (!onnxLibsRef.current) return;
    const tensor = new onnxLibsRef.current.Tensor("float32", flat, [1, T_FRAMES, FEATURE_DIM]);
    const out = await session.run({ input: tensor });
    const logits = out.logits.data;
    const max = Math.max(...logits);
    const exps = Array.from(logits, (v) => Math.exp(v - max));
    const sumE = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sumE);
    const labels = modelLabelsRef.current;
    const ranked = probs.map((p, i) => ({ label: labels[i] || String(i), prob: p })).sort((a, b) => b.prob - a.prob);
    const dt = performance.now() - t0;
    setHudLatency(`${dt.toFixed(0)} ms`);

    const top = ranked[0];
    setDetected(top.label);
    setConfidence(`${(top.prob * 100).toFixed(0)}%`);
    setTopK(ranked.slice(0, 5));

    let v: Verdict;
    if (top.prob < 0.5) v = "miss";
    else if (top.label === target && top.prob >= 0.75) v = "match";
    else v = "close";
    setVerdict(v);
    setTip(computeTip(v, top, target));
  }, []);

  const onResults = useCallback(
    (results: MediaPipeResults, inferFn: typeof runInference) => {
      const ctx = overlayRef.current?.getContext("2d");
      if (!ctx || !overlayRef.current) return;
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      const lm = results.multiHandLandmarks?.[0] || null;
      if (lm) {
        setHudHand("Hand detected");
        const libs = mpLibsRef.current;
        if (libs) {
          libs.drawConnectors(ctx, lm, libs.HAND_CONNECTIONS, { color: "#00e5b0", lineWidth: 3 });
          libs.drawLandmarks(ctx, lm, { color: "#4f8cff", lineWidth: 1, radius: 3 });
        }
        const arr = new Float32Array(N_LANDMARKS * 3);
        for (let i = 0; i < N_LANDMARKS; i++) {
          arr[i * 3 + 0] = lm[i].x;
          arr[i * 3 + 1] = lm[i].y;
          arr[i * 3 + 2] = lm[i].z || 0;
        }
        bufferRef.current.push(arr);
        if (bufferRef.current.length > T_FRAMES) bufferRef.current.shift();
        setBufferCount(bufferRef.current.length);

        framesSinceInferRef.current++;
        if (recordingRef.current && bufferRef.current.length >= T_FRAMES) {
          const buf = bufferRef.current;
          const session = sessionRef.current;
          const target = targetRef.current;
          if (session && modelLabelsRef.current.length > 0) {
            inferFn(session, buf, target).finally(() => { setRecording(false); });
          }
        } else if (continuousRef.current && bufferRef.current.length >= T_FRAMES && framesSinceInferRef.current >= 10) {
          framesSinceInferRef.current = 0;
          const buf = bufferRef.current;
          const session = sessionRef.current;
          const target = targetRef.current;
          if (session && modelLabelsRef.current.length > 0) {
            inferFn(session, buf, target);
          }
        }
      } else {
        setHudHand("No hand detected");
      }
      const fc = fpsCounterRef.current;
      if (fc.t0 === 0) fc.t0 = performance.now();
      fc.frames++;
      const now = performance.now();
      if (now - fc.t0 > 1000) {
        setFps(`${(fc.frames * 1000 / (now - fc.t0)).toFixed(0)}`);
        fc.frames = 0;
        fc.t0 = now;
      }
    },
    [],
  );

  const onModelLoaded = useCallback((labels: string[], session: OrtSession, seqLen: number) => {
    sessionRef.current = session;
    modelLabelsRef.current = labels;
    setModelLabels(labels);
    setModelReady(true);
    setModelBadge(`Transformer · ${labels.length} signs · seq=${seqLen}`);
  }, []);

  const onModelError = useCallback(() => { setModelBadge("failed to load"); }, []);

  const start = useCallback(async () => {
    if (running) return;
    setLoadingExternals(true);
    setExternalsError("");

    try {
      // Load MediaPipe Hands
      if (!mpLibsRef.current) {
        mpLibsRef.current = await loadMediaPipe();
      }
      const mpLibs = mpLibsRef.current;

      // Load ONNX Runtime
      if (!onnxLibsRef.current && !modelReady) {
        try {
          onnxLibsRef.current = await loadONNX();
        } catch {
          setModelBadge("ort.js unavailable");
        }
      }

      // Load ML model
      if (!sessionRef.current && onnxLibsRef.current && !modelReady) {
        try {
          const session = await onnxLibsRef.current.InferenceSession.create("/models/dynamic_signs_transformer.onnx", { executionProviders: ["wasm"] });
          const resp = await fetch("/models/dynamic_labels.json");
          const meta = await resp.json();
          onModelLoaded(meta.labels, session, meta.seq_len);
        } catch {
          onModelError();
        }
      }

      // Create Hands instance
      const hands = new mpLibs.Hands({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults((r: MediaPipeResults) => onResults(r, runInference));
      handsRef.current = hands;

      // Get camera stream
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });

      const video = videoRef.current!;
      video.srcObject = streamRef.current;
      await video.play();
      if (overlayRef.current) {
        overlayRef.current.width = video.videoWidth || 640;
        overlayRef.current.height = video.videoHeight || 480;
      }

      const camera = new mpLibs.Camera(video, {
        onFrame: async () => { await handsRef.current!.send({ image: video }); },
        width: 640,
        height: 480,
      });
      cameraRef.current = camera;
      camera.start();
      setRunning(true);
    } catch (e) {
      setExternalsError((e as Error).message);
    } finally {
      setLoadingExternals(false);
    }
  }, [running, onResults, runInference, modelReady, onModelLoaded, onModelError]);

  const stop = useCallback(() => {
    try { cameraRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRunning(false);
    setRecording(false);
    bufferRef.current.length = 0;
    setBufferCount(0);
    setHudHand("No hand detected");
  }, []);

  const startRecording = useCallback(() => {
    bufferRef.current.length = 0;
    setBufferCount(0);
    setRecording(true);
    setTip(`Recording <strong>${targetRef.current}</strong>… perform the sign now.`);
  }, []);

  const mirror = prefs.mirror;
  const handleMirrorChange = (checked: boolean) => {
    const next = { ...prefs, mirror: checked };
    setPrefs(next);
    savePrefs(next);
  };

  // ── Reference-only view (no ML model) ──
  if (!isMLSign && vocabSign) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-8">
        <Link
          href="/learn/asl/words"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Vocabulary
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                  {vocabSign.category}
                </span>
                <span className="text-xs font-mono text-dim">
                  ASL-LEX #{vocabSign.aslLexRank}
                </span>
              </div>

              <h1 className="text-3xl font-display font-bold text-foreground">
                {vocabSign.gloss}
              </h1>
              <p className="mt-3 text-lg leading-relaxed text-muted">
                {vocabSign.description}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Handshape", value: vocabSign.handshape },
                  { label: "Location", value: vocabSign.location },
                  { label: "Movement", value: vocabSign.movement },
                  { label: "Orientation", value: vocabSign.orientation },
                ].map((param) => (
                  <div key={param.label} className="rounded-xl border border-line bg-elevated/50 p-3">
                    <span className="block text-[10px] uppercase tracking-wider text-muted">{param.label}</span>
                    <span className="mt-1 block text-sm font-medium text-foreground">{param.value}</span>
                  </div>
                ))}
              </div>

              {vocabSign.nmm && (
                <div className="mt-4 rounded-xl border border-line bg-elevated/50 p-3">
                  <span className="block text-[10px] uppercase tracking-wider text-muted">Non-Manual Markers</span>
                  <span className="mt-1 block text-sm text-foreground">{vocabSign.nmm}</span>
                </div>
              )}

              <p className="mt-4 text-xs text-dim">Source: {vocabSign.sourceAttr}</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Sign Info</h3>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-xs text-muted">Gloss</dt><dd className="font-medium text-foreground">{vocabSign.gloss}</dd></div>
                <div><dt className="text-xs text-muted">Category</dt><dd className="font-medium text-foreground">{vocabSign.category}</dd></div>
                <div><dt className="text-xs text-muted">ASL-LEX Rank</dt><dd className="font-medium text-foreground">#{vocabSign.aslLexRank}</dd></div>
                <div><dt className="text-xs text-muted">Handshape</dt><dd className="font-medium text-foreground">{vocabSign.handshape}</dd></div>
              </dl>

              <div className="mt-5 rounded-xl border border-dashed border-line bg-accent/5 p-3 text-xs text-muted">
                <p className="font-medium text-foreground mb-1">Reference Only</p>
                <p>This sign doesn't have real-time ML feedback yet. Practice with the <Link href="/learn/asl/words/hello" className="text-accent hover:underline">8 ML-enabled signs</Link> for interactive practice.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ML practice view ──
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
        <Link
          href="/learn/asl/words"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-foreground"
          aria-label="Back to words"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 20 20">
            <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent2/10 text-lg font-display font-bold text-accent2">
            {signGloss.charAt(0)}
          </span>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{signGloss}</h1>
            <p className="text-xs text-muted">{signDescription}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={start}
            disabled={running || loadingExternals}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {loadingExternals ? "Loading…" : "Start camera"}
          </button>
          <button
            onClick={startRecording}
            disabled={!running || recording || continuous}
            className="rounded-lg bg-accent2 px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-accent2/90 disabled:opacity-50"
          >
            ● Record (1.5s)
          </button>
          <button
            onClick={stop}
            disabled={!running}
            className="rounded-lg border border-line bg-elevated px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Stop
          </button>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={continuous} onChange={() => setContinuous(!continuous)} className="rounded border-line bg-elevated accent-accent" />
            Continuous
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={mirror} onChange={(e) => handleMirrorChange(e.target.checked)} className="rounded border-line bg-elevated accent-accent" />
            Mirror
          </label>
        </div>
      </div>

      {/* Error banner */}
      {externalsError && (
        <div className="mb-6 rounded-xl border border-bad/30 bg-bad/5 p-4 text-sm text-bad" role="alert">
          <p className="font-semibold">Failed to load external libraries</p>
          <p className="mt-1 text-xs">{externalsError}</p>
          <p className="mt-2 text-xs text-muted">Check your internet connection and try refreshing the page.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Demo panel */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Demo">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Target Sign</h2>
            <span className="rounded-full bg-accent2/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent2">
              Target: {signGloss}
            </span>
          </div>

          <div
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
            style={{
              background: "radial-gradient(ellipse at center, rgba(0, 229, 176, 0.06) 0%, var(--bg-surface) 70%)",
            }}
          >
            <div className="h-40 w-40 animate-pulse rounded-full bg-accent2/20" style={{ animationDuration: "1.6s" }} />
            <span className="absolute text-6xl font-display font-bold tracking-wider text-foreground/90" style={{ textShadow: "0 4px 20px rgba(0, 229, 176, 0.4)" }}>
              {signGloss}
            </span>
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-background/70 px-3 py-2 text-sm text-muted backdrop-blur-sm">
              {signDescription}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-line p-3">
            {DYNAMIC_SIGNS.map((s) => (
              <Link
                key={s}
                href={`/learn/asl/words/${s.toLowerCase()}`}
                aria-label={`Practice sign ${s}`}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150 ${
                  s === signGloss
                    ? "bg-accent2 text-background"
                    : "border border-line bg-elevated text-muted hover:border-accent/30 hover:text-foreground"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        </section>

        {/* Webcam + feedback */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Your attempt">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Your Attempt</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-line bg-elevated px-2 py-0.5 text-[10px] font-mono text-muted">
                Buffer: {bufferCount}/{T_FRAMES}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
                On-device
              </span>
            </div>
          </div>

          <div className={`relative aspect-[4/3] overflow-hidden bg-black ${mirror ? "[transform:scaleX(-1)]" : ""}`}>
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
            <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute left-3 right-3 top-3 flex justify-between pointer-events-none">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm border ${
                hudHand === "Hand detected"
                  ? "border-ok/30 bg-ok/10 text-ok"
                  : "border-line bg-background/60 text-muted"
              }`}>
                {hudHand}
              </span>
              <span className="rounded-full border border-line bg-background/60 px-2.5 py-1 text-[10px] font-mono text-muted backdrop-blur-sm">
                {hudLatency}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">Recording</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                <div className="h-full rounded-full bg-accent2 transition-all" style={{ width: `${(bufferCount / T_FRAMES) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-muted">{bufferCount}/{T_FRAMES}</span>
            </div>

            <div className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
              verdict === "match" ? "border-ok/30 bg-ok/5" : verdict === "close" ? "border-warn/30 bg-warn/5" : verdict === "miss" ? "border-bad/30 bg-bad/5" : "border-line bg-elevated/50"
            }`}>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-muted">Top prediction</span>
                <span className={`text-3xl font-display font-bold leading-none ${
                  verdict === "match" ? "text-ok" : verdict === "close" ? "text-warn" : verdict === "miss" ? "text-bad" : "text-foreground"
                }`}>
                  {detected}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-muted">Confidence</span>
                <span className="text-2xl font-display font-bold text-foreground">{confidence}</span>
              </div>
            </div>

            {modelReady && topK.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {topK.map((r, i) => (
                  <div key={r.label} className="grid grid-cols-[60px_1fr_40px] items-center gap-2 text-xs">
                    <span className={`font-mono font-medium ${r.label === signGloss ? "text-accent" : "text-muted"}`}>{r.label}</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                      <div className={`h-full rounded-full transition-all duration-200 ${i === 0 ? "bg-accent" : "bg-accent/40"}`} style={{ width: `${r.prob * 100}%` }} />
                    </div>
                    <span className="text-right font-mono text-muted">{(r.prob * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-line bg-accent/5 p-3 text-sm text-muted" role="status" aria-live="polite">
              <span dangerouslySetInnerHTML={{ __html: tip.replace(/<strong>/g, '<strong class="text-accent">').replace(/<i>/g, '<i class="text-muted">') }} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${modelReady ? "border-ok/30 bg-ok/5 text-ok" : "border-bad/30 bg-bad/5 text-bad"}`}>
              {modelBadge}
            </span>
            <span className="rounded-full border border-line bg-elevated px-2 py-0.5 text-[10px] font-mono">FPS: {fps}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
