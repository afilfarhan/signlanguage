"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

export default function ResearchClient() {
  const [agreed, setAgreed] = useState(false);
  const [readTime, setReadTime] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setReadTime((t) => {
        if (t >= 3) {
          clearInterval(interval);
          return 3;
        }
        return t + 1;
      });
    }, 1000);
    intervalRef.current = interval;
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleScroll = useCallback(() => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        setScrolled(true);
      }
    }
  }, []);

  const canProceed = readTime >= 3 || scrolled;

  if (!agreed) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Research Preview</h1>
        <div className="rounded-2xl border border-warn/30 bg-warn/5 p-6 mb-6">
          <h2 className="text-xl font-semibold text-warn mb-3">Continuous Sign Language Recognition</h2>
          <div
            ref={contentRef}
            onScroll={handleScroll}
            className="space-y-4 text-sm text-muted max-h-64 overflow-y-auto mb-4 pr-2"
          >
            <p>This is a <strong>research preview</strong>, not a production feature.</p>
            <p>Expected accuracy is <strong>much lower</strong> than our trained isolated-sign models. Continuous recognition over sentences adds co-articulation, omitted signs, and decoding complexity.</p>
            <p className="text-bad font-medium">
              No verdict. No scoring. This surface only transcribes — it never says &quot;right&quot; or &quot;wrong&quot;.
            </p>
            <p>Your webcam data stays on-device. Nothing is uploaded.</p>
            <p className="pb-4">By continuing, you acknowledge this is an experimental preview with no guarantee of accuracy.</p>
          </div>
          <button
            onClick={() => canProceed && setAgreed(true)}
            disabled={!canProceed}
            className="w-full rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-background hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {canProceed ? "I Understand — Continue" : `Read for ${3 - readTime}s more or scroll to bottom`}
          </button>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Return to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Continuous SLR — Research Preview</h1>
        <span className="rounded-full bg-warn/10 px-3 py-1 text-xs font-semibold text-warn">BETA</span>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Live Transcription</h2>
        <div className="aspect-video bg-black rounded-xl flex items-center justify-center mb-4 relative">
          <span className="text-muted text-sm">Webcam feed placeholder — CTC decoder active</span>
          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-3">
            <p className="text-sm font-mono text-foreground">Waiting for signs...</p>
          </div>
        </div>
        <p className="text-xs text-muted">
          This preview uses a CTC encoder-decoder Transformer. WER target: ≤ 0.50 on PHOENIX-2014T.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-warn/30 bg-warn/5 p-4">
        <p className="text-sm text-warn">
          <strong>Disclaimer:</strong> This is a research preview. Continuous sign recognition accuracy
          is typically 30–60% WER on constrained domains. Do not rely on this for production use.
        </p>
      </div>
    </div>
  );
}
