import Link from "next/link";

export const metadata = { title: "SignTutor — Learn ASL" };

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Learn ASL</h1>
      <p className="mt-2 mb-8 text-muted">
        Choose a module below to start practicing. All processing stays on your device — your webcam data never leaves the browser.
      </p>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/learn/asl/fingerspelling"
          className="group flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="w-fit rounded-full bg-accent2/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent2 uppercase">Alphabet</span>
          <h2 className="text-xl font-bold text-foreground group-hover:text-accent">Fingerspelling</h2>
          <p className="text-sm leading-relaxed text-muted">All 26 letters with real-time per-finger feedback. Static and motion letters supported.</p>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">Explore →</span>
        </Link>

        <Link
          href="/learn/asl/words"
          className="group flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent uppercase">Vocabulary</span>
          <h2 className="text-xl font-bold text-foreground group-hover:text-accent">200 Common Signs</h2>
          <p className="text-sm leading-relaxed text-muted">Browse and learn 200 high-frequency ASL signs across greetings, family, food, and more.</p>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">Explore →</span>
        </Link>

        <Link
          href="/practice"
          className="group flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="w-fit rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold tracking-wide text-warn uppercase">Retention</span>
          <h2 className="text-xl font-bold text-foreground group-hover:text-accent">Spaced Repetition</h2>
          <p className="text-sm leading-relaxed text-muted">Personalized review queue that adapts to your learning pace. Powered by FSRS algorithm.</p>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">Explore →</span>
        </Link>

        <Link
          href="/learn/asl/settings"
          className="group flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="w-fit rounded-full bg-line/50 px-3 py-1 text-xs font-semibold tracking-wide text-muted uppercase">Setup</span>
          <h2 className="text-xl font-bold text-foreground group-hover:text-accent">Settings &amp; Calibrate</h2>
          <p className="text-sm leading-relaxed text-muted">Adjust hand preference, mirror mode, and model sensitivity. Enable personalization after 20 attempts.</p>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">Explore →</span>
        </Link>
      </div>
    </div>
  );
}
