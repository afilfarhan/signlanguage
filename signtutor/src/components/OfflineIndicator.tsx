"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-amber-900 px-4 py-2 text-center text-sm font-medium animate-slide-down"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span>You&apos;re offline &mdash; Some features may be limited</span>
      </div>
    </div>
  );
}

export function PWAUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        }
      });
    });
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-elevated border border-line rounded-xl p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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