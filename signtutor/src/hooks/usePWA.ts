"use client";

import { useEffect, useState, useCallback } from "react";

export interface PWAStatus {
  isOnline: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  updateAvailable: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function usePWA(): PWAStatus & {
  install: () => Promise<void>;
  dismissInstallPrompt: () => void;
} {
  const [status, setStatus] = useState<PWAStatus>(() => {
    if (typeof window === "undefined") {
      return { isOnline: true, isInstalled: false, canInstall: false, updateAvailable: false };
    }
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as NavigatorWithStandalone).standalone === true;
    return {
      isOnline: navigator.onLine,
      isInstalled,
      canInstall: false,
      updateAvailable: false,
    };
  });

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Online/offline handlers
    const handleOnline = () => setStatus((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setStatus((prev) => ({ ...prev, isOnline: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Before install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setStatus((prev) => ({ ...prev, canInstall: true }));
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // App installed
    const handleAppInstalled = () => {
      setStatus((prev) => ({ ...prev, isInstalled: true, canInstall: false }));
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // Service worker update
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setStatus((prev) => ({ ...prev, updateAvailable: true }));
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setStatus((prev) => ({ ...prev, canInstall: false }));
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismissInstallPrompt = useCallback(() => {
    setStatus((prev) => ({ ...prev, canInstall: false }));
    setDeferredPrompt(null);
  }, []);

  return { ...status, install, dismissInstallPrompt };
}

/**
 * Register service worker with custom logic
 */
export function useSWRegistration() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker.ready.then((reg) => {
      if (!cancelled) {
        setRegistration(reg);
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err);
      }
    });

    // Listen for updates
    const handleControllerChange = () => {
      if (!cancelled) {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const update = useCallback(async () => {
    if (registration) {
      await registration.update();
    }
  }, [registration]);

  const unregister = useCallback(async () => {
    if (registration) {
      await registration.unregister();
      setRegistration(null);
    }
  }, [registration]);

  return { registration, error, update, unregister };
}