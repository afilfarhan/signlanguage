import Link from "next/link";
import { DYNAMIC_SIGNS, SIGN_DESCRIPTIONS } from "@/lib/curriculum";

export const metadata = { title: "ASL Dynamic Signs — SignTutor" };

export default function WordsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">ASL Dynamic Signs</h1>
      <p className="mt-2 mb-8 text-muted">8 common signs · Transformer recognition · 1.5 s recording window</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {DYNAMIC_SIGNS.map((sign) => (
          <Link
            key={sign}
            href={`/learn/asl/words/${sign.toLowerCase()}`}
            className="group flex items-center gap-4 rounded-xl border border-line bg-panel p-5 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent2/10 text-xl font-bold text-accent2 group-hover:bg-accent2 group-hover:text-background transition-colors">
              {sign}
            </span>
            <span className="text-sm leading-relaxed text-muted group-hover:text-foreground transition-colors">
              {SIGN_DESCRIPTIONS[sign]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
