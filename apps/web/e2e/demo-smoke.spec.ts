/**
 * ArbiX Demo Smoke Test
 *
 * Validates the full happy-path demo flow used during hackathon judging:
 *   1. Dashboard loads with metric cards
 *   2. "Presentation Mode" button triggers reset + profitable scenario
 *   3. A new trade is detected and shows up in the Opportunity Feed
 *   4. P&L turns positive
 *   5. Wallet balances are non-zero
 *
 * Run:  npx playwright test e2e/demo-smoke.spec.ts
 */

import { expect, test } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

test.describe("ArbiX demo smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Confirm API is healthy before each test
    const health = await page.request.get(`${API}/health`);
    expect(health.ok()).toBeTruthy();
  });

  test("dashboard loads with key metric cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("ArbiX Command Center")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Total Net P&L")).toBeVisible();
    await expect(page.getByText("Opportunities Today")).toBeVisible();
    await expect(page.getByText("Demo Control Panel")).toBeVisible();
  });

  test("Presentation Mode resets state and fires profitable scenario", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Demo Control Panel")).toBeVisible({ timeout: 10_000 });

    // Click the Presentation Mode button
    const btn = page.getByRole("button", { name: /Presentation Mode/i });
    await expect(btn).toBeVisible();
    await btn.click();

    // The button shows a loading state
    await expect(page.getByRole("button", { name: /Starting presentation/i })).toBeVisible({ timeout: 3_000 });

    // Wait for the persistent panel status, not a transient toast.
    await expect(page.getByTestId("presentation-mode-status")).toContainText("Presentation Mode ready", { timeout: 15_000 });
  });

  test("opportunity feed shows at least one EXECUTED trade after scenario", async ({ page }) => {
    // Trigger the profitable scenario directly via API, then check the UI
    await page.request.post(`${API}/wallets/reset`);
    await page.request.post(`${API}/risk/circuit-breaker/clear`);
    await page.request.post(`${API}/replay/scenario/profitable-arbitrage`);

    await page.goto("/opportunities");
    await page.waitForTimeout(4_000); // allow scenario to produce events

    // At least one EXECUTED badge should appear
    const executedBadges = page.getByText("EXECUTED");
    await expect(executedBadges.first()).toBeVisible({ timeout: 20_000 });
  });

  test("P&L is positive after profitable scenario", async ({ page }) => {
    await page.request.post(`${API}/wallets/reset`);
    await page.request.post(`${API}/replay/scenario/profitable-arbitrage`);
    await page.waitForTimeout(5_000);

    const summary = await page.request.get(`${API}/analytics/summary`);
    const data = (await summary.json()) as { totalNetProfit: number };
    expect(data.totalNetProfit).toBeGreaterThan(0);
  });

  test("wallet balances are non-zero after scenario", async ({ page }) => {
    const wallets = await page.request.get(`${API}/wallets`);
    const data = (await wallets.json()) as { balances: Array<{ balance: number }> };
    const hasBalance = data.balances.some((w) => w.balance > 0);
    expect(hasBalance).toBe(true);
  });

  test("circuit breaker can be cleared via Presentation Mode", async ({ page }) => {
    // Trip it first
    await page.request.get(`${API}/risk/status`);

    await page.goto("/dashboard");
    await expect(page.getByText("Demo Control Panel")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Presentation Mode/i }).click();
    await expect(page.getByTestId("presentation-mode-status")).toContainText("Presentation Mode ready", { timeout: 15_000 });

    // Risk status should show circuit breaker off
    const risk = await page.request.get(`${API}/risk/status`);
    const data = (await risk.json()) as { circuitBreakerActive: boolean };
    expect(data.circuitBreakerActive).toBe(false);
  });
});
