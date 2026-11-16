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
  // dnd-kit measures positions and animates between key presses: give it a beat.
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
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

test("gothic style, fonts and a section background reach the public card", async ({ page }) => {
  await registerVerified(page, "gothic");
  const slug = `g-${Date.now().toString(36)}`;
  await page.goto(`${APP}/app/sites/new`);
  await page.getByLabel("Название").filter({ visible: true }).fill("Готика");
  await page.getByLabel("Адрес").filter({ visible: true }).fill(slug);
  await expect(page.getByText("Адрес свободен")).toBeVisible();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("link", { name: "Конструктор" }).click();

  await addBlock(page, "Шапка");
  await field(page, "Шапка", "Заголовок").fill("Тень и пламя");
  const section = page.getByRole("region", { name: "Шапка", exact: true });
  await section
    .getByRole("radiogroup", { name: "Фон" })
    .getByRole("radio", { name: "Узор" })
    .click();
  await section
    .getByRole("radiogroup", { name: "Узор фона" })
    .getByRole("radio", { name: "Арки" })
    .click();
  await section.getByRole("radio", { name: "Орнамент" }).click();
  await saved(page);

  await page.getByRole("button", { name: "Дизайн", exact: true }).click();
  await page.getByRole("radio", { name: "Готика", exact: true }).click();
  await page.getByRole("button", { name: /Как в стиле: Cormorant/ }).click();
  await page.getByRole("radio", { name: "Ruslan Display", exact: true }).click();
  await saved(page);

  const preview = page.getByTestId("builder-preview");
  await expect(preview.locator("[data-style='gothic']")).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${SHOTS}/builder-design-1440.png`, fullPage: true });

  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "опубликовано" })).toBeVisible();

  await page.goto(`http://${slug}.localhost:${PORT}`);
  const root = page.locator("[data-site]");
  await expect(root).toHaveAttribute("data-style", "gothic");
  await expect(root).toHaveAttribute("style", /--site-display: ?var\(--ff-ruslan\)/);
  await expect(
    page.locator("[data-section][data-background='pattern'] [data-ornament]"),
  ).toHaveCount(1);
  await expect(page.locator('[data-pattern="arches"]')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/public-gothic-1440.png`, fullPage: true });
});

/** The smallest MP4 the server accepts (an `ftyp` box with a browser brand). */
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypisom"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("isomavc1"),
  Buffer.from([0, 0, 0, 16]),
  Buffer.from("mdat"),
  Buffer.alloc(8),
]);

test("video by link, own clip and a carousel reach the public card", async ({ page }) => {
  await registerVerified(page, "media");
  const slug = `m-${Date.now().toString(36)}`;
  await page.goto(`${APP}/app/sites/new`);
  await page.getByLabel("Название").filter({ visible: true }).fill("Медиа");
  await page.getByLabel("Адрес").filter({ visible: true }).fill(slug);
  await expect(page.getByText("Адрес свободен")).toBeVisible();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("link", { name: "Конструктор" }).click();

  // A YouTube link: only the id is kept, the player comes from youtube-nocookie.
  await addBlock(page, "Видео");
  await field(page, "Видео", "Заголовок").fill("Мой доклад");
  await field(page, "Видео", "Ссылка на видео").fill("https://youtu.be/dQw4w9WgXcQ?si=share");
  await expect(page.getByText("YouTube: видео найдено")).toBeVisible();
  await saved(page);

  // An uploaded clip as a silent loop.
  await addBlock(page, "Видео");
  const clip = page.getByRole("region", { name: "Видео", exact: true });
  await clip.getByRole("button", { name: "Свой файл" }).click();
  await clip.locator('input[type="file"]').first().setInputFiles({
    name: "loop.mp4",
    mimeType: "video/mp4",
    buffer: MP4,
  });
  await expect(clip.locator('video[src$=".mp4"]')).toBeVisible();
  await clip.getByRole("button", { name: "Беззвучная петля" }).click();
  await saved(page);

  // A carousel of two pictures running as a strip.
  await addBlock(page, "Карусель");
  const strip = page.getByRole("region", { name: "Карусель", exact: true });
  await strip.getByRole("button", { name: "Бегущая лента" }).click();
  for (const name of ["a.png", "b.png"]) {
    await strip.getByRole("button", { name: "Добавить", exact: true }).click();
    await strip
      .locator('input[type="file"]')
      .last()
      .setInputFiles({ name, mimeType: "image/png", buffer: PNG });
    await expect(strip.locator('img[src^="/media/"]')).toHaveCount(name === "a.png" ? 1 : 2);
  }
  await saved(page);

  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "опубликовано" })).toBeVisible();

  const response = await page.goto(`http://${slug}.localhost:${PORT}`);
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-src https://www.youtube-nocookie.com",
  );
  await expect(page.getByTitle("Мой доклад")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
  );
  await expect(page.locator('video[loop][src$=".mp4"]')).toHaveCount(1);
  await expect(page.locator("[data-marquee] .marquee-track > div")).toHaveCount(2);
  await page.screenshot({ path: `${SHOTS}/public-media-1440.png`, fullPage: true });
});

test("a collage and a fullscreen hero reach the public card", async ({ page }) => {
  await registerVerified(page, "collage");
  const slug = `c-${Date.now().toString(36)}`;
  await page.goto(`${APP}/app/sites/new`);
  await page.getByLabel("Название").filter({ visible: true }).fill("Коллаж");
  await page.getByLabel("Адрес").filter({ visible: true }).fill(slug);
  await expect(page.getByText("Адрес свободен")).toBeVisible();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("link", { name: "Конструктор" }).click();

  // Hero over a full-screen picture.
  await addBlock(page, "Шапка");
  const hero = page.getByRole("region", { name: "Шапка", exact: true });
  await field(page, "Шапка", "Заголовок").fill("Тень и пламя");
  await hero.getByRole("button", { name: "Во весь экран" }).click();
  await hero.locator('input[type="file"]').first().setInputFiles({
    name: "night.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(hero.locator('img[src^="/media/"]')).toBeVisible();
  await saved(page);

  // Collage: a heading tile and a picture, moved one column right from the keyboard.
  await addBlock(page, "Коллаж");
  const collage = page.getByRole("region", { name: "Коллаж", exact: true });
  await collage.getByRole("button", { name: "Текст", exact: true }).click();
  await field(page, "Коллаж", "Текст").fill("Ночные работы");
  await collage.getByRole("button", { name: "Картинка", exact: true }).click();
  await collage.locator('input[type="file"]').last().setInputFiles({
    name: "moon.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(
    collage.getByTestId("collage-canvas").locator("[data-tile-id] span[style]"),
  ).toHaveCount(1);
  const picture = collage.getByRole("button", { name: /^Картинка: колонка 1, ряд 3/ });
  await picture.focus();
  await page.keyboard.press("ArrowRight");
  await expect(collage.getByRole("button", { name: /^Картинка: колонка 2, ряд 3/ })).toBeVisible();
  await saved(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${SHOTS}/builder-collage-1440.png`, fullPage: true });

  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "опубликовано" })).toBeVisible();

  await page.goto(`http://${slug}.localhost:${PORT}`);
  await expect(page.locator('[data-hero="fullscreen"] img[src^="/media/"]')).toHaveCount(1);
  await expect(page.locator("[data-collage] [data-tile]")).toHaveCount(2);
  await expect(page.getByText("Ночные работы")).toBeVisible();
  await expect(page.locator('[data-tile="image"]')).toHaveAttribute("style", /--dx: ?2/);
  await page.screenshot({ path: `${SHOTS}/public-collage-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: `${SHOTS}/public-collage-390.png`, fullPage: true });
});
