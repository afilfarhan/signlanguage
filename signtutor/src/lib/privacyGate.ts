/**
 * Privacy Gate — Toy reference implementation per NFR-12/NFR-13
 *
 * Intercepts fetch() / XMLHttpRequest to assert that no landmark tensors,
 * embeddings, adapter weights, or NMM features ever leave the device.
 *
 * Usage: import from the entry point (e.g. app/layout.tsx) so the gate
 * installs on the first render in the browser.
 *
 * NOTE: This is a teaching / reference scaffold for BUILD_PROMPT (§7, W4/W5/W8).
 */

export type MonitorCallback = (reason: string) => void;

let onLeakDetected: MonitorCallback | null = null;

export function setLeakCallback(cb: MonitorCallback | null) {
  onLeakDetected = cb;
}

/** Scalars for “suspicious” content classification */
const SUSPICIOUS_HEADERS = new Set([
  "x-landmarks",
  "x-embedding",
  "x-adapter",
  "x-nmm",
]);

const PATTERNS = [
  /normlandmark/i,
  /handlandmark/i,
  /embedding/i,
  /adapterweights/i,
  /nmmfeatures/i,
  /float32array/i,
  /mediapipe.*landmark/i,
] as const;

function isSuspicious(value: string | null | undefined): string | null {
  if (!value) return null;

  for (const ph of SUSPICIOUS_HEADERS) {
    if (value.toLowerCase().includes(ph)) return `matched keyword "${ph}"`;
  }
  for (const re of PATTERNS) {
    if (re.test(value)) return `matched pattern ${re.toString()}`;
  }
  return null;
}

function reportLeak(reason: string, detail: string) {
  console.error(`[PRIVACY-GATE] BLOCKED: ${reason} (${detail})`);
  if (onLeakDetected) onLeakDetected(`${reason}: ${detail}`);
}

function shouldAllowRequest(
  url: string | URL,
  init?: RequestInit,
): { allowed: boolean; reason?: string } {
  // Allow local assets, data, blob, external CDN
  const href = new URL(url, location.href).href;
  if (href.startsWith("blob:") || href.startsWith("data:")) {
    return { allowed: true };
  }

  // Inspect headers
  const headers = (init?.headers as Record<string, string>) ?? {};
  for (const [key, value] of Object.entries(headers)) {
    const hit = isSuspicious(`${key} ${String(value)}`);
    if (hit) return { allowed: false, reason: `Header ${hit}` };
  }

  // Inspect body text for suspicious keywords
  if (init?.body) {
    const text = String(init.body);
    const hit = isSuspicious(text);
    if (hit) return { allowed: false, reason: `Body ${hit}` };
  }

  // Inspect URL query string
  const hit = isSuspicious(href);
  if (hit) return { allowed: false, reason: `URL ${hit}` };

  return { allowed: true };
}

/** Install global fetch/XHR interceptors. Safe to call multiple times. */
export function installPrivacyGate() {
  if (typeof window === "undefined") return;
  if ((window as unknown as Record<string, unknown>).__privacyGateInstalled) return;
  (window as unknown as Record<string, unknown>).__privacyGateInstalled = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input;
    const result = shouldAllowRequest(url, init);
    if (!result.allowed) {
      reportLeak("fetch", result.reason!);
      throw new Error(`Privacy gate blocked: fetch ${result.reason}`);
    }
    return nativeFetch(input, init);
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    user?: string | null,
    password?: string | null
  ) {
    const result = shouldAllowRequest(url);
    if (!result.allowed) {
      reportLeak("XHR open", result.reason!);
      throw new Error(`Privacy gate blocked: XHR open ${result.reason}`);
    }
    return nativeOpen.call(this, method, url, async ?? true, user ?? null, password ?? null);
  };

  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    if (body) {
      const hit = isSuspicious(String(body));
      if (hit) {
        reportLeak("XHR send", hit);
        throw new Error(`Privacy gate blocked: XHR send ${hit}`);
      }
    }
    return nativeSend.call(this, body);
  };
}
