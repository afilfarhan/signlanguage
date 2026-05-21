"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { LETTER_DESCRIPTIONS, STATIC_LETTERS, ASL_REF_IMAGES, MOTION_LETTERS } from "@/lib/curriculum";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";
import { loadMediaPipe, loadONNX, type MediaPipeLibs, type ONNXLibs } from "@/lib/loadExternals";

type MediaPipeHands = { setOptions: (o: object) => void; onResults: (cb: (r: MediaPipeResults) => void) => void; send: (i: { image: HTMLVideoElement }) => Promise<void> };
type MediaPipeCamera = { start: () => void; stop: () => void };
type OrtSession = { run: (f: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>> };
interface MediaPipeResults { multiHandLandmarks?: Landmark[][]; }

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
  const router = useRouter();
  const letter = (params.letter as string || "A").toUpperCase();

  useEffect(() => {
    const saved = loadPrefs();
    if (!saved.completedAt) {
      router.replace("/setup");
    }
  }, [router]);

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
  const [loadingExternals, setLoadingExternals] = useState(false);
  const [externalsError, setExternalsError] = useState("");

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
  const mpLibsRef = useRef<MediaPipeLibs | null>(null);
  const onnxLibsRef = useRef<ONNXLibs | null>(null);
  const modelLabelsRef = useRef<string[]>([]);
  const featureDimRef = useRef(63);

  useEffect(() => { targetRef.current = letter; }, [letter]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { modelReadyRef.current = modelReady; }, [modelReady]);

  const runModel = useCallback(async (landmarks: Landmark[], session: OrtSession): Promise<RankedResult[] | null> => {
    try {
      const t0 = performance.now();
      const feats = normalize(landmarks);
      if (!onnxLibsRef.current) return null;
      const tensor = new onnxLibsRef.current.Tensor("float32", feats, [1, featureDimRef.current]);
      const out = await session.run({ input: tensor });
      clfLatencyRef.current = performance.now() - t0;
      const probs = out.probabilities.data;
      const labels = modelLabelsRef.current;
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
      ranked = await runModel(lm, sessionRef.current);
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
  }, [runModel]);

  const onResults = useCallback(
    (results: MediaPipeResults) => {
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

  const onModelLoaded = useCallback((labels: string[], session: OrtSession, featureDim?: number) => {
    sessionRef.current = session;
    modelLabelsRef.current = labels;
    if (featureDim) featureDimRef.current = featureDim;
    setModelLabels(labels);
    setModelReady(true);
    setModelBadge(`MLP · ${labels.length} classes`);
  }, []);

  const onModelError = useCallback(() => {
    setModelBadge("failed to load");
    setMode("rule");
  }, []);

  const startCamera = useCallback(async () => {
    if (running) return;

    // Reset stuck state from a previous hung attempt
    if (loadingExternals) {
      mpLibsRef.current = null;
      onnxLibsRef.current = null;
    }

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
          setMode("rule");
        }
      }

      // Load ML model if ONNX is available
      if (!sessionRef.current && onnxLibsRef.current && !modelReady) {
        try {
          const session = await onnxLibsRef.current.InferenceSession.create("/models/fingerspell_mlp_v2.onnx", { executionProviders: ["wasm"] });
          const resp = await fetch("/models/labels_v2.json");
          const meta = await resp.json();
          onModelLoaded(meta.labels, session, meta.feature_dim);
        } catch {
          onModelError();
        }
      }

      // Create Hands instance
      const hands = new mpLibs.Hands({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
      });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
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
        onFrame: async () => {
          const t0 = performance.now();
          await handsRef.current!.send({ image: video });
          mpLatencyRef.current = performance.now() - t0;
          setHudLatency(`mp ${mpLatencyRef.current.toFixed(0)}ms · clf ${clfLatencyRef.current.toFixed(0)}ms`);
        },
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
  }, [running, onResults, modelReady, onModelLoaded, onModelError]);

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
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
        <Link
          href="/learn/asl/fingerspelling"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-foreground"
          aria-label="Back to fingerspelling"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 20 20">
            <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-lg font-display font-bold text-accent">
            {letter}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground">Letter {letter}</h1>
              {(MOTION_LETTERS as readonly string[]).includes(letter) && (
                <span className="rounded-full bg-warm/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warm">
                  Motion
                </span>
              )}
            </div>
            <p className="text-xs text-muted">{LETTER_DESCRIPTIONS[letter]}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex overflow-hidden rounded-lg border border-line bg-elevated" role="radiogroup" aria-label="Classifier mode">
            <button
              role="radio"
              aria-checked={mode === "ml"}
              onClick={() => { if (modelReady) setMode("ml"); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === "ml" ? "bg-accent text-background" : "text-muted hover:text-foreground"}`}
            >
              ML
            </button>
            <button
              role="radio"
              aria-checked={mode === "rule"}
              onClick={() => setMode("rule")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${mode === "rule" ? "bg-accent text-background" : "text-muted hover:text-foreground"}`}
            >
              Rule
            </button>
          </span>

          <button
            onClick={startCamera}
            disabled={running || loadingExternals}
            className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {loadingExternals ? "Loading…" : "Start camera"}
          </button>
          <button
            onClick={stop}
            disabled={!running}
            className="rounded-lg border border-line bg-elevated px-4 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Stop
          </button>

          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={mirror} onChange={(e) => handleMirrorChange(e.target.checked)} className="rounded border-line bg-elevated accent-accent" />
            Mirror
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={prefs.handedness === "left"} onChange={handleHandednessChange} className="rounded border-line bg-elevated accent-accent" />
            Left hand
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
        {/* Reference panel */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Reference">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Reference</h2>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
              Target: {letter}
            </span>
          </div>

          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
            style={{
              background: "radial-gradient(ellipse at center, rgba(0, 229, 176, 0.06) 0%, var(--bg-surface) 70%)",
            }}
          >
            {ASL_REF_IMAGES[letter] ? (
              <img
                src={ASL_REF_IMAGES[letter]}
                alt={`ASL letter ${letter} handshape reference`}
                className="h-52 w-52 object-contain transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-dashed border-line text-6xl font-display font-bold text-dim">
                {letter}
              </div>
            )}
          </div>

          <div className="border-t border-line px-4 py-3">
            <p className="text-sm leading-relaxed text-muted">
              {LETTER_DESCRIPTIONS[letter]}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-line p-3">
            {STATIC_LETTERS.map((l) => (
              <Link
                key={l}
                href={`/learn/asl/fingerspelling/${l}`}
                aria-label={`Practice letter ${l}`}
                className={`rounded-md px-2.5 py-1.5 text-xs font-mono font-medium transition-all duration-150 ${
                  l === letter
                    ? "bg-accent text-background"
                    : "border border-line bg-elevated text-muted hover:border-accent/30 hover:text-foreground"
                }`}
              >
                {l}
              </Link>
            ))}
          </div>
        </section>

        {/* Webcam + feedback panel */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Your attempt">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Your Attempt</h2>
            <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
              On-device
            </span>
          </div>

          {/* Webcam */}
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

          {/* Feedback */}
          <div className="flex flex-col gap-3 p-4">
            {/* Verdict + Confidence */}
            <div className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
              verdict === "match"
                ? "border-ok/30 bg-ok/5"
                : verdict === "close"
                ? "border-warn/30 bg-warn/5"
                : verdict === "miss"
                ? "border-bad/30 bg-bad/5"
                : "border-line bg-elevated/50"
            }`}>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-muted">
                  {mode === "ml" ? "Detected (ML)" : "Detected (rule)"}
                </span>
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

            {/* Top-K bars */}
            {mode === "ml" && modelReady && topK.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {topK.map((r, i) => (
                  <div key={r.label} className="grid grid-cols-[40px_1fr_40px] items-center gap-2 text-xs">
                    <span className={`font-mono font-medium ${r.label === letter ? "text-accent" : "text-muted"}`}>
                      {r.label}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${
                          i === 0 ? "bg-accent" : "bg-accent/40"
                        }`}
                        style={{ width: `${r.prob * 100}%` }}
                      />
                    </div>
                    <span className="text-right font-mono text-muted">
                      {(r.prob * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Finger feedback */}
            <div className="grid grid-cols-5 gap-2 rounded-xl border border-line bg-elevated/50 p-2.5" aria-label="Per-finger handshape match">
              {(["thumb", "index", "middle", "ring", "pinky"] as FingerKey[]).map((f) => {
                const ref = PATTERNS[letter]?.[f];
                const you = fingers[f];
                const ok = ref !== undefined ? you === ref : null;
                return (
                  <div
                    key={f}
                    className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors ${
                      ok === true ? "bg-ok/10" : ok === false ? "bg-bad/10" : "bg-elevated"
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider text-muted">{f}</span>
                    <span className={`text-lg leading-none ${
                      ok === true ? "text-ok" : ok === false ? "text-bad" : "text-muted"
                    }`}>
                      {you ? "✓" : "✗"}
                    </span>
                    <span className={`text-[9px] leading-tight ${
                      ok === true ? "text-ok" : ok === false ? "text-bad" : "text-muted"
                    }`}>
                      {ok === true ? (ref ? "extend ✓" : "curl ✓") : ok === false ? (ref ? "should extend" : "should curl") : you ? "extended" : "curled"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 2x2 feedback grid */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "shape", label: "Handshape", val: components.shape, text: `${(components.shape * 100) | 0}% "${letter}"` },
                { key: "orient", label: "Orientation", val: components.orient, text: components.orient > 0.5 ? "palm forward" : "rotate toward camera" },
                { key: "loc", label: "Location", val: components.loc, text: locationLabel([{ x: 0.5, y: 0.5, z: 0 }]) },
                { key: "move", label: "Movement", val: components.move, text: components.move > 0.7 ? "steady" : "hold still" },
              ] as const).map((c) => (
                <div key={c.key} className="flex flex-col gap-1 rounded-lg border border-line bg-elevated/50 p-2.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted">{c.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${
                      c.val >= 0.7 ? "bg-ok" : c.val >= 0.4 ? "bg-warn" : "bg-bad"
                    }`} />
                    <span className="text-xs text-foreground">{c.text}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tip */}
            <div
              className="rounded-xl border border-dashed border-line bg-accent/5 p-3 text-sm text-muted"
              role="status"
              aria-live="polite"
            >
              <span
                dangerouslySetInnerHTML={{
                  __html: tip.replace(/"([^"]+)"/g, '<strong class="text-accent">"$1"</strong>'),
                }}
              />
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              modelReady
                ? "border-ok/30 bg-ok/5 text-ok"
                : "border-bad/30 bg-bad/5 text-bad"
            }`}>
              {modelBadge}
            </span>
            <span className="rounded-full border border-line bg-elevated px-2 py-0.5 text-[10px] font-mono">
              FPS: {fps}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
