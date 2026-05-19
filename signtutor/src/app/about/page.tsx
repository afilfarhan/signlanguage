export const metadata = { title: "About — SignTutor" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">About SignTutor</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">What is SignTutor?</h2>
        <p className="mt-2 leading-relaxed text-muted">
          SignTutor is a free, browser-based sign language learning platform that uses on-device machine learning
          to give you real-time feedback on your fingerspelling and signs. No video uploads, no cloud processing,
          no accounts required — everything runs locally in your browser.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ul className="mt-2 list-disc pl-5 leading-relaxed text-muted">
          <li><strong className="text-foreground">MediaPipe Hands</strong> detects 21 hand landmarks per frame at ~30 fps, entirely on-device.</li>
          <li><strong className="text-foreground">Static signs</strong> are classified by a small MLP (72 KB ONNX) plus a rule-based fallback, using normalized landmark features.</li>
          <li><strong className="text-foreground">Dynamic signs</strong> use a Transformer (360 KB ONNX) over a 45-frame sliding window with velocity features.</li>
          <li><strong className="text-foreground">FSRS spaced repetition</strong> schedules review based on your accuracy, so you focus on signs you find hardest.</li>
          <li>A <strong className="text-foreground">hybrid ML + rule classifier</strong> ensures the app keeps working even if the ONNX model fails to load.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Accessibility</h2>
        <p className="mt-2 leading-relaxed text-muted">
          SignTutor targets WCAG 2.2 AA compliance with keyboard navigation, ARIA landmarks, visible focus rings,
          reduced-motion support, and high-contrast dark theme. We welcome accessibility bug reports.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Limitations</h2>
        <ul className="mt-2 list-disc pl-5 leading-relaxed text-muted">
          <li>Only ASL fingerspelling (24 letters, excluding J and Z which are dynamic) and 8 isolated signs are supported in v1.</li>
          <li>Models were trained on synthetic data — real-world accuracy varies with lighting, background, and hand size.</li>
          <li>Non-manual markers (facial expression, body shift) are not scored.</li>
          <li>No educator dashboard or user accounts in v1.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Credits</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Built with Next.js, MediaPipe Hands, ONNX Runtime Web, and Tailwind CSS.
          The FSRS scheduling algorithm is inspired by the Free Spaced Repetition Scheduler.
        </p>
      </section>
    </div>
  );
}
