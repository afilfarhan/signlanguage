"use client";

import { useState, useCallback } from "react";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";
import Link from "next/link";

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <span className={`text-sm font-medium ${disabled ? "text-muted" : "text-foreground"}`}>
          {label}
        </span>
        {description && (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? "bg-accent" : "bg-elevated"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow transition-transform duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefsState] = useState<Prefs>(() => {
    if (typeof window === "undefined") return { language: "asl", handedness: "right", mirror: true };
    return loadPrefs();
  });
  const [message, setMessage] = useState<string | null>(null);

  const updatePrefs = useCallback((next: Prefs) => {
    savePrefs(next);
    setPrefsState(next);
    setMessage("Settings saved.");
    setTimeout(() => setMessage(null), 2000);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          Preferences
        </span>
        <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
          Settings
        </h1>
        <p className="mt-3 text-muted">
          Configure your learning preferences and model options.
        </p>
      </div>

      {/* Display & Hand Preference */}
      <section className="rounded-2xl border border-line bg-surface px-6">
        <h2 className="border-b border-line py-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Display & Hand Preference
        </h2>
        <div className="divide-y divide-line">
          <Toggle
            label="Mirror webcam"
            description="Flip the video feed horizontally for a mirror-like experience"
            checked={prefs.mirror}
            onChange={(v) => updatePrefs({ ...prefs, mirror: v })}
          />
          <Toggle
            label="Left-handed mode"
            description="Optimize detection for your left hand"
            checked={prefs.handedness === "left"}
            onChange={(v) => updatePrefs({ ...prefs, handedness: v ? "left" : "right" })}
          />
        </div>
      </section>

      {/* Advanced (Beta) */}
      <section className="mt-6 rounded-2xl border border-line bg-surface px-6">
        <div className="border-b border-line py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Advanced
          </h2>
          <span className="rounded-full bg-warm/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warm">
            Beta
          </span>
        </div>
        <div className="divide-y divide-line">
          <Toggle
            label="Enable personalization"
            description="Adapt model weights to your hand shape over time"
            checked={false}
            onChange={() => {}}
            disabled
          />
          <Toggle
            label="NMM scoring"
            description="Score facial expressions and body shift"
            checked={false}
            onChange={() => {}}
            disabled
          />
        </div>
        <p className="py-4 text-xs text-muted">
          These features are in development and will be available in future releases.
        </p>
      </section>

      {/* Future placeholders */}
      <section className="mt-6 rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-8 text-center">
        <h3 className="text-sm font-medium text-muted">Coming Soon</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { title: "Custom sensitivity", desc: "Fine-tune detection thresholds" },
            { title: "Export progress", desc: "Download your learning history" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-line bg-elevated/50 p-4 text-left"
            >
              <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
              <p className="mt-1 text-xs text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Save message */}
      {message && (
        <div className="mt-6 rounded-xl border border-ok/30 bg-ok/5 px-4 py-3 text-sm text-ok" role="status">
          {message}
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Learn
        </Link>
      </div>
    </div>
  );
}
