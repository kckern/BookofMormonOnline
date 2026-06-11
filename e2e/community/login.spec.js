/**
 * Login + /user study-progress.
 *
 * Drives the REAL SignIn.js form with the regression account (no token
 * injection) and confirms the authenticated /user view loads the user's
 * identity, the study-progress box, and the date-started / study-time /
 * study-sessions stat widgets.
 */
const { test, expect, cfg } = require('./lib/fixtures');
const { signIn, isLoggedIn } = require('./lib/auth');

test.describe('login + study progress', () => {
  test('logs in through the SignIn form (no token injection)', async ({ page }) => {
    // Logged-out /user shows the password-login form.
    await page.goto(`${cfg.baseUrl}/user`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    const token = await signIn(page);
    expect(token, 'a session token is persisted on success').toBeTruthy();
    expect(await isLoggedIn(page)).toBe(true);

    // The login form is gone once authenticated.
    await expect(page.locator('#username')).toHaveCount(0);
  });

  test('/user loads the study-progress box for the logged-in user', async ({ authedPage: page }) => {
    // Navigate to /user fresh (as a real user does) so the session-restore boot
    // fully populates the profile — the in-place post-login render lags.
    await page.goto(`${cfg.baseUrl}/user`, { waitUntil: 'domcontentloaded' });
    const box = page.locator('.ProgressBox').first();
    await expect(box).toBeVisible();

    // The box is titled for the real account, not the logged-out "Guest".
    await expect(box).toContainText(/Study progress for/i);
    await expect(box).not.toContainText('Guest');
    if (cfg.displayName) await expect(box).toContainText(cfg.displayName);

    // % Completed / % Started render (value may be 0 for a fresh account).
    await expect(box).toContainText(/% Completed/i);
    await expect(box).toContainText(/% Started/i);
  });

  test('/user shows the date-started, study-time and study-sessions stat widgets — and they RESOLVE', async ({ authedPage: page }) => {
    await page.goto(`${cfg.baseUrl}/user`, { waitUntil: 'domcontentloaded' });
    const stats = page.locator('.quickstats');
    await expect(stats).toBeVisible();

    // All three stat widgets render with their labels.
    const labels = stats.locator('.stat_label');
    await expect(labels).toHaveCount(3);
    const text = (await stats.innerText()).toLowerCase();
    expect(text).toMatch(/started/);
    expect(text).toMatch(/time/);
    expect(text).toMatch(/sessions/);

    // HARD assertion: the widgets must RESOLVE, not spin forever. studylog
    // resolves to the user's summary (or, for a no-log account, first=now /
    // duration=0 / count=0) — either way no loading spinner should remain.
    // (A regression test for the missing-studylog-resolver bug, which made these
    // spin indefinitely.)
    await expect(stats.locator('img.loading')).toHaveCount(0, { timeout: 20_000 });
  });
});
