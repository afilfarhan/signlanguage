import Link from "next/link";

const features = [
  {
    tag: "Alphabet",
    title: "Fingerspelling",
    description: "24 ASL letters with real-time per-finger feedback. See each finger light up as you form the correct shape.",
    href: "/learn/asl/fingerspelling",
  },
  {
    tag: "Vocabulary",
    title: "Dynamic Signs",
    description: "8 isolated signs with Transformer-based recognition. Build your vocabulary one sign at a time.",
    href: "/learn/asl/words",
  },
  {
    tag: "Retention",
    title: "Spaced Repetition",
    description: "FSRS-powered review queue that adapts to your memory curve. Never forget what you've learned.",
    href: "/practice",
  },
  {
    tag: "Security",
    title: "Privacy First",
    description: "No webcam data leaves your device — ever. All inference runs locally in your browser.",
    href: "/privacy",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative flex flex-col items-center gap-8 overflow-hidden px-6 pt-28 pb-20 text-center lg:pt-36 lg:pb-28">
        {/* Radial gradient background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0, 229, 176, 0.15) 0%, transparent 100%)",
          }}
        />

        <span className="relative inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-4 py-1.5 text-sm font-semibold tracking-wide text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          On-device AI · No uploads
        </span>

        <h1 className="relative max-w-4xl text-4xl font-display font-bold leading-tight tracking-tight text-foreground lg:text-7xl">
          Master ASL with{" "}
          <span className="relative inline-block text-accent">
            real-time
            <span
              className="pointer-events-none absolute -inset-1 rounded-lg opacity-30 blur-xl"
              style={{
                background: "rgba(0, 229, 176, 0.4)",
              }}
            />
          </span>{" "}
          feedback
        </h1>

        <p className="relative max-w-xl text-lg leading-relaxed text-muted">
          Practice fingerspelling and common signs right in your browser. Our
          on-device AI watches your hands and gives instant, private feedback —
          no video uploads, no cloud processing.
        </p>

        <div className="relative flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/setup"
            className="group inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-background transition-all duration-200 hover:bg-accent/90 hover:shadow-[0_0_30px_rgba(0,229,176,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Start your first lesson
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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
          </Link>
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-8 py-3.5 text-base font-medium text-foreground backdrop-blur transition-colors hover:border-accent/30 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Browse curriculum
          </Link>
        </div>
      </section>

      {/* Tech badges */}
      <section
        aria-label="Platform highlights"
        className="flex flex-wrap items-center justify-center gap-3 px-6 pb-16"
      >
        {[
          { label: "On-device by default", icon: "🔒" },
          { label: "MediaPipe Hands", icon: "✋" },
          { label: "ONNX ML", icon: "🧠" },
          { label: "WCAG 2.2 AA", icon: "♿" },
        ].map((badge) => (
          <span
            key={badge.label}
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-muted"
          >
            <span className="mr-1.5">{badge.icon}</span>
            {badge.label}
          </span>
        ))}
      </section>

      {/* Feature cards */}
      <section
        aria-label="Features"
        className="mx-auto w-full max-w-5xl px-6 pb-24"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-all duration-200 hover:border-accent/30 hover:shadow-[0_0_40px_rgba(0,229,176,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
                {f.tag}
              </span>
              <h2 className="text-xl font-display font-bold text-foreground group-hover:text-accent transition-colors">
                {f.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                {f.description}
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">
                Explore
                <svg
                  className="h-3.5 w-3.5"
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
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-surface px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <span className="text-sm text-muted">
            © {new Date().getFullYear()} SignTutor
          </span>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-6 text-sm text-muted"
          >
            <Link
              href="/about"
              className="transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              About
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Privacy
            </Link>
            <a
              href="https://github.com/signtutor/signtutor"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
