import Link from "next/link";

const modules = [
  {
    tag: "Alphabet",
    tagColor: "accent",
    title: "Fingerspelling",
    description: "All 26 letters with real-time per-finger feedback. Static and motion letters supported.",
    href: "/learn/asl/fingerspelling",
    count: "24 letters",
  },
  {
    tag: "Vocabulary",
    tagColor: "accent2",
    title: "200 Common Signs",
    description: "Browse and learn 200 high-frequency ASL signs across greetings, family, food, and more.",
    href: "/learn/asl/words",
    count: "200 signs",
  },
  {
    tag: "Retention",
    tagColor: "warm",
    title: "Spaced Repetition",
    description: "Personalized review queue that adapts to your learning pace. Powered by FSRS algorithm.",
    href: "/practice",
    count: "Adaptive",
  },
];

export const metadata = { title: "SignTutor — Learn ASL" };

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          Curriculum
        </span>
        <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
          Learn ASL
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
          Choose a module below to start practicing. All processing stays on your device — your webcam data never leaves the browser.
        </p>
      </div>

      {/* Progress overview */}
      <div className="mb-10 rounded-2xl border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Your Progress</h2>
            <p className="mt-1 text-xs text-muted">Start a module to track your learning</p>
          </div>
          <Link
            href="/setup"
            className="text-xs font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Setup wizard →
          </Link>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-elevated">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent2 transition-all duration-500"
            style={{ width: "0%" }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>0 / 32 signs mastered</span>
          <span>0%</span>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-all duration-200 hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,229,176,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
                  m.tagColor === "accent"
                    ? "bg-accent/10 text-accent"
                    : m.tagColor === "warm"
                    ? "bg-warm/10 text-warm"
                    : "bg-accent2/10 text-accent2"
                }`}
              >
                {m.tag}
              </span>
              <span className="text-xs font-mono text-dim">{m.count}</span>
            </div>
            <h2 className="text-xl font-display font-bold text-foreground group-hover:text-accent transition-colors">
              {m.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              {m.description}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">
              Explore
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
                <path
                  d="M6.75 3.25L11.5 8L6.75 12.75"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      {/* Settings card */}
      <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface/50 p-6">
        <Link
          href="/learn/asl/settings"
          className="group flex items-center justify-between transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
              Settings & Calibration
            </h3>
            <p className="mt-1 text-sm text-muted">
              Adjust hand preference, mirror mode, and model sensitivity.
            </p>
          </div>
          <svg
            className="h-5 w-5 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
            fill="none"
            viewBox="0 0 20 20"
          >
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
