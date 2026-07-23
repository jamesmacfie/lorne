import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public shell remains readable from 320px through tablet", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: width === 768 ? 900 : 780 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("One good question");
    await expect(page.getByRole("group", { name: "Account action" }).getByRole("button", { name: "Sign in" })).toBeEnabled();
    await expect(page.getByLabel("Username")).toBeVisible();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  }
});

test("account creation exposes invite-gated username and password fields", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByLabel("Invite email")).toBeVisible();
  await expect(page.getByLabel("Invite code")).toBeVisible();
  const username = page.getByLabel("Username");
  await expect(username).toHaveAttribute("autocomplete", "username");
  await username.fill("learner@example.com");
  expect(await username.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true);
  await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "new-password");
});

test("public shell has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "networkidle" });
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
  expect(blocking, blocking.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("service worker serves a cached relaunch while offline", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("One good question");
  await context.setOffline(false);
});
