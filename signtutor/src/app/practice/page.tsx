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
  const total = CURRICULUM.length;

  const signMap = new Map(CURRICULUM.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-warm/20 bg-warm/5 px-3 py-1 text-xs font-semibold tracking-wide text-warm">
          Review
        </span>
        <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
          Spaced Repetition
        </h1>
        <p className="mt-3 text-muted">
          FSRS-powered review queue that adapts to your progress
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-4 mb-6">
        {[
          { label: "Due now", value: reviewQueue.length, color: "text-accent", bg: "bg-accent/10" },
          { label: "Mastered", value: mastered, color: "text-ok", bg: "bg-ok/10" },
          { label: "Learning", value: learning, color: "text-warm", bg: "bg-warm/10" },
          { label: "New", value: newCount, color: "text-muted", bg: "bg-elevated" },
        ].map((s) => (
          <div key={s.label} className={`flex flex-col rounded-xl border border-line bg-surface p-4`}>
            <span className="text-xs uppercase tracking-wider text-muted">{s.label}</span>
            <span className={`mt-1 text-3xl font-display font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-8 rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-muted">Overall Progress</span>
            <span className="text-xs font-mono text-muted">
              {mastered}/{total} mastered
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-elevated flex">
            {total > 0 && (
              <>
                <div
                  className="h-full bg-ok transition-all duration-500"
                  style={{ width: `${(mastered / total) * 100}%` }}
                />
                <div
                  className="h-full bg-warm transition-all duration-500"
                  style={{ width: `${(learning / total) * 100}%` }}
                />
                <div
                  className="h-full bg-muted/30 transition-all duration-500"
                  style={{ width: `${(newCount / total) * 100}%` }}
                />
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ok" /> Mastered
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-warm" /> Learning
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted/30" /> New
            </span>
          </div>
        </div>
      )}

      {/* Attempts & Accuracy */}
      {totalAttempts > 0 && (
        <div className="mb-8 flex items-center gap-6 rounded-xl border border-line bg-surface p-4">
          <div>
            <span className="block text-xs uppercase tracking-wider text-muted">Total attempts</span>
            <span className="text-2xl font-display font-bold text-foreground">{totalAttempts}</span>
          </div>
          <div className="h-10 w-px bg-line" />
          <div>
            <span className="block text-xs uppercase tracking-wider text-muted">Accuracy</span>
            <span className="text-2xl font-display font-bold text-foreground">{accuracy}%</span>
          </div>
        </div>
      )}

      {/* Due for review */}
      {reviewQueue.length > 0 && (
        <section aria-labelledby="due-heading" className="mb-10">
          <h2 id="due-heading" className="mb-4 text-lg font-display font-semibold text-foreground">
            Due for review
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all duration-200 hover:border-accent/30 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-display font-bold transition-colors ${
                      item.type === "static"
                        ? "bg-accent/10 text-accent group-hover:bg-accent group-hover:text-background"
                        : "bg-accent2/10 text-accent2 group-hover:bg-accent2 group-hover:text-background"
                    }`}
                  >
                    {item.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">
                      {item.label}
                    </span>
                    <span className="block text-xs text-muted truncate">{desc}</span>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      stateBadge === "new"
                        ? "border-muted/40 bg-muted/10 text-muted"
                        : stateBadge === "learning" || stateBadge === "relearning"
                        ? "border-warm/40 bg-warm/10 text-warm"
                        : "border-ok/40 bg-ok/10 text-ok"
                    }`}
                  >
                    {stateBadge}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* All signs */}
      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="mb-4 text-lg font-display font-semibold text-foreground">
          All signs
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Fingerspelling */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Fingerspelling
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STATIC_LETTERS.map((letter) => {
                const id = `static-${letter}`;
                const entry = progress[id];
                const state = !entry ? "new" : entry.state;
                return (
                  <Link
                    key={letter}
                    href={`/learn/asl/fingerspelling/${letter}`}
                    className={`rounded-lg px-2.5 py-1.5 text-sm font-mono font-medium border transition-all duration-150 ${
                      state === "review" && (entry?.stability ?? 0) >= 5
                        ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                        : state === "review" || state === "learning" || state === "relearning"
                        ? "border-warm/40 bg-warm/10 text-warm hover:bg-warm/20"
                        : "border-line bg-elevated text-muted hover:text-foreground hover:border-accent/30"
                    }`}
                  >
                    {letter}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Dynamic signs */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              Dynamic signs
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {DYNAMIC_SIGNS.map((sign) => {
                const id = `dynamic-${sign}`;
                const entry = progress[id];
                const state = !entry ? "new" : entry.state;
                return (
                  <Link
                    key={sign}
                    href={`/learn/asl/words/${sign.toLowerCase()}`}
                    className={`rounded-lg px-2.5 py-1.5 text-sm font-medium border transition-all duration-150 ${
                      state === "review" && (entry?.stability ?? 0) >= 5
                        ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                        : state === "review" || state === "learning" || state === "relearning"
                        ? "border-warm/40 bg-warm/10 text-warm hover:bg-warm/20"
                        : "border-line bg-elevated text-muted hover:text-foreground hover:border-accent/30"
                    }`}
                  >
                    {sign}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-ok mr-1" /> Mastered
          <span className="inline-block h-2 w-2 rounded-full bg-warm mx-1 mr-1" /> Learning
          <span className="inline-block h-2 w-2 rounded-full bg-muted/30 mx-1 mr-1" /> Not started
        </p>
      </section>
    </div>
  );
}
