"use client";

import { useEffect, useState } from "react";

export function SWRegister() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    // Register service worker
    navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        setRegistration(reg);

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                if (!cancelled) setUpdateAvailable(true);
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn("SW registration failed:", err);
      });

    // Listen for controller change (new SW activated)
    const handleControllerChange = () => {
      if (!cancelled) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  // Render update prompt if available
  if (updateAvailable) {
    return (
      <div
        className="fixed bottom-4 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up"
        role="alert"
        aria-live="polite"
      >
        <div className="bg-elevated border border-line rounded-xl p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Update Available</p>
              <p className="text-sm text-muted mt-1">A new version of SignTutor is ready. Click to refresh.</p>
            </div>
            <button
              onClick={() => {
                if (registration?.waiting) {
                  registration.waiting.postMessage({ type: "SKIP_WAITING" });
                }
                window.location.reload();
              }}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-accent text-accent-foreground hover:opacity-90 transition-opacity shrink-0"
            >
              Refresh
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="text-muted hover:text-foreground shrink-0"
              aria-label="Dismiss"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}