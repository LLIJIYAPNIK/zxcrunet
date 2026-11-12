/** Personal card samples (no backend): no horizontal scroll, screenshots for review. */
import { expect, test } from "@playwright/test";

const PAGES = [
  ["personal", "/ui/sample/personal", "Саша Орлов: игры, книги и сериалы"],
  ["games", "/ui/sample/personal/games", "Игры"],
  ["dark-souls", "/ui/sample/personal/dark-souls", "Dark Souls"],
] as const;

for (const [name, path, heading] of PAGES) {
  for (const width of [390, 768, 1440]) {
    test(`${name} sample fits ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);

      await expect(page.getByRole("heading", { level: name === "games" ? 2 : 1 })).toHaveText(
        heading,
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      await page.screenshot({ path: `e2e-shots/sample-${name}-${width}.png`, fullPage: true });
    });
  }
}

test("a guest's shelf filter is remembered", async ({ page }) => {
  await page.goto("/ui/sample/personal/games");
  const filters = page.getByRole("group", { name: "Статус" });
  await filters.getByRole("button", { name: "Брошено" }).click();
  await expect(page.getByText("Mortal Kombat 1").first()).toBeVisible();
  await expect(page.getByText("Elden Ring")).toHaveCount(0);

  await page.reload();
  await expect(filters.getByRole("button", { name: "Брошено" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("spoilers are blurred until asked", async ({ page }) => {
  await page.goto("/ui/sample/personal/dark-souls");
  const button = page.getByRole("button", { name: "Показать спойлеры" });
  await button.click();
  await expect(page.getByRole("button", { name: "Скрыть спойлеры" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
