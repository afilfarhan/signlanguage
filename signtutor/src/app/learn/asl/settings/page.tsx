"use client";

import { useState, useCallback } from "react";
import { loadPrefs, savePrefs, type Prefs } from "@/lib/storage";
import Link from "next/link";

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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 mb-8 text-muted">Configure your learning preferences and model options.</p>

      <div className="space-y-8">
        <section className="rounded-2xl border border-line bg-panel p-6">
          <h2 className="text-lg font-bold mb-4">Display &amp; Hand Preference</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Mirror webcam</span>
              <input
                type="checkbox"
                checked={prefs.mirror}
                onChange={(e) => updatePrefs({ ...prefs, mirror: e.target.checked })}
                className="accent-accent h-5 w-5"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Left-handed</span>
              <input
                type="checkbox"
                checked={prefs.handedness === "left"}
                onChange={(e) => updatePrefs({ ...prefs, handedness: e.target.checked ? "left" : "right" })}
                className="accent-accent h-5 w-5"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-6">
          <h2 className="text-lg font-bold mb-4">Advanced (Beta)</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Enable personalization</span>
              <input
                type="checkbox"
                checked={false}
                disabled
                className="accent-accent h-5 w-5 opacity-50"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">NMM scoring (facial expression)</span>
              <input
                type="checkbox"
                checked={false}
                disabled
                className="accent-accent h-5 w-5 opacity-50"
              />
            </label>
            <p className="text-xs text-muted">These features are currently in development and will be available in future releases.</p>
          </div>
        </section>

        {message && (
          <div className="rounded-lg border border-ok/40 bg-ok/10 px-4 py-2 text-sm text-ok">
            {message}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link href="/learn/asl" className="text-sm text-accent hover:underline">← Back to Learn</Link>
      </div>
    </div>
  );
}
