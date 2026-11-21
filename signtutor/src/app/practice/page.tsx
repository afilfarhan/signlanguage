"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { loadProgress, getReviewQueue, loadStats, loadBadges, loadStreak, getProgressStats, getBadgesWithProgress, SRSItemExtended } from "@/lib/storage";
import { UserStats, EarnedBadge, Badge } from "@/lib/badges";
import { CURRICULUM, STATIC_LETTERS, DYNAMIC_SIGNS, LETTER_DESCRIPTIONS, SIGN_DESCRIPTIONS } from "@/lib/curriculum";
import { VOCABULARY_200 } from "@/lib/vocabulary_200";

export default function PracticePage() {
  const [progress, setProgress] = useState<Record<string, SRSItemExtended>>(() => {
    if (typeof window === "undefined") return {};
    return loadProgress();
  });
  const [stats, setStats] = useState<UserStats>(() => {
    if (typeof window === "undefined") return loadStats();
    return loadStats();
  });
  const [badges, setBadges] = useState<EarnedBadge[]>(() => {
    if (typeof window === "undefined") return [];
    return loadBadges();
  });
  const [streak] = useState(() => {
    if (typeof window === "undefined") return loadStreak();
    return loadStreak();
  });

  // Refresh data when window gains focus (in case of multi-tab)
  useEffect(() => {
    const handleFocus = () => {
      setProgress(loadProgress());
      setStats(loadStats());
      setBadges(loadBadges());
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const reviewQueue = useMemo(() => {
    if (typeof window === "undefined") return [];
    return getReviewQueue(progress, CURRICULUM.map(c => ({ id: c.id, type: c.type, label: c.label, slug: c.slug })));
  }, [progress]);

  const progressStats = useMemo(() => getProgressStats(progress), [progress]);

  const totalAttempts = Object.values(progress).reduce((s, e) => s + e.attempts, 0);
  const totalCorrect = Object.values(progress).reduce((s, e) => s + e.correct, 0);
  const accuracy = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(0) : "—";

  const signMap = new Map(CURRICULUM.map((c) => [c.id, c]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-warm/20 bg-warm/5 px-3 py-1 text-xs font-semibold tracking-wide text-warm">
              Review
            </span>
            <h1 className="mt-2 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
              Spaced Repetition Practice
            </h1>
            <p className="mt-2 text-muted">
              FSRS-powered review queue that adapts to your memory curve
            </p>
          </div>
          {/* Streak badge in header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2">
              <span className="text-2xl">🔥</span>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-muted">Current Streak</span>
                <span className="text-xl font-display font-bold text-accent">{streak.currentStreak} days</span>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2">
              <div className="text-right">
                <span className="block text-[10px] uppercase tracking-wider text-muted">Best Streak</span>
                <span className="text-xl font-display font-bold text-foreground">{streak.longestStreak} days</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {[
          { label: "Due now", value: reviewQueue.length, color: "text-accent", bg: "bg-accent/10", icon: "🔔" },
          { label: "Mastered", value: progressStats.byType.static.mastered + progressStats.byType.dynamic.mastered + progressStats.byType.vocabulary.mastered, color: "text-ok", bg: "bg-ok/10", icon: "✅" },
          { label: "Learning", value: progressStats.byType.static.learning + progressStats.byType.dynamic.learning + progressStats.byType.vocabulary.learning, color: "text-warm", bg: "bg-warm/10", icon: "🌱" },
          { label: "Total Attempts", value: totalAttempts, color: "text-accent2", bg: "bg-accent2/10", icon: "📊" },
          { label: "Accuracy", value: `${accuracy}%`, color: accuracy !== "—" && parseInt(accuracy) >= 90 ? "text-ok" : "text-foreground", bg: "bg-surface", icon: "🎯" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <span className="text-2xl">{s.icon}</span>
            <div className="flex-1">
              <span className="text-xs uppercase tracking-wider text-muted">{s.label}</span>
              <span className={`mt-0.5 text-2xl font-display font-bold ${s.color}`}>{s.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mb-8 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-muted">Overall Progress</span>
          <span className="text-xs font-mono text-muted">
            {progressStats.byType.static.mastered + progressStats.byType.dynamic.mastered + progressStats.byType.vocabulary.mastered} / {CURRICULUM.length + VOCABULARY_200.length} mastered
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-elevated flex">
          <div
            className="h-full bg-ok transition-all duration-500"
            style={{ width: `${CURRICULUM.length + VOCABULARY_200.length > 0 ? ((progressStats.byType.static.mastered + progressStats.byType.dynamic.mastered + progressStats.byType.vocabulary.mastered) / (CURRICULUM.length + VOCABULARY_200.length)) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-warm transition-all duration-500"
            style={{ width: `${CURRICULUM.length + VOCABULARY_200.length > 0 ? ((progressStats.byType.static.learning + progressStats.byType.dynamic.learning + progressStats.byType.vocabulary.learning) / (CURRICULUM.length + VOCABULARY_200.length)) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-muted/30 transition-all duration-500"
            style={{ width: `${CURRICULUM.length + VOCABULARY_200.length > 0 ? (1 - ((progressStats.byType.static.mastered + progressStats.byType.dynamic.mastered + progressStats.byType.vocabulary.mastered + progressStats.byType.static.learning + progressStats.byType.dynamic.learning + progressStats.byType.vocabulary.learning) / (CURRICULUM.length + VOCABULARY_200.length))) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-muted">
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

      {/* Badges Section */}
      <section className="mb-10" aria-labelledby="badges-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="badges-heading" className="text-lg font-display font-semibold text-foreground">
            Achievements
          </h2>
          <Link
            href="/practice/badges"
            className="text-sm font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {getBadgesWithProgress(stats)
            .filter(b => b.earned || (b.progress && b.progress.progress > 0))
            .slice(0, 8)
            .map((badge) => (
              <div
                key={badge.id}
                className={`relative rounded-xl border p-4 transition-all duration-200 ${
                  badge.earned
                    ? "border-accent/30 bg-accent/5"
                    : "border-line bg-surface"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl ${
                    badge.earned ? "bg-accent/10" : "bg-muted/10 opacity-50"
                  }`}>
                    {badge.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold truncate ${badge.earned ? "text-foreground" : "text-muted"}`}>
                      {badge.name}
                    </h3>
                    <p className={`text-xs mt-0.5 truncate ${badge.earned ? "text-muted" : "text-dim"}`}>
                      {badge.description}
                    </p>
                    {!badge.earned && badge.progress && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted">Progress</span>
                          <span className="font-mono text-accent">
                            {Math.round(badge.progress.progress * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                          <div
                            className="h-full bg-warm transition-all duration-300"
                            style={{ width: `${badge.progress.progress * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    badge.tier === "bronze" ? "bg-amber-100 text-amber-800" :
                    badge.tier === "silver" ? "bg-gray-100 text-gray-800" :
                    badge.tier === "gold" ? "bg-yellow-100 text-yellow-800" :
                    "bg-slate-100 text-slate-800"
                  }`}>
                    {badge.tier}
                  </span>
                </div>
                {badge.earned && (
                  <span className="absolute top-2 right-2 text-[10px] text-accent">✓ Earned</span>
                )}
              </div>
            ))}
        </div>
        {badges.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
            <span className="text-4xl mb-2 block">🏆</span>
            <p className="text-muted">No badges yet. Complete lessons to earn your first achievement!</p>
          </div>
        )}
      </section>

      {/* Due for review */}
      {reviewQueue.length > 0 && (
        <section aria-labelledby="due-heading" className="mb-10">
          <h2 id="due-heading" className="mb-4 text-lg font-display font-semibold text-foreground">
            Due for Review ({reviewQueue.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {reviewQueue.slice(0, 16).map((item) => {
              const curriculumItem = signMap.get(item.id);
              if (!curriculumItem) return null;
              const href = curriculumItem.type === "static" 
                ? `/learn/asl/fingerspelling/${curriculumItem.label}` 
                : `/learn/asl/words/${curriculumItem.slug}`;
              const desc = curriculumItem.type === "static" 
                ? LETTER_DESCRIPTIONS[curriculumItem.label] 
                : curriculumItem.description || SIGN_DESCRIPTIONS[curriculumItem.label as keyof typeof SIGN_DESCRIPTIONS] || "";
              const stateBadge = item.state;
              const isOverdue = item.due < new Date();
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={`group flex flex-col gap-2 rounded-xl border p-3 transition-all duration-200 ${
                    isOverdue
                      ? "border-bad/30 bg-bad/5 hover:border-bad/50"
                      : "border-line bg-surface hover:border-accent/30 hover:-translate-y-0.5"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-display font-bold transition-colors ${
                        curriculumItem.type === "static"
                          ? "bg-accent/10 text-accent group-hover:bg-accent group-hover:text-background"
                          : "bg-accent2/10 text-accent2 group-hover:bg-accent2 group-hover:text-background"
                      }`}
                    >
                      {curriculumItem.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">
                        {curriculumItem.label}
                      </span>
                      <span className="block text-xs text-muted truncate">{desc}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
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
                    {isOverdue && (
                      <span className="rounded-full border-bad/40 bg-bad/10 px-2 py-0.5 text-[10px] font-medium text-bad">
                        Overdue
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-muted">
                      {item.scheduledDays}d
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          {reviewQueue.length > 16 && (
            <p className="mt-3 text-center text-sm text-muted">
              +{reviewQueue.length - 16} more due for review
            </p>
          )}
        </section>
      )}

      {/* All signs grid */}
      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className="mb-4 text-lg font-display font-semibold text-foreground">
          All Signs Progress
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Fingerspelling */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Fingerspelling (24)
              </h3>
              <span className="text-xs font-mono text-muted">
                {progressStats.byType.static.mastered} mastered
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATIC_LETTERS.map((letter) => {
                const id = `static-${letter}`;
                const entry = progress[id];
                const state = !entry ? "new" : entry.state;
                const isMastered = state === "review" && (entry?.stability ?? 0) >= 30;
                return (
                  <Link
                    key={letter}
                    href={`/learn/asl/fingerspelling/${letter}`}
                    className={`relative rounded-lg px-2.5 py-1.5 text-sm font-mono font-medium border transition-all duration-150 ${
                      isMastered
                        ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                        : state === "review" || state === "learning" || state === "relearning"
                        ? "border-warm/40 bg-warm/10 text-warm hover:bg-warm/20"
                        : "border-line bg-elevated text-muted hover:text-foreground hover:border-accent/30"
                    }`}
                  >
                    {letter}
                    {isMastered && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-ok text-background text-[9px] flex items-center justify-center">✓</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Dynamic signs */}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Dynamic Signs (8)
              </h3>
              <span className="text-xs font-mono text-muted">
                {progressStats.byType.dynamic.mastered} mastered
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DYNAMIC_SIGNS.map((sign) => {
                const id = `dynamic-${sign}`;
                const entry = progress[id];
                const state = !entry ? "new" : entry.state;
                const isMastered = state === "review" && (entry?.stability ?? 0) >= 30;
                return (
                  <Link
                    key={sign}
                    href={`/learn/asl/words/${sign.toLowerCase()}`}
                    className={`relative rounded-lg px-2.5 py-1.5 text-sm font-medium border transition-all duration-150 ${
                      isMastered
                        ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                        : state === "review" || state === "learning" || state === "relearning"
                        ? "border-warm/40 bg-warm/10 text-warm hover:bg-warm/20"
                        : "border-line bg-elevated text-muted hover:text-foreground hover:border-accent/30"
                    }`}
                  >
                    {sign}
                    {isMastered && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-ok text-background text-[9px] flex items-center justify-center">✓</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Vocabulary categories */}
          {Object.entries(
            VOCABULARY_200.reduce((acc, sign) => {
              if (!acc[sign.category]) acc[sign.category] = [];
              acc[sign.category].push(sign);
              return acc;
            }, {} as Record<string, typeof VOCABULARY_200>)
          ).map(([category, categorySigns]) => {
            const categoryIds = categorySigns.map(s => `vocab-${s.id}`);
            const categoryProgress = categoryIds.map(id => progress[id]).filter(Boolean);
            const mastered = categoryProgress.filter(p => p.state === "review" && (p.stability ?? 0) >= 30).length;
            const total = categorySigns.length;
            
            return (
              <div key={category} className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {category} ({total})
                  </h3>
                  <span className="text-xs font-mono text-muted">
                    {mastered} mastered
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categorySigns.slice(0, 12).map((sign) => {
                    const id = `vocab-${sign.id}`;
                    const entry = progress[id];
                    const state = !entry ? "new" : entry.state;
                    const isMastered = state === "review" && (entry?.stability ?? 0) >= 30;
                    return (
                      <Link
                        key={sign.id}
                        href={`/learn/asl/words/${sign.id}`}
                        className={`relative rounded-lg px-2.5 py-1.5 text-sm font-medium border transition-all duration-150 ${
                          isMastered
                            ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                            : state === "review" || state === "learning" || state === "relearning"
                            ? "border-warm/40 bg-warm/10 text-warm hover:bg-warm/20"
                            : "border-line bg-elevated text-muted hover:text-foreground hover:border-accent/30"
                        }`}
                      >
                        {sign.gloss}
                        {isMastered && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-ok text-background text-[9px] flex items-center justify-center">✓</span>
                        )}
                      </Link>
                    );
                  })}
                  {categorySigns.length > 12 && (
                    <span className="rounded-lg px-2.5 py-1.5 text-sm font-medium border border-line bg-elevated text-muted">
                      +{categorySigns.length - 12} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-ok" /> Mastered (stability ≥ 30)
          </span>
          <span className="mx-2 inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-warm" /> Learning
          </span>
          <span className="mx-2 inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted/30" /> Not started
          </span>
        </p>
      </section>
    </div>
  );
}