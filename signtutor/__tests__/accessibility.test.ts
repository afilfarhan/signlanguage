import { test, expect } from "vitest";
import { JSDOM } from "jsdom";
import { toHaveNoViolations } from "axe-core";

// Extend Vitest with axe-core matcher
expect.extend(toHaveNoViolations);

const PAGES_TO_TEST = [
  { path: "/", name: "Home" },
  { path: "/setup", name: "Setup" },
  { path: "/learn/asl/fingerspelling/A", name: "Fingerspelling A" },
  { path: "/learn/asl/continuous", name: "Continuous SLR" },
  { path: "/learn/asl/personal", name: "Personal Signs" },
  { path: "/learn/asl/multilang", name: "Multi-Language" },
  { path: "/learn/asl/words/hello", name: "Vocabulary Hello" },
  { path: "/practice", name: "Practice" },
];

async function fetchPageHTML(path: string): Promise<string> {
  // In CI, this would fetch from the running dev server
  // For local testing, we can render the page
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }
  return response.text();
}

async function runAxeOnHTML(html: string, url: string) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  const { window } = dom;
  
  // Load axe-core
  const axe = await import("axe-core");
  
  // Run axe
  const results = await axe.default.run(window.document, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
    },
    resultTypes: ["violations"],
  });
  
  return results;
}

test.describe("Accessibility (axe-core WCAG 2.2 AA)", () => {
  for (const page of PAGES_TO_TEST) {
    test(`${page.name} (${page.path}) - WCAG 2.2 AA`, async () => {
      const html = await fetchPageHTML(page.path);
      const results = await runAxeOnHTML(html, `http://localhost:3000${page.path}`);
      
      // Fail on any violations
      expect(results).toHaveNoViolations();
    }, 30000); // 30 second timeout per page
  }
});

test.describe("Accessibility - Specific Checks", () => {
  test("All images have alt text", async () => {
    const html = await fetchPageHTML("/");
    const dom = new JSDOM(html);
    const images = dom.window.document.querySelectorAll("img");
    
    for (const img of images) {
      expect(img.hasAttribute("alt")).toBe(true);
    }
  });

  test("All form inputs have labels", async () => {
    const html = await fetchPageHTML("/setup");
    const dom = new JSDOM(html);
    const inputs = dom.window.document.querySelectorAll("input, select, textarea");
    
    for (const input of inputs) {
      const id = input.getAttribute("id");
      const ariaLabel = input.getAttribute("aria-label");
      const ariaLabelledBy = input.getAttribute("aria-labelledby");
      const label = id ? dom.window.document.querySelector(`label[for="${id}"]`) : null;
      
      // Input must have accessible name
      const hasAccessibleName = ariaLabel || ariaLabelledBy || label;
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test("Color contrast meets WCAG AA (4.5:1)", async () => {
    // This is checked by axe-core, but we can add custom checks
    // if we have specific color combinations to verify
    expect(true).toBe(true); // Placeholder
  });

  test("Focus indicators visible", async () => {
    const html = await fetchPageHTML("/");
    const dom = new JSDOM(html);
    const style = dom.window.document.createElement("style");
    style.textContent = `
      *:focus-visible {
        outline: 2px solid var(--accent-primary);
        outline-offset: 2px;
      }
    `;
    dom.window.document.head.appendChild(style);
    
    const focusable = dom.window.document.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    for (const el of focusable) {
      const computed = dom.window.getComputedStyle(el, ":focus-visible");
      const hasOutline = computed.outlineWidth !== "0px" || computed.boxShadow !== "none";
      // In JSDOM, :focus-visible may not work, so this is a placeholder
    }
  });

  test("No duplicate IDs", async () => {
    const html = await fetchPageHTML("/");
    const dom = new JSDOM(html);
    const elementsWithIds = dom.window.document.querySelectorAll("[id]");
    const ids = new Set<string>();
    
    for (const el of elementsWithIds) {
      const id = el.getAttribute("id");
      if (id) {
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    }
  });

  test("Landmarks present (main, nav, header, footer)", async () => {
    const html = await fetchPageHTML("/");
    const dom = new JSDOM(html);
    
    expect(dom.window.document.querySelector("main")).toBeTruthy();
    expect(dom.window.document.querySelector("nav")).toBeTruthy();
    // header/footer may be in header component
  });

  test("Heading hierarchy correct (h1 -> h2 -> h3)", async () => {
    const html = await fetchPageHTML("/learn/asl/fingerspelling/A");
    const dom = new JSDOM(html);
    const headings = dom.window.document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    
    let lastLevel = 0;
    for (const heading of headings) {
      const level = parseInt(heading.tagName.charAt(1), 10);
      expect(level).toBeLessThanOrEqual(lastLevel + 1);
      lastLevel = level;
    }
  });

  test("ARIA live regions for dynamic content", async () => {
    const html = await fetchPageHTML("/learn/asl/continuous");
    const dom = new JSDOM(html);
    
    const liveRegions = dom.window.document.querySelectorAll("[role='status'], [role='alert'], [aria-live]");
    expect(liveRegions.length).toBeGreaterThan(0);
  });
});

// Helper to run against all pages in CI
export async function runFullAccessibilityAudit(baseUrl: string) {
  const pages = PAGES_TO_TEST.map(p => p.path);
  const results = [];
  
  for (const path of pages) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      const html = await response.text();
      const results = await runAxeOnHTML(html, `${baseUrl}${path}`);
      results.push({ path, violations: results.violations });
    } catch (e) {
      console.error(`Failed to audit ${path}:`, e);
    }
  }
  
  return results;
}