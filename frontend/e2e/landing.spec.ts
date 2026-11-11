import { expect, test } from "@playwright/test";

for (const width of [390, 768, 1440]) {
  test(`landing has no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("светится");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("landing shows the zxcrunet label", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("zxcrunet");
  await expect(page.getByRole("banner").getByText("zxcrunet")).toBeVisible();
});

test("picking a neon repaints the page", async ({ page }) => {
  await page.goto("/");
  const scope = page.locator("main").locator("..");

  await page.getByRole("radio", { name: "Неон-роза" }).click();

  await expect(scope).toHaveAttribute("style", /--accent:\s*#ff4f8b/);
  await expect(page.getByRole("radio", { name: "Неон-роза" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("component showcase renders and is not indexed", async ({ page }) => {
  await page.goto("/ui");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Компоненты zxcrunet");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
