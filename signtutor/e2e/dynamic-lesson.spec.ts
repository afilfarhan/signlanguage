import { test, expect } from "@playwright/test";

/**
 * E2E: Dynamic lesson player (/learn/asl/words/:slug)
 *
 * Exercises the dynamic-sign lesson shell: navigation routing between signs,
 * presence of the 45-frame buffer UI, record controls, and top-5 results panel.
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
    await expect(page.getByRole("button", { name: /Record attempt\s*\(1\.5\s*s\)/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();

    // Buffer indicator visible
    await expect(page.getByText(/Buffer:/)).toBeVisible();

    // Privacy badge
    await expect(page.getByLabel("Privacy: all processing stays on your device")).toBeVisible();
  });

  test("sign navigation works", async ({ page }) => {
    await page.goto("/learn/asl/words/hello");
    await expect(page.getByRole("link", { name: "Practice sign GOODBYE" })).toBeVisible();

    await page.getByRole("link", { name: "Practice sign GOODBYE" }).click();
    await expect(page).toHaveURL(/\/learn\/asl\/words\/goodbye/);
  });
});
