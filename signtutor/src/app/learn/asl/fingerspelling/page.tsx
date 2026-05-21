"use client";

import { useState } from "react";
import Link from "next/link";
import { STATIC_LETTERS, LETTER_DESCRIPTIONS, MOTION_LETTERS } from "@/lib/curriculum";

export default function FingerspellingPage() {
  const [filter, setFilter] = useState<"all" | "static" | "motion">("all");

  const letters = STATIC_LETTERS.filter((letter) => {
    if (filter === "all") return true;
    const isMotion = (MOTION_LETTERS as readonly string[]).includes(letter);
    return filter === "motion" ? isMotion : !isMotion;
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          Alphabet
        </span>
        <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
          ASL Fingerspelling
        </h1>
        <p className="mt-3 text-muted">
          24 letters · real-time per-finger feedback · on-device ML + rule hybrid
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-8 flex items-center gap-2">
        {(["all", "static", "motion"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              filter === f
                ? "bg-accent/10 text-accent"
                : "text-muted hover:text-foreground hover:bg-elevated"
            }`}
          >
            {f === "all" ? "All Letters" : f === "static" ? "Static" : "Motion"}
            {f === "motion" && (
              <span className="ml-1.5 rounded-full bg-warm/20 px-1.5 py-0.5 text-[10px] font-bold text-warm">
                {MOTION_LETTERS.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Letter grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {letters.map((letter) => {
          const isMotion = (MOTION_LETTERS as readonly string[]).includes(letter);
          return (
            <Link
              key={letter}
              href={`/learn/asl/fingerspelling/${letter}`}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-accent/30 hover:shadow-[0_0_30px_rgba(0,229,176,0.06)] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/5 text-2xl font-display font-bold text-accent transition-all duration-200 group-hover:bg-accent group-hover:text-background group-hover:shadow-[0_0_20px_rgba(0,229,176,0.3)]">
                  {letter}
                </span>
                {isMotion && (
                  <span className="rounded-full bg-warm/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warm">
                    Motion
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted group-hover:text-foreground/80 transition-colors">
                {LETTER_DESCRIPTIONS[letter]}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
