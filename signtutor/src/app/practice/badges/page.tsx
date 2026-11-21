"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { loadStats, loadBadges, getBadgesWithProgress } from "@/lib/storage";
import { Badge, EarnedBadge, UserStats } from "@/lib/badges";

function BadgeCard({ badge }: { badge: Badge & { earned: boolean; progress?: { progress: number; currentValue: number; targetValue: number }; earnedAt?: string } }) {
  return (
    <article
      className={`relative rounded-xl border p-4 transition-all duration-200 group ${
        badge.earned
          ? "border-accent/30 bg-accent/5"
          : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-3xl transition-transform group-hover:scale-110 ${
          badge.earned ? "bg-accent/10" : "bg-muted/10 opacity-50"
        }`}>
          {badge.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-sm font-semibold truncate ${badge.earned ? "text-foreground" : "text-muted"}`}>
              {badge.name}
            </h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              badge.tier === "bronze" ? "bg-amber-100 text-amber-800" :
              badge.tier === "silver" ? "bg-gray-100 text-gray-800" :
              badge.tier === "gold" ? "bg-yellow-100 text-yellow-800" :
              "bg-slate-100 text-slate-800"
            }`}>
              {badge.tier}
            </span>
          </div>
          <p className={`mt-1 text-xs truncate ${badge.earned ? "text-muted" : "text-dim"}`}>
            {badge.description}
          </p>
          {!badge.earned && badge.progress && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-muted">Progress</span>
                <span className="font-mono text-accent">
                  {Math.round(badge.progress.progress * 100)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full bg-warm transition-all duration-300"
                  style={{ width: `${badge.progress.progress * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted">
                <span>{badge.progress.currentValue} / {badge.progress.targetValue}</span>
                <span>{getCategoryLabel(badge.category)}</span>
              </div>
            </div>
          )}
          {badge.earned && badge.earnedAt && (
            <div className="mt-2 text-[10px] text-accent">
              Earned {new Date(badge.earnedAt).toLocaleDateString()}
            </div>
          )}
        </div>
        <div className={`shrink-0 flex h-14 w-14 items-center justify-center rounded-lg text-2xl transition-all duration-300 ${
          badge.earned
            ? "bg-accent text-background scale-100"
            : "bg-muted/10 text-muted/50 group-hover:scale-110"
        }`}>
          {badge.earned ? "✓" : "?"}
        </div>
      </div>
    </article>
  );
}

function getCategoryLabel(category: Badge["category"]): string {
  switch (category) {
    case "milestone": return "Milestone";
    case "streak": return "Streak";
    case "mastery": return "Mastery";
    case "special": return "Special";
    case "social": return "Social";
  }
}

export default function BadgesPage() {
  const [stats, setStats] = useState<UserStats>(() => {
    if (typeof window === "undefined") return loadStats();
    return loadStats();
  });
  const [badges, setBadges] = useState<EarnedBadge[]>(() => {
    if (typeof window === "undefined") return [];
    return loadBadges();
  });
  const [filter, setFilter] = useState<"all" | "earned" | "unearned" | Badge["category"]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleFocus = () => {
      setStats(loadStats());
      setBadges(loadBadges());
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const badgesWithProgress = useMemo(() => getBadgesWithProgress(stats), [stats]);

  const filteredBadges = useMemo(() => {
    return badgesWithProgress.filter((badge) => {
      // Search filter
      if (search && !badge.name.toLowerCase().includes(search.toLowerCase()) && 
          !badge.description.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      // Category/earned filter
      if (filter === "earned" && !badge.earned) return false;
      if (filter === "unearned" && badge.earned) return false;
      if (filter !== "all" && filter !== "earned" && filter !== "unearned" && badge.category !== filter) return false;
      
      return true;
    });
  }, [badgesWithProgress, filter, search]);

  const earnedCount = badgesWithProgress.filter(b => b.earned).length;
  const totalCount = badgesWithProgress.length;

  const categoryFilters: Array<"all" | "earned" | "unearned" | Badge["category"]> = [
    "all",
    "earned",
    "unearned",
    "milestone",
    "streak",
    "mastery",
    "special",
    "social",
  ];

  const categoryLabels: Record<string, string> = {
    all: "All",
    earned: "Earned",
    unearned: "In Progress",
    milestone: "Milestones",
    streak: "Streaks",
    mastery: "Mastery",
    special: "Special",
    social: "Social",
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:py-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/practice"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent mb-6"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 16 16">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Practice
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-warm/20 bg-warm/5 px-3 py-1 text-xs font-semibold tracking-wide text-warm">
              Achievements
            </span>
            <h1 className="mt-2 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
              Your Badges
            </h1>
            <p className="mt-2 text-muted">
              {badgesWithProgress.filter(b => b.earned).length} / {badgesWithProgress.length} badges earned
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2">
            <span className="text-2xl">🏆</span>
            <div>
              <span className="block text-[10px] uppercase tracking-wider text-muted">Completion</span>
              <span className="text-xl font-display font-bold text-accent">{Math.round((badgesWithProgress.filter(b => b.earned).length / badgesWithProgress.length) * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search badges..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line bg-surface text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Filter badges">
            {categoryFilters.map((cat) => (
              <button
                key={cat}
                role="radio"
                aria-checked={filter === cat}
                onClick={() => setFilter(cat)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  filter === cat
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-elevated"
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Badge Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {badgesWithProgress.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
              <span className="text-4xl mb-2 block">🔍</span>
              <p className="text-muted">No badges found</p>
            </div>
          ) : (
            badgesWithProgress
              .filter((badge) => {
                if (filter === "earned" && !badge.earned) return false;
                if (filter === "unearned" && badge.earned) return false;
                if (filter !== "all" && filter !== "earned" && filter !== "unearned" && badge.category !== filter) return false;
                if (search && !badge.name.toLowerCase().includes(search.toLowerCase()) && 
                    !badge.description.toLowerCase().includes(search.toLowerCase())) {
                  return false;
                }
                return true;
              })
              .map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))
          )}
        </div>
      </div>
    </div>
  );
}

const categoryFilters: Array<"all" | "earned" | "unearned" | "milestone" | "streak" | "mastery" | "special" | "social"> = [
  "all",
  "earned",
  "unearned",
  "milestone",
  "streak",
  "mastery",
  "special",
  "social",
];

const categoryLabels: Record<string, string> = {
  all: "All",
  earned: "Earned",
  unearned: "In Progress",
  milestone: "Milestones",
  streak: "Streaks",
  mastery: "Mastery",
  special: "Special",
  social: "Social",
};