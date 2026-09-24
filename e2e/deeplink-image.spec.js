const { test, expect, getFixture } = require("./fixtures");

const IMAGE_ID = getFixture("imageId");

// Behaviour changed 2026-09-24 (docs/specs/2026-09-24-entity-url-presentation-model.md):
// a direct load of /art/<id> or /image/<id> used to resolve the image to its
// PARENT CHAPTER and activate it inline there (views/Page/Page.js + the
// ImagePanel). It now renders a standalone artwork page. In-chapter activation
// via requestImageActivation is unchanged — only the deep link differs.
//
// The /image/<id> → /art/<id> canonicalization is kept, so the first test below
// is the same assertion it always was.
test.describe("art deep-link", () => {
  test.skip(IMAGE_ID === "REPLACE_ME", "Set E2E_IMAGE_ID to run");

  test("URL canonicalizes to /art/<id>", async ({ page }) => {
    await page.goto(`/image/${IMAGE_ID}`);
    await expect(page).toHaveURL(new RegExp(`/art/${IMAGE_ID}$`), { timeout: 15_000 });
  });

  test("renders the standalone artwork page, not the in-chapter ImagePanel", async ({ page }) => {
    await page.goto(`/art/${IMAGE_ID}`);
    const img = page.locator("img.art-page-image");
    await expect(img).toBeVisible({ timeout: 15_000 });
    await expect(img).toHaveAttribute("src", new RegExp(`/art/${IMAGE_ID}$`));
    // The old inline activation target must NOT be what answers this URL now.
    await expect(page.locator(`img.panel.i${IMAGE_ID}`)).toHaveCount(0);
  });

  test("links back to the passage the art illustrates", async ({ page }) => {
    await page.goto(`/art/${IMAGE_ID}`);
    await expect(page.locator(".art-page")).toBeVisible({ timeout: 15_000 });
    // Older records can lack a location; only assert the link when one renders.
    const passage = page.getByRole("link", { name: /passage/i });
    if (await passage.count()) {
      await expect(passage).toHaveAttribute("href", /^\/.+/);
    }
  });
});
