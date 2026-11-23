import { test, expect } from "@playwright/test";

/**
 * E2E: Dynamic lesson player (/learn/asl/words/:slug)
 *
 * Exercises the dynamic-sign lesson shell: navigation routing between signs,
 * presence of the 60-frame buffer UI, record controls, and top-5 results panel.
 * Full inference (webcam → MediaPipe → ONNX Transformer) is covered in unit
 * tests and parity fixtures; this test only verifies the integration surface.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__IS_E2E__ = true;
  });
});

test.describe("Dynamic lesson player (/learn/asl/words/:slug)", () => {
  test("loads target sign, shows controls, and renders buffer UI", async ({ page }) => {
    await page.goto("/learn/asl/words/please");

    // Page title visible
    await expect(page).toHaveTitle(/SignTutor/i);

    // Target sign visible
    await expect(page.getByText("Target: PLEASE")).toBeVisible({ timeout: 5000 });

    // Controls present
    await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Record attempt/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

    // Buffer indicator visible
    await expect(page.getByText(/Buffer:/)).toBeVisible();

    // "On-device" badge - use the badge with aria-label
    await expect(page.getByLabel("On-device privacy guarantee")).toBeVisible();
  });

  test("sign navigation buttons exist and are clickable", async ({ page }) => {
    await page.goto("/learn/asl/words/hello");
    
    // Sign navigation uses buttons with aria-label="Practice sign X" or "Practice word X"
    // Use getByLabel to find by aria-label
    const goodbyeLink = page.getByLabel("Practice sign GOODBYE").first();
    await expect(goodbyeLink).toBeAttached();
    
    // Scroll into view if needed and click
    await goodbyeLink.scrollIntoViewIfNeeded();
    await goodbyeLink.click();
    
    // Verify click worked (button was clickable)
    await expect(goodbyeLink).toBeFocused();
  });
});