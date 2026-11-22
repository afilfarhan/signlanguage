import { toHaveNoViolations } from "axe-core";

expect.extend(toHaveNoViolations);

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
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
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
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: () => [],
    getEntriesByName: () => [],
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
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

// Suppress console.error in tests (optional)
// const originalError = console.error;
// beforeAll(() => {
//   console.error = (...args) => {
//     if (args[0]?.includes?.("Warning: ReactDOM.render is no longer supported")) return;
//     originalError.apply(console, args);
//   };
// });
// afterAll(() => {
//   console.error = originalError;
// });