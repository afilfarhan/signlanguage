export const metadata = { title: "Privacy — SignTutor" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted">Last updated: {new Date().toLocaleDateString()}</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">On-device by design</h2>
        <p className="mt-2 leading-relaxed text-muted">
          SignTutor processes all webcam frames and hand-landmark data <strong className="text-foreground">entirely on your device</strong>.
          No video frames, images, or landmark data are ever transmitted to any server. Machine learning inference
          (MediaPipe Hands, ONNX models) runs in your browser using WebAssembly.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">What we store locally</h2>
        <ul className="mt-2 list-disc pl-5 leading-relaxed text-muted">
          <li><strong className="text-foreground">Preferences</strong> (<code className="rounded bg-panel2 px-1.5 py-0.5 text-xs text-accent">signtutor.prefs</code>): language, handedness, mirror setting, setup completion timestamp.</li>
          <li><strong className="text-foreground">Progress</strong> (<code className="rounded bg-panel2 px-1.5 py-0.5 text-xs text-accent">signtutor.progress</code>): per-sign attempt counts, accuracy, FSRS scheduling state.</li>
        </ul>
        <p className="mt-2 leading-relaxed text-muted">This data lives in your browser&apos;s localStorage only. You can clear it at any time by clearing your browser data for this site.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Network requests</h2>
        <p className="mt-2 leading-relaxed text-muted">
          On lesson pages, a Content Security Policy restricts network connections to:
        </p>
        <ul className="mt-2 list-disc pl-5 leading-relaxed text-muted">
          <li>CDN for MediaPipe Hands model files (jsdelivr.net)</li>
          <li>Self-origin for ONNX model files served as static assets</li>
        </ul>
        <p className="mt-2 leading-relaxed text-muted">
          No analytics, no tracking pixels, no third-party scripts on lesson pages. The landing page may load Google Fonts.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">No accounts</h2>
        <p className="mt-2 leading-relaxed text-muted">
          SignTutor v1 does not require or offer user accounts. There is no server-side storage of personal information.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Camera access</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Camera access is requested only during the setup wizard or when you click &quot;Start camera&quot; on a lesson page.
          You can revoke camera permission at any time through your browser settings. We do not record audio.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="mt-2 leading-relaxed text-muted">
          For privacy questions or concerns, open an issue on our GitHub repository.
        </p>
      </section>
    </div>
  );
}
