import Link from "next/link";
import { STATIC_LETTERS, LETTER_DESCRIPTIONS } from "@/lib/curriculum";

export const metadata = { title: "ASL Fingerspelling — SignTutor" };

export default function FingerspellingPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">ASL Fingerspelling</h1>
      <p className="mt-2 mb-8 text-muted">24 letters · real-time per-finger feedback · on-device ML + rule hybrid</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STATIC_LETTERS.map((letter) => (
          <Link
            key={letter}
            href={`/learn/asl/fingerspelling/${letter}`}
            className="group flex items-center gap-4 rounded-xl border border-line bg-panel p-4 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent/10 text-2xl font-bold text-accent group-hover:bg-accent group-hover:text-background transition-colors">
              {letter}
            </span>
            <span className="text-sm leading-relaxed text-muted group-hover:text-foreground transition-colors">
              {LETTER_DESCRIPTIONS[letter]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
