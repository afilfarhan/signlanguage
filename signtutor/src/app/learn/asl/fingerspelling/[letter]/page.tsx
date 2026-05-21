"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  normalize,
  fingerStates,
  inSameGroup,
  classifyRule,
  palmFacingCamera,
  locationLabel,
  recentMovement,
  PATTERNS,
  type Landmark,
  type FingerStates,
  type FingerKey,
  type MovementPoint,
} from "@/lib/normalize";
import { LETTER_DESCRIPTIONS, STATIC_LETTERS, ASL_REF_IMAGES } from "@/lib/curriculum";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";

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
type Mode = "ml" | "rule";

interface RankedResult { label: string; prob: number; }

function chooseTip(
  c: { shape: number; orient: number; loc: number; move: number },
  top: RankedResult,
  target: string,
  orient: ReturnType<typeof palmFacingCamera>,
  ruleStates: FingerStates,
): string {
  if (top.label === target && c.shape >= 0.75 && c.orient > 0.5 && c.move > 0.5) {
    return `Nice — that looks like "${target}". Hold it for a beat to confirm.`;
  }
  if (top.label !== target && inSameGroup(top.label, target) && top.prob > 0.4) {
    return `Reads as "${top.label}", which is the same handshape family as "${target}" in this model. Hold the sign confidently.`;
  }
  if (top.label !== target && top.prob > 0.6) {
    return `Looks closer to "${top.label}". For "${target}": ${(LETTER_DESCRIPTIONS[target] || "").toLowerCase()}`;
  }
  if (c.shape < 0.5) {
    const ref = PATTERNS[target];
    if (ref) {
      for (const finger of ["thumb", "index", "middle", "ring", "pinky"] as FingerKey[]) {
        if (ref[finger] !== ruleStates[finger]) {
          return ref[finger] ? `Try extending your ${finger} for "${target}".` : `Try curling your ${finger} in for "${target}".`;
        }
      }
    }
    return `Adjust your handshape to match "${target}".`;
  }
  const ranked = ([["orient", c.orient], ["loc", c.loc], ["move", c.move]] as [string, number][]).sort((a, b) => a[1] - b[1]);
  const [worstKey, worstVal] = ranked[0];
  if (worstVal > 0.7) return "Almost — keep going.";
  if (worstKey === "orient") return "Rotate your palm toward the camera.";
  if (worstKey === "loc") return "Bring your hand into the neutral signing space in front of your chest.";
  if (worstKey === "move") return "Hold the sign still — fingerspelling letters are static.";
  return "Keep going.";
}

export default function FingerspellingLetterPage() {
  const params = useParams();
  const letter = (params.letter as string || "A").toUpperCase();

  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof window === "undefined") return { language: "asl", handedness: "right", mirror: true };
    return loadPrefs();
  });
  const [mode, setMode] = useState<Mode>("ml");
  const [modelReady, setModelReady] = useState(false);
  const [modelLabels, setModelLabels] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [detected, setDetected] = useState("—");
  const [confidence, setConfidence] = useState("—");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [topK, setTopK] = useState<RankedResult[]>([]);
  const [fingers, setFingers] = useState<FingerStates>({ thumb: false, index: false, middle: false, ring: false, pinky: false });
  const [tip, setTip] = useState("Click Start camera and choose a target letter to begin practicing.");
  const [components, setComponents] = useState({ shape: 0, orient: 0, loc: 0, move: 0 });
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
  const movementBufRef = useRef<MovementPoint[]>([]);
  const fpsCounterRef = useRef({ frames: 0, t0: 0 });
  const mpLatencyRef = useRef(0);
  const clfLatencyRef = useRef(0);
  const modeRef = useRef<Mode>("ml");
  const modelReadyRef = useRef(false);
  const targetRef = useRef(letter);

  useEffect(() => { targetRef.current = letter; }, [letter]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { modelReadyRef.current = modelReady; }, [modelReady]);

  const runModel = useCallback(async (landmarks: Landmark[], labels: string[], session: OrtSession): Promise<RankedResult[] | null> => {
    try {
      const t0 = performance.now();
      const feats = normalize(landmarks);
      const tensor = new window.ort.Tensor("float32", feats, [1, 63]);
      const out = await session.run({ input: tensor });
      clfLatencyRef.current = performance.now() - t0;
      const probs = out.probabilities.data;
      return Array.from(probs).map((p, i) => ({ label: labels[i] || String(i), prob: p })).sort((a, b) => b.prob - a.prob);
    } catch { return null; }
  }, []);

  const classifyAndScore = useCallback(async (lm: Landmark[]) => {
    const states = fingerStates(lm);
    setFingers(states);
    const target = targetRef.current;
    const orient = palmFacingCamera(lm);
    const loc = locationLabel(lm);
    const movement = recentMovement(movementBufRef.current);

    let ranked: RankedResult[] | null = null;
    if (modeRef.current === "ml" && modelReadyRef.current && sessionRef.current) {
      ranked = await runModel(lm, modelLabels, sessionRef.current);
    }
    if (!ranked) {
      const r = classifyRule(lm);
      ranked = r.ranked;
      clfLatencyRef.current = 0;
    }

    const top = ranked[0];
    const targetEntry = ranked.find((r) => r.label === target);
    const shapeScore = targetEntry ? targetEntry.prob : 0;

    const comps = {
      shape: shapeScore,
      orient: orient.facing ? 1 : 0.4,
      loc: loc.startsWith("middle") ? 1 : 0.6,
      move: movement < 0.05 ? 1 : movement < 0.15 ? 0.6 : 0.2,
    };
    setComponents(comps);

    const conf = comps.shape * 0.55 + comps.orient * 0.15 + comps.loc * 0.1 + comps.move * 0.2;

    let v: Verdict = "close";
    if (top.label === target && comps.shape >= 0.5 && conf >= 0.65) v = "match";
    else if (inSameGroup(top.label, target) && comps.shape >= 0.3) v = "close";
    else if (conf < 0.3 || comps.shape < 0.1) v = "miss";

    setDetected(top.label);
    setConfidence(conf > 0 ? `${(conf * 100).toFixed(0)}%` : "—");
    setVerdict(v);
    setTopK(ranked.slice(0, 5));
    setTip(chooseTip(comps, top, target, orient, states));
  }, [runModel, modelLabels]);

  const onResults = useCallback(
    (results: MediaPipeResults) => {
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
        movementBufRef.current.push({ x: lm[0].x, y: lm[0].y, t: performance.now() });
        if (movementBufRef.current.length > 30) movementBufRef.current.shift();
        classifyAndScore(lm);
      } else {
        setHudHand("No hand detected");
        movementBufRef.current.length = 0;
        setDetected("—");
        setConfidence("—");
        setVerdict(null);
        setTopK([]);
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
    [classifyAndScore],
  );

  const onModelLoaded = useCallback((labels: string[], session: OrtSession) => {
    sessionRef.current = session;
    setModelLabels(labels);
    setModelReady(true);
    setModelBadge(`MLP · ${labels.length} classes`);
  }, []);

  const onModelError = useCallback(() => {
    setModelBadge("failed to load");
    setMode("rule");
  }, []);

  const onModelUnavailable = useCallback(() => {
    setModelBadge("ort.js unavailable");
    setMode("rule");
  }, []);

  const startCamera = useCallback(async () => {
    if (running) return;

    if (!sessionRef.current && typeof window !== "undefined" && window.ort && !modelReady) {
      try {
        const session = await window.ort.InferenceSession.create("/models/fingerspell_mlp.onnx", { executionProviders: ["wasm"] });
        const resp = await fetch("/models/labels.json");
        const meta = await resp.json();
        onModelLoaded(meta.labels, session);
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
      hands.onResults(onResults);
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
      onFrame: async () => {
        const t0 = performance.now();
        await handsRef.current!.send({ image: video });
        mpLatencyRef.current = performance.now() - t0;
        setHudLatency(`mp ${mpLatencyRef.current.toFixed(0)}ms · clf ${clfLatencyRef.current.toFixed(0)}ms`);
      },
      width: 640,
      height: 480,
    });
    cameraRef.current.start();
    setRunning(true);
  }, [running, onResults, modelReady, onModelLoaded, onModelError, onModelUnavailable]);

  const stop = useCallback(() => {
    try { cameraRef.current?.stop(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRunning(false);
    setHudHand("No hand detected");
  }, []);

  const mirror = prefs.mirror;

  const handleMirrorChange = (checked: boolean) => {
    const next = { ...prefs, mirror: checked };
    setPrefs(next);
    savePrefs(next);
  };

  const handleHandednessChange = () => {
    const next: Prefs = { ...prefs, handedness: prefs.handedness === "left" ? "right" : "left" };
    setPrefs(next);
    savePrefs(next);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel p-3">
        <label className="text-sm text-muted" htmlFor="mode-sel">Classifier</label>
        <span className="inline-flex overflow-hidden rounded-lg border border-line bg-panel2" role="radiogroup" aria-label="Classifier mode">
          <button
            role="radio"
            aria-checked={mode === "ml"}
            onClick={() => { if (modelReady) setMode("ml"); }}
            className={`px-3 py-1.5 text-sm ${mode === "ml" ? "bg-accent font-semibold text-background" : "text-muted hover:text-foreground"}`}
          >
            ML (ONNX)
          </button>
          <button
            role="radio"
            aria-checked={mode === "rule"}
            onClick={() => setMode("rule")}
            className={`px-3 py-1.5 text-sm ${mode === "rule" ? "bg-accent font-semibold text-background" : "text-muted hover:text-foreground"}`}
          >
            Rule-based
          </button>
        </span>

        <button onClick={startCamera} disabled={running} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent/80 disabled:opacity-50">Start camera</button>
        <button onClick={stop} disabled={!running} className="rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50">Stop</button>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-muted">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={mirror} onChange={(e) => handleMirrorChange(e.target.checked)} className="accent-accent" />
            Mirror webcam
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={prefs.handedness === "left"} onChange={handleHandednessChange} className="accent-accent" />
            Left-handed
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel" aria-label="Demo">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">Demo · Native signer (mock)</h2>
            <span className="rounded-full bg-panel2 px-2.5 py-1 text-xs text-muted border border-line">Target: {letter}</span>
          </div>
          <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-radial from-[#1a2350] to-[#0b1020]">
            <img
              src={ASL_REF_IMAGES[letter] || ""}
              alt={`ASL letter ${letter}: handshape reference`}
              className="h-48 w-48 object-contain"
            />
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-background/70 px-3 py-2 text-sm text-muted backdrop-blur-sm">
              {LETTER_DESCRIPTIONS[letter] || ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {STATIC_LETTERS.map((l) => (
              <Link
                key={l}
                href={`/learn/asl/fingerspelling/${l}`}
                aria-label={`Practice letter ${l}`}
                className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${l === letter ? "bg-accent font-semibold text-background" : "border border-line bg-panel2 text-muted hover:text-foreground"}`}
              >
                {l}
              </Link>
            ))}
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-panel" aria-label="Your attempt">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">You · Webcam</h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ok">🔒 On-device</span>
          </div>
          <div className={`relative aspect-[4/3] bg-black ${mirror ? "[transform:scaleX(-1)]" : ""}`}>
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
            <canvas ref={overlayRef} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute left-2.5 right-2.5 top-2.5 flex justify-between pointer-events-none">
              <span className="rounded-full bg-background/75 px-2.5 py-1 text-xs backdrop-blur-sm border border-line">{hudHand}</span>
              <span className="rounded-full bg-background/75 px-2.5 py-1 text-xs backdrop-blur-sm border border-line">{hudLatency}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className={`flex items-center justify-between rounded-xl p-4 border ${
              verdict === "match" ? "border-ok/40 bg-ok/10" : verdict === "close" ? "border-warn/40 bg-warn/10" : verdict === "miss" ? "border-bad/40 bg-bad/10" : "border-line bg-accent/5"
            }`}>
              <div>
                <span className="block text-xs uppercase tracking-wider text-muted">{mode === "ml" ? "Detected (ML)" : "Detected (rule)"}</span>
                <span className={`text-3xl font-bold leading-tight ${
                  verdict === "match" ? "text-ok" : verdict === "close" ? "text-warn" : verdict === "miss" ? "text-bad" : ""
                }`}>{detected}</span>
              </div>
              <div className="text-right text-sm text-muted">
                confidence
                <span className="mt-0.5 block text-2xl font-bold text-foreground">{confidence}</span>
              </div>
            </div>

            {mode === "ml" && modelReady && topK.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                {topK.map((r, i) => (
                  <div key={r.label} className="grid grid-cols-[50px_1fr_50px] items-center gap-2 text-sm">
                    <span>{r.label}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-line">
                      <div className={`h-full transition-all ${i === 0 ? "bg-accent2" : "bg-accent"}`} style={{ width: `${r.prob * 100}%` }} />
                    </div>
                    <span className="text-right text-muted">{(r.prob * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-line bg-panel2 p-2.5" aria-label="Per-finger handshape match">
              {(["thumb", "index", "middle", "ring", "pinky"] as FingerKey[]).map((f) => {
                const ref = PATTERNS[letter]?.[f];
                const you = fingers[f];
                const ok = ref !== undefined ? you === ref : null;
                return (
                  <div key={f} className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-center ${ok === true ? "bg-ok/10" : ok === false ? "bg-bad/10" : ""}`}>
                    <span className="text-[10px] uppercase tracking-wider text-muted">{f}</span>
                    <span className={`text-lg leading-none ${ok === true ? "text-ok" : ok === false ? "text-bad" : "text-muted"}`}>
                      {you ? "✓" : "✗"}
                    </span>
                    <span className={`text-[10px] ${ok === true ? "text-ok" : ok === false ? "text-bad" : "text-muted"}`}>
                      {ok === true ? (ref ? "extend ✓" : "curl ✓") : ok === false ? (ref ? "should extend" : "should curl") : you ? "extended" : "curled"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "shape", label: "Handshape", val: components.shape, text: `${(components.shape * 100) | 0}% probability of "${letter}"` },
                { key: "orient", label: "Orientation", val: components.orient, text: components.orient > 0.5 ? "palm forward ✓" : "rotate palm toward camera" },
                { key: "loc", label: "Location", val: components.loc, text: locationLabel([{ x: 0.5, y: 0.5, z: 0 }]) },
                { key: "move", label: "Movement", val: components.move, text: components.move > 0.7 ? "steady ✓" : "hold the sign still" },
              ] as const).map((c) => (
                <div key={c.key} className="flex flex-col gap-1 rounded-lg border border-line bg-panel2 p-2.5">
                  <span className="text-xs uppercase tracking-wider text-muted">{c.label}</span>
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${c.val >= 0.7 ? "bg-ok" : c.val >= 0.4 ? "bg-warn" : "bg-bad"}`} />
                    {c.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-dashed border-line bg-accent/5 p-3 text-sm" role="status">
              <span dangerouslySetInnerHTML={{ __html: tip.replace(/"([^"]+)"/g, '<strong class="text-accent">"$1"</strong>') }} />
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
