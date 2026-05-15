import Link from "next/link";

const features = [
  {
    tag: "Alphabet",
    title: "Fingerspelling",
    description: "24 ASL letters with real-time per-finger feedback",
    href: "/learn/asl/fingerspelling",
  },
  {
    tag: "Vocabulary",
    title: "Dynamic Signs",
    description: "8 isolated signs with Transformer-based recognition",
    href: "/learn/asl/words",
  },
  {
    tag: "Retention",
    title: "Spaced Repetition",
    description: "FSRS-powered review queue that adapts to you",
    href: "/practice",
  },
  {
    tag: "Security",
    title: "Privacy First",
    description: "No webcam data leaves your device — ever",
    href: "/privacy",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="flex flex-col items-center gap-8 px-6 pt-24 pb-16 text-center lg:pt-32 lg:pb-24">
        <span className="rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold tracking-wide text-accent">
          SignTutor
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl">
          Learn sign language with real-time feedback
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted">
          Practice fingerspelling and common signs right in your browser. Our
          on-device AI watches your hands and gives instant, private feedback —
          no video uploads, no cloud processing.
        </p>
        <Link
          href="/setup"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-semibold text-background transition-colors hover:bg-accent/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Start your first lesson
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section
        aria-label="Platform highlights"
        className="flex flex-wrap items-center justify-center gap-3 px-6 pb-16"
      >
        {["🔒 On-device by default", "MediaPipe Hands", "ONNX ML", "WCAG 2.2 AA"].map(
          (badge) => (
            <span
              key={badge}
              className="rounded-full border border-line bg-panel px-4 py-1.5 text-sm font-medium text-muted"
            >
              {badge}
            </span>
          )
        )}
      </section>

      <section
        aria-label="Features"
        className="mx-auto w-full max-w-5xl px-6 pb-24"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 transition-colors hover:border-accent/50 hover:bg-panel2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="w-fit rounded-full bg-accent2/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent2">
                {f.tag}
              </span>
              <h2 className="text-xl font-bold text-foreground group-hover:text-accent">
                {f.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                {f.description}
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-accent transition-transform group-hover:translate-x-1">
                Explore
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-line bg-panel2 px-6 py-8">
        <nav
          aria-label="Footer navigation"
          className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-sm text-muted"
        >
          <span>© {new Date().getFullYear()} SignTutor</span>
          <div className="flex flex-wrap items-center gap-6">
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
          </div>
        </nav>
      </footer>
    </div>
  );
}
