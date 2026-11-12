/**
 * Stage 5 acceptance: the owner fills the shelves in the cabinet (a series with a part,
 * a post), assembles a personal card from catalog blocks, publishes it, and the series page
 * «Dark Souls» is generated on the subdomain. Full stack only (E2E_FULL=1).
 */
import { expect, test, type Page } from "@playwright/test";

import { FULL_STACK, SKIP_REASON, registerVerified } from "./helpers";

test.skip(!FULL_STACK, SKIP_REASON);

const PORT = 3100;
const SHOTS = "e2e-shots";
const APP = `http://localhost:${PORT}`;

const visible = (page: Page, label: string) =>
  page.getByLabel(label, { exact: true }).filter({ visible: true }).first();

async function addBlock(page: Page, title: string) {
  await page.getByRole("button", { name: "Добавить блок" }).click();
  const dialog = page.getByRole("dialog", { name: "Библиотека блоков" });
  await dialog.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(dialog).toBeHidden();
}

async function saved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Сохранено" })).toBeVisible({
    timeout: 10_000,
  });
}

async function shots(page: Page, name: string) {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true });
  }
}

test("shelves in the cabinet, a personal card and a series page", async ({ page }) => {
  await registerVerified(page, "personal");

  // A series…
  await page.goto(`${APP}/app/catalog`);
  await page.getByRole("link", { name: "Добавить: игра" }).click();
  await visible(page, "Название").fill("Dark Souls");
  await page.getByRole("switch", { name: "Это серия или цикл" }).click();
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/app\/catalog\/[0-9a-f-]{36}$/);

  // …and its third part, on the shelf with hours, a rating and a criterion.
  await page.goto(`${APP}/app/catalog/new?kind=game`);
  await visible(page, "Название").fill("Dark Souls III");
  await visible(page, "Год").fill("2016");
  await visible(page, "Входит в серию").selectOption({ label: "Dark Souls" });
  await visible(page, "Номер части").fill("III");
  await visible(page, "Моя оценка").selectOption("9");
  await visible(page, "Часы").fill("78");
  const criteria = page.getByRole("region", { name: "Оценка по критериям" });
  await criteria.getByRole("button", { name: "Добавить" }).click();
  await criteria.getByLabel("Критерий").fill("Геймплей");
  await criteria.getByLabel("Балл").fill("10");
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/app\/catalog\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dark Souls III");

  // A review linked to the part.
  await page.goto(`${APP}/app/catalog?kind=posts`);
  await page.getByRole("button", { name: "Новый пост" }).click();
  await visible(page, "Тип").selectOption("review");
  await visible(page, "Заголовок").fill("Dark Souls III закрывает круг");
  await visible(page, "О каком тайтле").selectOption({ label: "Dark Souls III (2016) · Игра" });
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByText("Dark Souls III закрывает круг")).toBeVisible();
  await page.goto(`${APP}/app/catalog?kind=game`);
  await shots(page, "catalog");

  // The personal card in the builder.
  const slug = `p-${Date.now().toString(36)}`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${APP}/app/sites/new?kind=personal`);
  await visible(page, "Название").fill("Саша");
  await visible(page, "Адрес").fill(slug);
  await expect(page.getByText("Адрес свободен")).toBeVisible();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("link", { name: "Конструктор" }).click();
  await expect(page).toHaveURL(/\/editor$/);

  await addBlock(page, "Шапка с обложкой");
  await page
    .getByRole("region", { name: "Шапка с обложкой", exact: true })
    .getByLabel("Заголовок", { exact: true })
    .fill("Саша: игры, книги и сериалы");
  await addBlock(page, "Полка");
  await addBlock(page, "Лента постов");
  await saved(page);

  const preview = page.getByTestId("builder-preview");
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "Саша: игры, книги и сериалы",
  );
  await expect(preview.getByText("Dark Souls III закрывает круг")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/builder-personal-1440.png`, fullPage: true });

  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "опубликовано" })).toBeVisible();

  // Public card: the shelf links to the generated series page.
  await page.goto(`http://${slug}.localhost:${PORT}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Саша: игры, книги и сериалы");
  await shots(page, "public-personal");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('a[href="/games/dark-souls"]').first().click();
  await expect(page).toHaveURL(/\/games\/dark-souls$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dark Souls");
  const parts = page.getByRole("region", { name: "Части и дополнения" });
  await expect(parts.getByRole("link", { name: "Dark Souls III" })).toBeVisible();
  await expect(page.getByText("Dark Souls III закрывает круг")).toBeVisible();
  await shots(page, "public-series");

  // The part has its own page with the criteria.
  await page.goto(`http://${slug}.localhost:${PORT}/games/dark-souls-iii`);
  await expect(page.getByText("Геймплей")).toBeVisible();
  await expect(page.getByText("10 / 10")).toBeVisible();
});
