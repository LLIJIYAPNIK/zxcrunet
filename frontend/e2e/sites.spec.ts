/**
 * Stage 3 acceptance: a created and published site opens at `<slug>.localhost`.
 * Full stack only (E2E_FULL=1); the CI job sets ZXC_SITES_DOMAIN=localhost and
 * NEXT_PUBLIC_SITE_URL_TEMPLATE=http://{host}:3100.
 */
import { expect, test } from "@playwright/test";

import { FULL_STACK, SKIP_REASON, registerVerified } from "./helpers";

test.skip(!FULL_STACK, SKIP_REASON);

const PORT = 3100;
const siteOrigin = (slug: string) => `http://${slug}.localhost:${PORT}`;

test("create → publish → open on the subdomain → unpublish", async ({ page }) => {
  await registerVerified(page, "site");
  const slug = `e2e-${Date.now().toString(36)}`;

  // Draft addresses are not public yet: a real 404 from the proxy.
  const before = await page.goto(siteOrigin(slug));
  expect(before?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Здесь пока нет визитки" })).toBeVisible();

  // Create from the cabinet.
  await page.goto(`http://localhost:${PORT}/app`);
  await page.getByRole("link", { name: "Создать визитку" }).first().click();
  await expect(page).toHaveURL(/\/app\/sites\/new/);
  await page.getByRole("button", { name: "Личное" }).click();
  await page.getByLabel("Название").filter({ visible: true }).fill("Саша: игры и книги");
  await page.getByLabel("Адрес").filter({ visible: true }).fill(slug);
  await expect(page.getByText("Адрес свободен")).toBeVisible();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/sites\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Черновик", { exact: true })).toBeVisible();

  // The draft is still private.
  const draft = await page.request.get(`http://localhost:${PORT}/api/public/sites/resolve`, {
    params: { host: `${slug}.localhost` },
  });
  expect(draft.status()).toBe(404);

  // Publish and open the live site.
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByText("Опубликована", { exact: true })).toBeVisible();
  const live = await page.goto(siteOrigin(slug));
  expect(live?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Саша: игры и книги");
  await expect(page.getByText("Визитка пока пустая")).toBeVisible();
  await expect(page.getByRole("link", { name: /Сделано на/ })).toBeVisible();

  // The session cookie is host-only: the user's subdomain never receives it.
  expect(await page.context().cookies(siteOrigin(slug))).toEqual([]);

  // An unknown page inside a published site.
  await page.goto(`${siteOrigin(slug)}/nope`);
  await expect(page.getByText("Такой страницы нет")).toBeVisible();

  // Unpublish: the address answers 404 again.
  await page.goto(`http://localhost:${PORT}/app`);
  await page.getByRole("link", { name: "Настройки" }).first().click();
  await page.getByRole("button", { name: "Снять с публикации" }).click();
  await expect(page.getByText("Черновик", { exact: true })).toBeVisible();
  const after = await page.goto(siteOrigin(slug));
  expect(after?.status()).toBe(404);
});

test("taken and reserved addresses are flagged while typing", async ({ page }) => {
  await registerVerified(page, "slug");
  await page.goto(`http://localhost:${PORT}/app/sites/new`);

  await page.getByLabel("Адрес").filter({ visible: true }).fill("admin");

  await expect(page.getByText("Этот адрес зарезервирован")).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать", exact: true })).toBeDisabled();
});
