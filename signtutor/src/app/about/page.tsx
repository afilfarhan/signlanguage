export const metadata = { title: "About — SignTutor" };

const timeline = [
  {
    step: "1",
    title: "Hand Detection",
    description: "MediaPipe Hands detects 21 landmarks per frame at ~30 fps, entirely on-device.",
  },
  {
    step: "2",
    title: "Feature Extraction",
    description: "Normalized landmark coordinates are transformed into rotation-invariant features.",
  },
  {
    step: "3",
    title: "Classification",
    description: "A lightweight MLP (72 KB) classifies static signs, with a rule-based fallback for reliability.",
  },
  {
    step: "4",
    title: "Dynamic Recognition",
    description: "A Transformer (360 KB) processes 45-frame windows for dynamic signs like J and Z.",
  },
  {
    step: "5",
    title: "Spaced Repetition",
    description: "FSRS scheduling adapts review intervals based on your accuracy, focusing on your weakest signs.",
  },
];

const techStack = [
  { category: "Frontend", items: ["Next.js 16", "React 19", "Tailwind CSS 4"] },
  { category: "ML Pipeline", items: ["MediaPipe Hands", "ONNX Runtime Web", "Custom MLP + Transformer"] },
  { category: "Algorithm", items: ["FSRS Scheduler", "Rule-based Fallback", "Velocity Features"] },
  { category: "Accessibility", items: ["WCAG 2.2 AA", "Keyboard Navigation", "Reduced Motion"] },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 lg:py-16">
      {/* Header */}
      <div className="mb-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
          About
        </span>
        <h1 className="mt-4 text-3xl font-display font-bold tracking-tight text-foreground lg:text-4xl">
          About SignTutor
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
          A free, browser-based sign language learning platform powered by on-device machine learning.
          No video uploads, no cloud processing, no accounts required.
        </p>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Main content - Timeline */}
        <div className="lg:col-span-2">
          <section>
            <h2 className="text-xl font-display font-semibold text-foreground">
              How it works
            </h2>
            <div className="mt-8 flex flex-col gap-6">
              {timeline.map((item, i) => (
                <div key={item.step} className="relative flex gap-4">
                  {/* Connector line */}
                  {i < timeline.length - 1 && (
                    <div className="absolute left-5 top-10 h-full w-px bg-line" />
                  )}
                  {/* Step number */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-sm font-mono font-bold text-accent">
                    {item.step}
                  </div>
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Accessibility */}
          <section className="mt-12">
            <h2 className="text-xl font-display font-semibold text-foreground">
              Accessibility
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              SignTutor targets WCAG 2.2 AA compliance with keyboard navigation, ARIA landmarks, visible focus rings,
              reduced-motion support, and high-contrast dark theme. We welcome accessibility bug reports.
            </p>
          </section>

          {/* Limitations */}
          <section className="mt-12">
            <h2 className="text-xl font-display font-semibold text-foreground">
              Limitations
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                Only ASL fingerspelling (24 letters, excluding J and Z which are dynamic) and 8 isolated signs are supported in v1.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                Models were trained on synthetic data — real-world accuracy varies with lighting, background, and hand size.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                Non-manual markers (facial expression, body shift) are not scored.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                No educator dashboard or user accounts in v1.
              </li>
            </ul>
          </section>

          {/* Credits */}
          <section className="mt-12">
            <h2 className="text-xl font-display font-semibold text-foreground">
              Credits
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Built with Next.js, MediaPipe Hands, ONNX Runtime Web, and Tailwind CSS.
              The FSRS scheduling algorithm is inspired by the Free Spaced Repetition Scheduler.
            </p>
          </section>
        </div>

        {/* Sticky sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
              Tech Stack
            </h3>
            <div className="mt-5 space-y-5">
              {techStack.map((group) => (
                <div key={group.category}>
                  <h4 className="text-xs font-medium text-dim">
                    {group.category}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-line bg-elevated px-2.5 py-1 text-xs font-mono text-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
