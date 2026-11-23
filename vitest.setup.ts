// Vitest setup file for accessibility testing

// Mock ResizeObserver (not available in JSDOM)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// Mock performance.now
Object.defineProperty(global, "performance", {
  writable: true,
  value: {
    now: () => Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: () => [],
    getEntriesByName: () => [],
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  },
});

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  writable: true,
  value: {
    randomUUID: () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }),
  },
});

// Custom matcher for axe-core accessibility violations
import { expect } from "vitest";
import axe from "axe-core";

expect.extend({
  async toHaveNoViolations(html: string, options?: Parameters<typeof axe.run>[1]) {
    const { JSDOM } = await import("jsdom");
    const dom = new JSDOM(html, { url: "http://localhost:3000" });
    const results = await axe.run(dom.window.document, options);
    
    if (results.violations.length > 0) {
      const violationMessages = results.violations.map(v => 
        `${v.id}: ${v.description} (impact: ${v.impact}) - ${v.nodes.map(n => n.target.join(", ")).join("; ")}`
      ).join("\n");
      
      return {
        pass: false,
        message: () => `Expected no accessibility violations but found:\n${violationMessages}`
      };
    }
    
    return {
      pass: true,
      message: () => "Expected accessibility violations but found none"
    };
  }
});

// Type declaration for the custom matcher
declare module "vitest" {
  interface Assertion<T = any> {
    toHaveNoViolations(options?: Parameters<typeof import("axe-core").run>[1]): Promise<T>;
  }
}