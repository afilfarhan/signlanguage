import { test, expect } from "@playwright/test";

/**
 * E2E: Static lesson player (fingerspelling)
 *
 * Since the webcam / MediaPipe / ONNX stack is heavily browser-dependent,
 * we run a *partial* happy path that exercises the UI shell and asserts
 * that the lesson loads, the target is visible, and the camera controls
 * are present.
 *
 * Full inference is tested in unit tests and parity fixtures; here we
 * verify the integration surface.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Mark that we are in a test so the player can skip camera/MPCam setup
    // and render in a mock-friendly mode.
    (window as any).__IS_E2E__ = true;
  });
});

test("loads target letter, page title is correct", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling/B", { waitUntil: "networkidle" });

    await expect(page).toHaveTitle(/SignTutor/i);
    await expect(page.getByText("Target: B")).toBeVisible({ timeout: 5000 });
  });

test("shows controls and per-finger panel", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling/B", { waitUntil: "networkidle" });

    await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
    await expect(page.getByLabel(/Per-finger handshape match/i)).toBeVisible();
    await expect(page.getByLabel("Privacy: all processing stays on your device")).toBeVisible();
  });

test("letter navigation links work", async ({ page }) => {
    await page.goto("/learn/asl/fingerspelling/A", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "Practice letter B" })).toBeVisible();

    await page.getByRole("link", { name: "Practice letter B" }).click();
    await expect(page).toHaveURL(/.*\/learn\/asl\/fingerspelling\/[Bb]/);
  });
