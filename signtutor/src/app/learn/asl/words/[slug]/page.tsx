"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { normalizeSequence, T_FRAMES, N_LANDMARKS, FEATURE_DIM } from "@/lib/seq-features";
import { DYNAMIC_SIGNS, SIGN_DESCRIPTIONS } from "@/lib/curriculum";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";
import type { Landmark } from "@/lib/normalize";

import "@/lib/mediapipe/holisticRunner";

type MediaPipeHands = { setOptions: (o: object) => void; onResults: (cb: (r: MediaPipeResults) => void) => void; send: (i: { image: HTMLVideoElement }) => Promise<void> };
type MediaPipeCamera = { start: () => void; stop: () => void };
type OrtSession = { run: (f: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> };
type OrtTensorCtor = new (type: string, data: Float32Array, dims: number[]) => unknown;
interface MediaPipeResults { multiHandLandmarks?: Landmark[][]; }

declare global {
  interface Window {
    Hands: new (opts: { locateFile: (f: string) => string }) => MediaPipeHands;
    Camera: new (video: HTMLVideoElement, opts: { onFrame: () => Promise<void>; width: number; height: number }) => MediaPipeCamera;
    HAND_CONNECTIONS: unknown;
    ort: { InferenceSession: { create: (path: string, opts: object) => Promise<OrtSession> }; Tensor: OrtTensorCtor };
  }
}

type Verdict = "match" | "close" | "miss";

interface RankedResult { label: string; prob: number; }

function computeTip(verdict: Verdict, top: RankedResult, target: string): string {
  if (verdict === "match") return `<strong>Nice — that's "${target}".</strong> Try once more to confirm.`;
  if (verdict === "miss") return "Couldn't read your sign clearly — try again with the hand fully in frame and consistent lighting.";
  if (top.label === target) return `Looks like "${target}" but confidence is only ${(top.prob * 100) | 0}%. Slow down and exaggerate the motion slightly.`;
  return `That came out closer to <strong>"${top.label}"</strong>. Re-watch the demo: <i>${SIGN_DESCRIPTIONS[target]}</i>`;
}

export default function DynamicSignPage() {
  const params = useParams();
  const slug = (params.slug as string || "hello").toLowerCase();
  const sign = slug.toUpperCase();

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<OrtSession | null>(null);
  const handsRef = useRef<MediaPipeHands | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Float32Array[]>([]);
  const fpsCounterRef = useRef({ frames: 0, t0: 0 });
  const framesSinceInferRef = useRef(0);
  const targetRef = useRef(sign);
  const recordingRef = useRef(false);
  const continuousRef = useRef(false);

  useEffect(() => { targetRef.current = sign; }, [sign]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  const runInference = useCallback(async (labels: string[], session: OrtSession, buf: Float32Array[], target: string) => {
    if (buf.length < T_FRAMES) return;
    const t0 = performance.now();
    const flat = normalizeSequence(buf);
    const tensor = new window.ort.Tensor("float32", flat, [1, T_FRAMES, FEATURE_DIM]);
    const out = await session.run({ input: tensor });
    const logits = out.logits.data;
    const max = Math.max(...logits);
    const exps = Array.from(logits, (v) => Math.exp(v - max));
    const sumE = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sumE);
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
        if (window.drawConnectors && window.HAND_CONNECTIONS) {
          window.drawConnectors(ctx, lm, window.HAND_CONNECTIONS, { color: "#7c9cff", lineWidth: 3 });
          window.drawLandmarks(ctx, lm, { color: "#5ee0c1", lineWidth: 1, radius: 3 });
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
          const labels = modelLabels;
          const session = sessionRef.current;
          const target = targetRef.current;
          if (session && labels.length > 0) {
            inferFn(labels, session, buf, target).finally(() => { setRecording(false); });
          }
        } else if (continuousRef.current && bufferRef.current.length >= T_FRAMES && framesSinceInferRef.current >= 10) {
          framesSinceInferRef.current = 0;
          const buf = bufferRef.current;
          const labels = modelLabels;
          const session = sessionRef.current;
          const target = targetRef.current;
          if (session && labels.length > 0) {
            inferFn(labels, session, buf, target);
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
    [modelLabels],
  );

  const onModelLoaded = useCallback((labels: string[], session: OrtSession, seqLen: number) => {
    sessionRef.current = session;
    setModelLabels(labels);
    setModelReady(true);
    setModelBadge(`Transformer · ${labels.length} signs · seq=${seqLen}`);
  }, []);

  const onModelError = useCallback(() => { setModelBadge("failed to load"); }, []);

  const onModelUnavailable = useCallback(() => { setModelBadge("ort.js unavailable"); }, []);

  const start = useCallback(async () => {
    if (running) return;

    if (!sessionRef.current && typeof window !== "undefined" && window.ort && !modelReady) {
      try {
        const session = await window.ort.InferenceSession.create("/models/dynamic_signs_transformer.onnx", { executionProviders: ["wasm"] });
        const resp = await fetch("/models/dynamic_labels.json");
        const meta = await resp.json();
        onModelLoaded(meta.labels, session, meta.seq_len);
      } catch {
        onModelError();
      }
    } else if (!modelReady && typeof window !== "undefined" && !window.ort) {
      onModelUnavailable();
    }

    if (!window.Hands) return;
    try {
      const hands = new window.Hands({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults((r: MediaPipeResults) => onResults(r, runInference));
      handsRef.current = hands;
    } catch { return; }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
    } catch { return; }

    const video = videoRef.current!;
    video.srcObject = streamRef.current;
    await video.play();
    if (overlayRef.current) {
      overlayRef.current.width = video.videoWidth || 640;
      overlayRef.current.height = video.videoHeight || 480;
    }

    cameraRef.current = new window.Camera(video, {
      onFrame: async () => { await handsRef.current!.send({ image: video }); },
      width: 640,
      height: 480,
    });
    cameraRef.current.start();
    setRunning(true);
  }, [running, onResults, runInference, modelReady, onModelLoaded, onModelError, onModelUnavailable]);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-3">
        <button onClick={start} disabled={running} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent/80 disabled:opacity-50">Start camera</button>
        <button onClick={startRecording} disabled={!running || recording || continuous} className="rounded-lg bg-accent2 px-4 py-2 text-sm font-semibold text-background hover:bg-accent2/80 disabled:opacity-50">● Record attempt (1.5 s)</button>
        <button onClick={stop} disabled={!running} className="rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50">Stop</button>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-muted">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={continuous} onChange={() => setContinuous(!continuous)} className="accent-accent" />
            Continuous
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={mirror} onChange={(e) => handleMirrorChange(e.target.checked)} className="accent-accent" />
            Mirror
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel" aria-label="Demo">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Target sign (mock demo)</h2>
            <span className="rounded-full bg-panel2 px-2.5 py-1 text-xs text-muted border border-line">Target: {sign}</span>
          </div>
          <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-radial from-[#1a2350] to-[#0b1020]">
            <div className="h-40 w-40 animate-pulse rounded-full bg-accent2/20" style={{ animationDuration: "1.6s" }} />
            <span className="absolute text-6xl font-bold tracking-wider text-foreground/90" style={{ textShadow: "0 4px 20px rgba(94,224,193,0.4)" }}>{sign}</span>
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-background/70 px-3 py-2 text-sm text-muted backdrop-blur-sm">
              {SIGN_DESCRIPTIONS[sign] || ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {DYNAMIC_SIGNS.map((s) => (
              <Link
                key={s}
                href={`/learn/asl/words/${s.toLowerCase()}`}
                aria-label={`Practice sign ${s}`}
                className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${s === sign ? "bg-accent2 font-semibold text-background" : "border border-line bg-panel2 text-muted hover:text-foreground"}`}
              >
                {s}
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel" aria-label="Your attempt">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">You · Webcam</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-panel2 px-2.5 py-1 text-xs text-muted border border-line">Buffer: {bufferCount}/{T_FRAMES}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ok">🔒 On-device</span>
            </div>
          </div>
          <div className={`relative aspect-[4/3] bg-black ${mirror ? "[transform:scaleX(-1)]" : ""}`}>
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
            <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute left-2.5 right-2.5 top-2.5 flex justify-between pointer-events-none">
              <span className="rounded-full bg-background/75 px-2.5 py-1 text-xs backdrop-blur-sm border border-line">{hudHand}</span>
              <span className="rounded-full bg-background/75 px-2.5 py-1 text-xs backdrop-blur-sm border border-line">{hudLatency}</span>
            </div>
          </div>

          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">Recording window</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-accent2 transition-all" style={{ width: `${(bufferCount / T_FRAMES) * 100}%` }} />
              </div>
              <span className="text-xs text-muted">{bufferCount}/{T_FRAMES} frames</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className={`flex items-center justify-between rounded-xl p-4 border ${
              verdict === "match" ? "border-ok/40 bg-ok/10" : verdict === "close" ? "border-warn/40 bg-warn/10" : verdict === "miss" ? "border-bad/40 bg-bad/10" : "border-line bg-accent/5"
            }`}>
              <div>
                <span className="block text-xs uppercase tracking-wider text-muted">Top prediction</span>
                <span className={`text-3xl font-bold leading-tight ${
                  verdict === "match" ? "text-ok" : verdict === "close" ? "text-warn" : verdict === "miss" ? "text-bad" : ""
                }`}>{detected}</span>
              </div>
              <div className="text-right text-sm text-muted">
                confidence
                <span className="mt-0.5 block text-2xl font-bold text-foreground">{confidence}</span>
              </div>
            </div>

            {modelReady && topK.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                {topK.map((r, i) => (
                  <div key={r.label} className="grid grid-cols-[80px_1fr_50px] items-center gap-2 text-sm">
                    <span>{r.label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-line">
                      <div className={`h-full transition-all ${i === 0 ? "bg-accent2" : "bg-accent"}`} style={{ width: `${r.prob * 100}%` }} />
                    </div>
                    <span className="text-right text-muted">{(r.prob * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-line bg-accent/5 p-3 text-sm" role="status">
              <span dangerouslySetInnerHTML={{ __html: tip.replace(/<strong>/g, '<strong class="text-accent">').replace(/<i>/g, '<i class="text-muted">') }} />
            </div>
          </div>

          <div className="flex gap-2 px-4 pb-3 text-xs text-muted">
            <span className={`rounded-full border px-2 py-0.5 ${modelReady ? "border-ok/40 bg-ok/10 text-ok" : "border-bad/40 bg-bad/10 text-bad"}`}>{modelBadge}</span>
            <span className="rounded-full border border-line bg-panel2 px-2 py-0.5">FPS: {fps}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
