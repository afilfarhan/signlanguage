"use client";

import { useState } from "react";
import Link from "next/link";
import { loadProgress, getReviewQueue, type ProgressEntry } from "@/lib/storage";
import { CURRICULUM, STATIC_LETTERS, DYNAMIC_SIGNS, LETTER_DESCRIPTIONS, SIGN_DESCRIPTIONS } from "@/lib/curriculum";

export default function PracticePage() {
  const [progress] = useState<Record<string, ProgressEntry>>(() => {
    if (typeof window === "undefined") return {};
    return loadProgress();
  });
  const [reviewQueue] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const p = loadProgress();
    const allSigns = CURRICULUM.map((c) => c.id);
    return getReviewQueue(p, allSigns);
  });

  const totalAttempts = Object.values(progress).reduce((s, e) => s + e.attempts, 0);
  const totalCorrect = Object.values(progress).reduce((s, e) => s + e.correct, 0);
  const accuracy = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(0) : "—";
  const mastered = Object.values(progress).filter((e) => e.state === "review" && e.stability >= 5).length;
  const learning = Object.values(progress).filter((e) => e.state === "learning" || e.state === "relearning").length;
  const newCount = CURRICULUM.length - Object.keys(progress).length;

  const signMap = new Map(CURRICULUM.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Spaced Repetition Practice</h1>
      <p className="mt-2 mb-8 text-muted">FSRS-powered review queue that adapts to your progress</p>

      <div className="grid gap-4 sm:grid-cols-4 mb-8">
        {[
          { label: "Due now", value: reviewQueue.length, color: "text-accent" },
          { label: "Mastered", value: mastered, color: "text-ok" },
          { label: "Learning", value: learning, color: "text-warn" },
          { label: "New", value: newCount, color: "text-muted" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col rounded-xl border border-line bg-panel p-4">
            <span className="text-xs uppercase tracking-wider text-muted">{s.label}</span>
            <span className={`mt-1 text-3xl font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {totalAttempts > 0 && (
        <div className="mb-8 flex items-center gap-4 rounded-xl border border-line bg-panel p-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-muted">Total attempts</span>
            <span className="ml-2 text-lg font-bold text-foreground">{totalAttempts}</span>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <span className="text-xs uppercase tracking-wider text-muted">Accuracy</span>
            <span className="ml-2 text-lg font-bold text-foreground">{accuracy}%</span>
          </div>
        </div>
      )}

      {reviewQueue.length > 0 && (
        <section aria-labelledby="due-heading" className="mb-8">
          <h2 id="due-heading" className="mb-3 text-lg font-semibold">Due for review</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reviewQueue.slice(0, 12).map((id) => {
              const item = signMap.get(id);
              if (!item) return null;
              const entry = progress[id];
              const href = item.type === "static" ? `/learn/asl/fingerspelling/${item.label}` : `/learn/asl/words/${item.slug}`;
              const desc = item.type === "static" ? LETTER_DESCRIPTIONS[item.label] : SIGN_DESCRIPTIONS[item.label];
              const stateBadge = !entry ? "new" : entry.state;
              return (
                <Link
                  key={id}
                  href={href}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-panel p-3 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${
                    item.type === "static" ? "bg-accent/10 text-accent group-hover:bg-accent group-hover:text-background" : "bg-accent2/10 text-accent2 group-hover:bg-accent2 group-hover:text-background"
                  } transition-colors`}>
                    {item.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{item.label}</span>
                    <span className="block text-xs text-muted truncate">{desc}</span>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    stateBadge === "new" ? "border-muted/40 bg-muted/10 text-muted" :
                    stateBadge === "learning" || stateBadge === "relearning" ? "border-warn/40 bg-warn/10 text-warn" :
                    "border-ok/40 bg-ok/10 text-ok"
                  }`}>
                    {stateBadge}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="mb-3 text-lg font-semibold">All signs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Fingerspelling</h3>
            <div className="flex flex-wrap gap-1.5">
              {STATIC_LETTERS.map((letter) => {
                const id = `static-${letter}`;
                const entry = progress[id];
                const state = !entry ? "new" : entry.state;
                return (
                  <Link
                    key={letter}
                    href={`/learn/asl/fingerspelling/${letter}`}
                    className={`rounded-lg px-2.5 py-1.5 text-sm border transition-colors ${
                      state === "review" && (entry?.stability ?? 0) >= 5
                        ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                        : state === "review" || state === "learning" || state === "relearning"
                          ? "border-warn/40 bg-warn/10 text-warn hover:bg-warn/20"
                          : "border-line bg-panel2 text-muted hover:text-foreground"
                    }`}
                  >
                    {letter}
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Dynamic signs</h3>
            <div className="flex flex-wrap gap-1.5">
              {DYNAMIC_SIGNS.map((sign) => {
                const id = `dynamic-${sign}`;
                const entry = progress[id];
                const state = !entry ? "new" : entry.state;
                return (
                  <Link
                    key={sign}
                    href={`/learn/asl/words/${sign.toLowerCase()}`}
                    className={`rounded-lg px-2.5 py-1.5 text-sm border transition-colors ${
                      state === "review" && (entry?.stability ?? 0) >= 5
                        ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                        : state === "review" || state === "learning" || state === "relearning"
                          ? "border-warn/40 bg-warn/10 text-warn hover:bg-warn/20"
                          : "border-line bg-panel2 text-muted hover:text-foreground"
                    }`}
                  >
                    {sign}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">Green = mastered · Orange = learning · Grey = not started</p>
      </section>
    </div>
  );
}
