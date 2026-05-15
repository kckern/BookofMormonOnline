const { test, expect } = require("./fixtures");

test("/commentary/999999999 shows not-found UI", async ({ page }) => {
  await page.goto("/commentary/999999999");
  await expect(page.getByText(/Not found|commentary\/999999999/i)).toBeVisible({ timeout: 15_000 });
});

test("/image/999999999 shows not-found UI", async ({ page }) => {
  await page.goto("/image/999999999");
  await expect(page.getByText(/Not found|image\/999999999/i)).toBeVisible({ timeout: 15_000 });
});
