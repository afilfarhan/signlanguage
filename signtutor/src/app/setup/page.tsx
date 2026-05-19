"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";

const STEPS = ["Language", "Camera permission", "Lighting check", "Framing & handedness"] as const;

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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex gap-0 overflow-hidden rounded-xl border border-line bg-panel" role="navigation" aria-label="Setup steps">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex flex-1 items-center gap-2.5 border-r border-line px-4 py-3 text-sm last:border-r-0 ${
              i + 1 === step
                ? "bg-accent/10 text-foreground"
                : i + 1 < step
                  ? "text-foreground"
                  : "text-muted"
            }`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i + 1 < step
                  ? "bg-ok text-background"
                  : i + 1 === step
                    ? "bg-accent text-background"
                    : "border border-line bg-panel2 text-muted"
              }`}
            >
              {i + 1 < step ? "✓" : i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <section className="rounded-2xl border border-line bg-panel p-6" aria-labelledby="step1-title">
          <h2 id="step1-title" className="text-2xl font-bold">Choose your sign language</h2>
          <p className="mt-2 mb-6 text-muted">You can change this later. Only ASL is fully shipped in this release.</p>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="step1-title">
            {[
              { value: "asl", label: "ASL — American Sign Language", sub: "Fully shipped · 24 letters + 8 signs", disabled: false },
              { value: "bsl", label: "BSL — British Sign Language", sub: "Preview · coming soon", disabled: true },
              { value: "arsl", label: "ArSL — Arabic Sign Language", sub: "Preview · coming soon", disabled: true },
              { value: "other", label: "Other", sub: "Coming soon — see roadmap", disabled: true },
            ].map((lang) => (
              <label
                key={lang.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                  lang.disabled ? "cursor-not-allowed opacity-50" : prefs.language === lang.value ? "border-accent bg-accent/10" : "border-line bg-panel2 hover:border-accent/50"
                }`}
              >
                <input
                  type="radio"
                  name="lang"
                  value={lang.value}
                  checked={prefs.language === lang.value}
                  disabled={lang.disabled}
                  onChange={() => setPrefs({ ...prefs, language: lang.value })}
                  className="h-5 w-5 accent-accent"
                />
                <span className="flex flex-col">
                  <span className="font-semibold">{lang.label}</span>
                  <span className="text-sm text-muted">{lang.sub}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-muted">Step 1 of 4</span>
            <button onClick={() => setStep(2)} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-colors hover:bg-accent/80">
              Next: camera permission →
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="rounded-2xl border border-line bg-panel p-6" aria-labelledby="step2-title">
          <h2 id="step2-title" className="text-2xl font-bold">Allow camera access</h2>
          <p className="mt-2 mb-4 text-muted">
            We use your webcam to give you real-time feedback. Frames and hand-landmark data <strong className="text-foreground">stay on this device</strong> — they are never uploaded.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mt-0">When you click below, your browser will show a camera permission prompt. Choose <strong className="text-foreground">Allow</strong>.</p>
              <ul className="mt-3 list-disc pl-5 text-sm text-muted">
                <li>You can revoke camera access anytime in your browser settings.</li>
                <li>If you deny by accident, refresh the page to try again.</li>
                <li>We do not record audio.</li>
              </ul>
            </div>
            <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-panel2 p-8 text-5xl text-muted">📷</div>
          </div>
          {permErr && <div className="mt-4 rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad" role="alert">{permErr}</div>}
          {permOk && <div className="mt-4 rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm text-ok">Camera permission granted ✓</div>}
          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(1)} className="rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-muted hover:text-foreground">← Back</button>
            <div className="flex gap-3">
              <button onClick={requestCamera} disabled={permOk} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-colors hover:bg-accent/80 disabled:opacity-40">
                Request camera access
              </button>
              <button onClick={() => setStep(3)} disabled={!permOk} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-colors hover:bg-accent/80 disabled:opacity-40">
                Next: lighting check →
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-2xl border border-line bg-panel p-6" aria-labelledby="step3-title">
          <h2 id="step3-title" className="text-2xl font-bold">Lighting check</h2>
          <p className="mt-2 mb-4 text-muted">For best accuracy, light your hand from the front. Avoid back-light from windows.</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-black">
                <video ref={video3Ref} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex-1">
                    <span className="block text-xs text-muted">Average brightness</span>
                    <span className="text-sm">{brightness.mean.toFixed(0)} · {brightMsg(brightness.mean)}</span>
                  </div>
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-accent2 transition-all" style={{ width: `${brightness.pct * 100}%` }} />
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${brightness.pct >= 0.7 ? "border-ok/40 bg-ok/10 text-ok" : brightness.pct >= 0.4 ? "border-warn/40 bg-warn/10 text-warn" : "border-bad/40 bg-bad/10 text-bad"}`}>
                    {brightness.pct >= 0.7 ? "good" : brightness.pct >= 0.4 ? "ok" : "low"}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-line bg-panel2 p-3">
                  <div className="flex-1">
                    <span className="block text-xs text-muted">Brightness uniformity</span>
                    <span className="text-sm">{uniformity.std.toFixed(0)} · {uniMsg(uniformity.std)}</span>
                  </div>
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-line">
                    <div className="h-full bg-accent2 transition-all" style={{ width: `${uniformity.pct * 100}%` }} />
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${uniformity.pct >= 0.7 ? "border-ok/40 bg-ok/10 text-ok" : uniformity.pct >= 0.4 ? "border-warn/40 bg-warn/10 text-warn" : "border-bad/40 bg-bad/10 text-bad"}`}>
                    {uniformity.pct >= 0.7 ? "good" : uniformity.pct >= 0.4 ? "ok" : "low"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="mt-0 text-base font-semibold">Tips</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                <li>Face a window or lamp; don&apos;t sit with one behind you.</li>
                <li>Plain background helps but isn&apos;t required.</li>
                <li>Even diffuse light beats a single bright spot.</li>
              </ul>
              <p className="mt-4 text-sm text-muted">You can proceed even if these aren&apos;t green — feedback may just be less accurate.</p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(2)} className="rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-muted hover:text-foreground">← Back</button>
            <button onClick={() => setStep(4)} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-colors hover:bg-accent/80">Next: framing →</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="rounded-2xl border border-line bg-panel p-6" aria-labelledby="step4-title">
          <h2 id="step4-title" className="text-2xl font-bold">Framing &amp; handedness</h2>
          <p className="mt-2 mb-4 text-muted">Sit so your head and hands fit inside the guide rectangle. Pick your dominant signing hand.</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className={`relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-black ${prefs.mirror ? "[transform:scaleX(-1)]" : ""}`}>
              <video ref={video4Ref} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
                <circle cx="200" cy="80" r="42" fill="none" stroke="#7c9cff" strokeWidth="2" strokeDasharray="6 5" opacity="0.8" />
                <rect x="80" y="130" width="240" height="150" rx="14" fill="none" stroke="#5ee0c1" strokeWidth="2" strokeDasharray="6 5" opacity="0.8" />
                <text x="200" y="78" fill="#7c9cff" fontSize="11" textAnchor="middle" fontFamily="sans-serif" opacity="0.9">head</text>
                <text x="200" y="208" fill="#5ee0c1" fontSize="11" textAnchor="middle" fontFamily="sans-serif" opacity="0.9">signing space</text>
              </svg>
            </div>
            <div>
              <h3 className="mt-0 text-base font-semibold">Dominant hand</h3>
              <div className="mt-2 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Dominant hand">
                {(["right", "left"] as const).map((h) => (
                  <label
                    key={h}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                      prefs.handedness === h ? "border-accent bg-accent/10" : "border-line bg-panel2 hover:border-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="hand"
                      value={h}
                      checked={prefs.handedness === h}
                      onChange={() => setPrefs({ ...prefs, handedness: h })}
                      className="h-5 w-5 accent-accent"
                    />
                    <span className="flex flex-col">
                      <span className="font-semibold capitalize">{h}</span>
                      <span className="text-sm text-muted">{h === "right" ? "Most common" : "Demos will flip"}</span>
                    </span>
                  </label>
                ))}
              </div>
              <h3 className="mt-5 text-base font-semibold">Mirror webcam preview</h3>
              <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-accent bg-accent/10 p-3">
                <input
                  type="checkbox"
                  checked={prefs.mirror}
                  onChange={(e) => setPrefs({ ...prefs, mirror: e.target.checked })}
                  className="h-5 w-5 accent-accent"
                />
                <span className="flex flex-col">
                  <span className="font-semibold">Mirror by default</span>
                  <span className="text-sm text-muted">Recommended — matches the demo signer&apos;s view</span>
                </span>
              </label>
              <p className="mt-4 text-sm text-muted">You can change all of these anytime in settings.</p>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(3)} className="rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-muted hover:text-foreground">← Back</button>
            <button onClick={finish} className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background transition-colors hover:bg-accent/80">
              Finish setup &amp; start lesson →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
