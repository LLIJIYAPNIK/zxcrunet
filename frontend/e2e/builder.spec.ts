/**
 * Stage 4 acceptance: a business card is assembled in the builder from library blocks,
 * edited, reordered, partly hidden, published, and looks right on the subdomain.
 * Full stack only (E2E_FULL=1).
 */
import { expect, test, type Page } from "@playwright/test";

import { FULL_STACK, SKIP_REASON, registerVerified } from "./helpers";

test.skip(!FULL_STACK, SKIP_REASON);

const PORT = 3100;
const SHOTS = "e2e-shots";
const APP = `http://localhost:${PORT}`;

/** 1×1 PNG (a real image: the server re-encodes it to WebP). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function addBlock(page: Page, title: string) {
  await page.getByRole("button", { name: "Добавить блок" }).click();
  const dialog = page.getByRole("dialog", { name: "Библиотека блоков" });
  await dialog.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await expect(dialog).toBeHidden();
}

/** A form field inside the editor panel of `block` (the panel is a region named after it). */
const field = (page: Page, block: string, label: string) =>
  page
    .getByRole("region", { name: block, exact: true })
    .getByLabel(label, { exact: true })
    .filter({ visible: true })
    .first();

async function saved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Сохранено" })).toBeVisible({
    timeout: 10_000,
  });
}

test("assemble, reorder, hide, publish a business card", async ({ page }) => {
  await registerVerified(page, "builder");
  const slug = `b-${Date.now().toString(36)}`;

  await page.goto(`${APP}/app/sites/new`);
  await page.getByLabel("Название").filter({ visible: true }).fill("Анна Волкова");
  await page.getByLabel("Адрес").filter({ visible: true }).fill(slug);
  await expect(page.getByText("Адрес свободен")).toBeVisible();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("link", { name: "Конструктор" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByText("На странице пока нет блоков")).toBeVisible();

  // Hero: title, role and an uploaded photo.
  await addBlock(page, "Шапка");
  await field(page, "Шапка", "Заголовок").fill("Анна Волкова, продуктовый дизайнер");
  await field(page, "Шапка", "Роль на карточке").fill("Product / UX дизайнер");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "me.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(
    page.getByRole("region", { name: "Шапка", exact: true }).locator('img[src^="/media/"]'),
  ).toBeVisible();
  await saved(page);

  // Facts, then contacts; facts get hidden.
  await addBlock(page, "Цифры");
  await addBlock(page, "Контакты");
  await field(page, "Контакты", "Значение").fill("@anna_design");
  await saved(page);
  await page.getByRole("switch", { name: "Показывать блок «Цифры»" }).click();
  await saved(page);

  // Keyboard reorder: move «Контакты» above «Цифры».
  const grip = page.getByRole("button", { name: /Перетащите.*Контакты/ });
  await grip.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect(page.getByRole("list", { name: "Блоки" }).locator("li b")).toHaveText([
    "Шапка",
    "Контакты",
    "Цифры",
  ]);
  await saved(page);

  // Live preview reflects the draft; then mobile preview.
  const preview = page.getByTestId("builder-preview");
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(
    "Анна Волкова, продуктовый дизайнер",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${SHOTS}/builder-1440.png`, fullPage: true });
  await page.getByRole("button", { name: "Телефон" }).click();
  await page.screenshot({ path: `${SHOTS}/builder-mobile-preview.png`, fullPage: true });

  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "опубликовано" })).toBeVisible();

  // Public site: hero with photo, contacts, no hidden facts.
  await page.goto(`http://${slug}.localhost:${PORT}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Анна Волкова, продуктовый дизайнер",
  );
  await expect(page.locator('img[src^="/media/"]')).toBeVisible();
  await expect(page.getByRole("link", { name: /@anna_design/ })).toHaveAttribute(
    "href",
    "https://t.me/anna_design",
  );
  await expect(page.getByLabel("Факты")).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/public-business-1440.png`, fullPage: true });
});

test("invalid block pauses autosave until fixed", async ({ page }) => {
  await registerVerified(page, "invalid");
  const slug = `i-${Date.now().toString(36)}`;
  await page.goto(`${APP}/app/sites/new`);
  await page.getByLabel("Название").filter({ visible: true }).fill("Тест");
  await page.getByLabel("Адрес").filter({ visible: true }).fill(slug);
  await expect(page.getByText("Адрес свободен")).toBeVisible();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("link", { name: "Конструктор" }).click();

  await addBlock(page, "Шапка");
  await field(page, "Шапка", "Заголовок").fill("");

  await expect(page.getByText(/Исправьте блок «Шапка»/)).toBeVisible();
  await field(page, "Шапка", "Заголовок").fill("Снова есть заголовок");
  await saved(page);
});
