"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";

const STEPS = ["Language", "Camera", "Lighting", "Framing"] as const;

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof window === "undefined") return { language: "asl", handedness: "right", mirror: true };
    const saved = loadPrefs();
    return saved.completedAt ? saved : { language: "asl", handedness: "right", mirror: true };
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permOk, setPermOk] = useState(false);
  const [permErr, setPermErr] = useState("");
  const [brightness, setBrightness] = useState({ mean: 0, pct: 0 });
  const [uniformity, setUniformity] = useState({ std: 0, pct: 0 });
  const video3Ref = useRef<HTMLVideoElement>(null);
  const video4Ref = useRef<HTMLVideoElement>(null);
  const lightingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const video = step === 3 ? video3Ref.current : step === 4 ? video4Ref.current : null;
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [step, stream]);

  const startLightingLoop = useCallback(() => {
    if (lightingTimerRef.current) {
      clearInterval(lightingTimerRef.current);
      lightingTimerRef.current = null;
    }
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    lightingTimerRef.current = setInterval(() => {
      const v = video3Ref.current;
      if (!v || !v.videoWidth || !ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const n = c.width * c.height;
      const lum = new Float32Array(n);
      let sum = 0;
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const Y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        lum[j] = Y;
        sum += Y;
      }
      const mean = sum / n;
      let varSum = 0;
      for (let j = 0; j < n; j++) {
        const d = lum[j] - mean;
        varSum += d * d;
      }
      const std = Math.sqrt(varSum / n);
      setBrightness({ mean, pct: Math.min(1, mean / 180) });
      setUniformity({ std, pct: Math.max(0, 1 - std / 90) });
    }, 250);
  }, []);

  useEffect(() => {
    if (step === 3) startLightingLoop();
    else if (lightingTimerRef.current) {
      clearInterval(lightingTimerRef.current);
      lightingTimerRef.current = null;
    }
    return () => {
      if (lightingTimerRef.current) {
        clearInterval(lightingTimerRef.current);
        lightingTimerRef.current = null;
      }
    };
  }, [step, startLightingLoop]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const requestCamera = async () => {
    setPermErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      setStream(s);
      setPermOk(true);
    } catch (e) {
      setPermErr(`Camera unavailable: ${(e as Error).message}. Open this page over https or localhost, and grant camera access.`);
    }
  };

  const finish = () => {
    const final: Prefs = { ...prefs, completedAt: new Date().toISOString() };
    savePrefs(final);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    router.push("/learn/asl/fingerspelling/A");
  };

  const brightMsg = (v: number) =>
    v < 70 ? "Too dark — add more front light" : v > 200 ? "Too bright — reduce direct light" : "Good";
  const uniMsg = (v: number) => (v > 80 ? "Uneven — try diffuse light" : v > 50 ? "OK" : "Even ✓");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          Getting Started
        </span>
        <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
          Setup Wizard
        </h1>
        <p className="mt-3 text-muted">
          Get your camera ready and configure your preferences in 4 quick steps.
        </p>
      </div>

      {/* Horizontal stepper */}
      <nav className="mb-8 flex items-center gap-0" aria-label="Setup steps">
        {STEPS.map((label, i) => {
          const num = i + 1;
          const isComplete = num < step;
          const isCurrent = num === step;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div
                className={`flex flex-1 items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                  isCurrent
                    ? "bg-accent/5"
                    : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isComplete
                      ? "bg-ok text-background"
                      : isCurrent
                      ? "bg-accent text-background"
                      : "border border-line bg-elevated text-muted"
                  }`}
                >
                  {isComplete ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
                      <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    num
                  )}
                </span>
                <span className={`text-sm font-medium ${isCurrent ? "text-foreground" : isComplete ? "text-foreground" : "text-muted"}`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 ${isComplete ? "bg-ok" : "bg-line"}`} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Step 1: Language */}
      {step === 1 && (
        <section className="rounded-2xl border border-line bg-surface p-6" aria-labelledby="step1-title">
          <h2 id="step1-title" className="text-xl font-display font-semibold text-foreground">
            Choose your sign language
          </h2>
          <p className="mt-2 mb-6 text-muted">
            You can change this later. Only ASL is fully shipped in this release.
          </p>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="step1-title">
            {[
              { value: "asl", label: "ASL", sub: "American Sign Language", badge: "Shipped", badgeColor: "ok" as const, disabled: false },
              { value: "bsl", label: "BSL", sub: "British Sign Language", badge: "Coming soon", badgeColor: "muted" as const, disabled: true },
              { value: "arsl", label: "ArSL", sub: "Arabic Sign Language", badge: "Coming soon", badgeColor: "muted" as const, disabled: true },
              { value: "other", label: "Other", sub: "More languages", badge: "Coming soon", badgeColor: "muted" as const, disabled: true },
            ].map((lang) => (
              <label
                key={lang.value}
                className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all duration-200 ${
                  lang.disabled
                    ? "cursor-not-allowed opacity-50 border-line bg-elevated/30"
                    : prefs.language === lang.value
                    ? "border-accent/50 bg-accent/5"
                    : "border-line bg-elevated/50 hover:border-accent/30"
                }`}
              >
                <input
                  type="radio"
                  name="lang"
                  value={lang.value}
                  checked={prefs.language === lang.value}
                  disabled={lang.disabled}
                  onChange={() => setPrefs({ ...prefs, language: lang.value })}
                  className="h-4 w-4 accent-accent"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{lang.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        lang.badgeColor === "ok"
                          ? "bg-ok/10 text-ok"
                          : "bg-muted/10 text-muted"
                      }`}
                    >
                      {lang.badge}
                    </span>
                  </div>
                  <span className="text-sm text-muted">{lang.sub}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs text-muted">Step 1 of 4</span>
            <button
              onClick={() => setStep(2)}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent/90"
            >
              Next: camera permission →
            </button>
          </div>
        </section>
      )}

      {/* Step 2: Camera */}
      {step === 2 && (
        <section className="rounded-2xl border border-line bg-surface p-6" aria-labelledby="step2-title">
          <h2 id="step2-title" className="text-xl font-display font-semibold text-foreground">
            Allow camera access
          </h2>
          <p className="mt-2 mb-6 text-muted">
            We use your webcam for real-time feedback. All processing stays on this device — nothing is uploaded.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-foreground">
                When you click below, your browser will show a camera permission prompt. Choose <strong>Allow</strong>.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  You can revoke camera access anytime in browser settings
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  If you deny by accident, refresh to try again
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  We do not record audio
                </li>
              </ul>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-elevated/30 p-8">
              <svg className="h-16 w-16 text-muted" fill="none" viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth={1.5} />
              </svg>
            </div>
          </div>
          {permErr && (
            <div className="mt-4 rounded-xl border border-bad/30 bg-bad/5 p-3 text-sm text-bad" role="alert">
              {permErr}
            </div>
          )}
          {permOk && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/5 p-3 text-sm text-ok" role="status">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
                <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Camera permission granted
            </div>
          )}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-line bg-elevated px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              ← Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={requestCamera}
                disabled={permOk}
                className="rounded-lg border border-line bg-elevated px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/30 disabled:opacity-40"
              >
                Request access
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!permOk}
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent/90 disabled:opacity-40"
              >
                Next: lighting →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Step 3: Lighting */}
      {step === 3 && (
        <section className="rounded-2xl border border-line bg-surface p-6" aria-labelledby="step3-title">
          <h2 id="step3-title" className="text-xl font-display font-semibold text-foreground">
            Lighting check
          </h2>
          <p className="mt-2 mb-6 text-muted">
            For best accuracy, light your hand from the front. Avoid back-light from windows.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-black">
                <video ref={video3Ref} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-3 rounded-lg border border-line bg-elevated/50 p-3">
                  <div className="flex-1">
                    <span className="block text-xs text-muted">Brightness</span>
                    <span className="text-sm text-foreground">{brightness.mean.toFixed(0)} · {brightMsg(brightness.mean)}</span>
                  </div>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${brightness.pct * 100}%` }} />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    brightness.pct >= 0.7 ? "bg-ok/10 text-ok" : brightness.pct >= 0.4 ? "bg-warm/10 text-warm" : "bg-bad/10 text-bad"
                  }`}>
                    {brightness.pct >= 0.7 ? "good" : brightness.pct >= 0.4 ? "ok" : "low"}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-line bg-elevated/50 p-3">
                  <div className="flex-1">
                    <span className="block text-xs text-muted">Uniformity</span>
                    <span className="text-sm text-foreground">{uniformity.std.toFixed(0)} · {uniMsg(uniformity.std)}</span>
                  </div>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${uniformity.pct * 100}%` }} />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    uniformity.pct >= 0.7 ? "bg-ok/10 text-ok" : uniformity.pct >= 0.4 ? "bg-warm/10 text-warm" : "bg-bad/10 text-bad"
                  }`}>
                    {uniformity.pct >= 0.7 ? "good" : uniformity.pct >= 0.4 ? "ok" : "low"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Tips</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  Face a window or lamp; don&apos;t sit with one behind you
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  Plain background helps but isn&apos;t required
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  Even diffuse light beats a single bright spot
                </li>
              </ul>
              <p className="mt-4 text-xs text-muted">
                You can proceed even if these aren&apos;t green — feedback may just be less accurate.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="rounded-lg border border-line bg-elevated px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent/90"
            >
              Next: framing →
            </button>
          </div>
        </section>
      )}

      {/* Step 4: Framing */}
      {step === 4 && (
        <section className="rounded-2xl border border-line bg-surface p-6" aria-labelledby="step4-title">
          <h2 id="step4-title" className="text-xl font-display font-semibold text-foreground">
            Framing & handedness
          </h2>
          <p className="mt-2 mb-6 text-muted">
            Sit so your head and hands fit inside the guide rectangle. Pick your dominant signing hand.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-black">
              <video ref={video4Ref} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${prefs.mirror ? "[transform:scaleX(-1)]" : ""}`} />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
                <circle cx="200" cy="80" r="42" fill="none" stroke="#4f8cff" strokeWidth="2" strokeDasharray="6 5" opacity="0.7" />
                <rect x="80" y="130" width="240" height="150" rx="14" fill="none" stroke="#00e5b0" strokeWidth="2" strokeDasharray="6 5" opacity="0.7" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Dominant hand</h3>
              <div className="mt-3 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Dominant hand">
                {(["right", "left"] as const).map((h) => (
                  <label
                    key={h}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-200 ${
                      prefs.handedness === h
                        ? "border-accent/50 bg-accent/5"
                        : "border-line bg-elevated/50 hover:border-accent/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="hand"
                      value={h}
                      checked={prefs.handedness === h}
                      onChange={() => setPrefs({ ...prefs, handedness: h })}
                      className="h-4 w-4 accent-accent"
                    />
                    <span className="font-medium capitalize text-foreground">{h}</span>
                  </label>
                ))}
              </div>
              <h3 className="mt-5 text-sm font-semibold text-foreground">Mirror webcam</h3>
              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-elevated/50 p-3 hover:border-accent/30">
                <input
                  type="checkbox"
                  checked={prefs.mirror}
                  onChange={(e) => setPrefs({ ...prefs, mirror: e.target.checked })}
                  className="h-4 w-4 accent-accent"
                />
                <span className="text-sm text-foreground">Mirror by default</span>
              </label>
              <p className="mt-4 text-xs text-muted">
                You can change all of these anytime in settings.
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="rounded-lg border border-line bg-elevated px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              ← Back
            </button>
            <button
              onClick={finish}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-all duration-200 hover:bg-accent/90 hover:shadow-[0_0_30px_rgba(0,229,176,0.3)]"
            >
              Finish setup & start lesson →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
