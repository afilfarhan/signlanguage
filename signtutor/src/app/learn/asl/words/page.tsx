"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { VOCABULARY_200, CATEGORIES, type SignEntry } from "@/lib/vocabulary_200";
import { DYNAMIC_SIGNS } from "@/lib/curriculum";

const ML_SIGNS = new Set<string>(DYNAMIC_SIGNS as unknown as string[]);

const CATEGORY_COLORS: Record<string, string> = {
  Greetings: "accent",
  Family: "accent2",
  Food: "warm",
  Colors: "accent",
  Numbers: "accent2",
  Emotions: "bad",
  Time: "warm",
  Verbs: "accent",
  Places: "accent2",
  Directions: "warm",
  Adjectives: "accent",
};

export default function WordsPage() {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let signs = VOCABULARY_200;
    if (activeCategory !== "All") {
      signs = signs.filter((s) => s.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      signs = signs.filter(
        (s) =>
          s.gloss.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }
    return signs;
  }, [activeCategory, search]);

  // Group by category for "All" view
  const grouped = useMemo(() => {
    if (activeCategory !== "All") return {};
    const map: Record<string, SignEntry[]> = {};
    for (const sign of filtered) {
      if (!map[sign.category]) map[sign.category] = [];
      map[sign.category].push(sign);
    }
    return map;
  }, [filtered, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: VOCABULARY_200.length };
    for (const sign of VOCABULARY_200) {
      counts[sign.category] = (counts[sign.category] || 0) + 1;
    }
    return counts;
  }, []);

  const renderSignCard = (sign: SignEntry) => {
    const isML = ML_SIGNS.has(sign.gloss);
    const color = CATEGORY_COLORS[sign.category] || "accent";

    return (
      <Link
        key={sign.id}
        href={`/learn/asl/words/${sign.id}`}
        className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-accent/30 hover:shadow-[0_0_30px_rgba(0,229,176,0.06)] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div className="flex items-start justify-between">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              color === "accent"
                ? "bg-accent/10 text-accent"
                : color === "accent2"
                ? "bg-accent2/10 text-accent2"
                : color === "warm"
                ? "bg-warm/10 text-warm"
                : "bg-bad/10 text-bad"
            }`}
          >
            {sign.category}
          </span>
          {isML && (
            <span className="rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ok">
              ML
            </span>
          )}
        </div>
        <h3 className="text-base font-display font-bold text-foreground group-hover:text-accent transition-colors">
          {sign.gloss}
        </h3>
        <p className="text-xs leading-relaxed text-muted line-clamp-2">
          {sign.description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-[10px] font-mono text-dim">
            #{sign.aslLexRank} · {sign.handshape}-hand
          </span>
          <svg
            className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M6.75 3.25L11.5 8L6.75 12.75"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Link>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          Vocabulary
        </span>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
              ASL Vocabulary
            </h1>
            <p className="mt-2 text-muted">
              {VOCABULARY_200.length} signs across {CATEGORIES.length} categories ·{" "}
              {DYNAMIC_SIGNS.length} with real-time ML feedback
            </p>
          </div>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            viewBox="0 0 16 16"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth={1.5} />
            <path
              d="M11 11L14 14"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            placeholder="Search signs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none"
          />
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {["All", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                activeCategory === cat
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-elevated"
              }`}
            >
              {cat}
              <span className="ml-1 text-[10px] opacity-60">
                {categoryCounts[cat] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-xs text-muted">
        {filtered.length} sign{filtered.length !== 1 ? "s" : ""}
        {activeCategory !== "All" && ` in ${activeCategory}`}
        {search && ` matching "${search}"`}
      </div>

      {/* Sign cards */}
      {activeCategory === "All" && !search ? (
        // Grouped by category
        <div className="flex flex-col gap-10">
          {Object.entries(grouped).map(([category, signs]) => {
            const color = CATEGORY_COLORS[category] || "accent";
            return (
              <section key={category}>
                <h2 className="mb-4 flex items-center gap-3 text-lg font-display font-semibold text-foreground">
                  <span
                    className={`h-1 w-4 rounded-full ${
                      color === "accent"
                        ? "bg-accent"
                        : color === "accent2"
                        ? "bg-accent2"
                        : color === "warm"
                        ? "bg-warm"
                        : "bg-bad"
                    }`}
                  />
                  {category}
                  <span className="text-sm font-normal text-muted">
                    ({signs.length})
                  </span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {signs.map(renderSignCard)}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        // Flat grid for filtered/search results
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(renderSignCard)}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg text-muted">No signs found</p>
          <p className="mt-2 text-sm text-dim">
            Try adjusting your search or category filter
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ok" /> ML feedback available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" /> Reference only
        </span>
      </div>
    </div>
  );
}
