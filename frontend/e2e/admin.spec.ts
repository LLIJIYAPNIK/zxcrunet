/**
 * Stage 7: the owner's admin panel. A guest reports a published site, the owner takes it
 * down from the queue and brings it back, blocks the user, and every step is in the log.
 * Full stack only (E2E_FULL=1); the owner is created by CI with the CLI (E2E_OWNER_EMAIL).
 */
import { expect, test, type Page } from "@playwright/test";

import { FULL_STACK, PASSWORD, SKIP_REASON, fillCredentials, registerVerified } from "./helpers";

const OWNER = process.env.E2E_OWNER_EMAIL;
test.skip(!FULL_STACK || !OWNER, `${SKIP_REASON} and E2E_OWNER_EMAIL`);

const PORT = 3100;
const ORIGIN = `http://localhost:${PORT}`;
const SHOTS = "e2e-shots";

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
}

async function shots(page: Page, name: string) {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await noSideScroll(page);
    await page.screenshot({ path: `${SHOTS}/admin-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

test("report → take down → restore → block, all in the audit log", async ({ page, browser }) => {
  // A user with a published site.
  const email = await registerVerified(page, "admin");
  const slug = `e2e-a-${Date.now().toString(36)}`;
  const created = await page.request.post(`${ORIGIN}/api/sites`, {
    data: { kind: "business", slug, title: "Анна" },
    headers: { Origin: ORIGIN },
  });
  const { id: siteId } = (await created.json()) as { id: string };
  await page.request.post(`${ORIGIN}/api/sites/${siteId}/publish`, { headers: { Origin: ORIGIN } });

  // Not the owner: the admin panel does not exist for them.
  const forbidden = await page.goto(`${ORIGIN}/admin`);
  expect(forbidden?.status()).toBe(404);

  // A guest reports the site from its footer.
  const guest = await browser.newPage();
  await guest.goto(`http://${slug}.localhost:${PORT}/`);
  await guest.getByRole("button", { name: "Пожаловаться" }).click();
  const form = guest.getByRole("dialog");
  await form.getByLabel("Мошенничество").check();
  await form.getByLabel("Подробности").fill("Просит перевести деньги");
  await form.getByRole("button", { name: "Отправить" }).click();
  await expect(form.getByText("Спасибо, жалоба отправлена.")).toBeVisible();

  // The owner signs in.
  const owner = await (await browser.newContext()).newPage();
  await owner.goto(`${ORIGIN}/app/login?next=%2Fadmin`);
  await fillCredentials(owner, OWNER!, PASSWORD);
  await owner.getByRole("button", { name: "Войти" }).click();
  await expect(owner.getByRole("heading", { name: "Обзор" })).toBeVisible();
  await expect(owner.getByText("Популярные блоки")).toBeVisible();
  await shots(owner, "overview");

  // The queue: take the site down.
  await owner.getByRole("navigation", { name: "Разделы админки" }).getByText("Жалобы").click();
  const report = owner.getByRole("listitem").filter({ hasText: "Просит перевести деньги" });
  await expect(report).toBeVisible();
  await shots(owner, "reports");
  await report.getByRole("button", { name: "Снять сайт" }).click();
  const decision = owner.getByRole("dialog");
  await decision.getByLabel("Причина").fill("Мошенничество");
  await decision.getByRole("button", { name: "Снять сайт" }).click();
  await expect(report).toHaveCount(0);

  const down = await guest.goto(`http://${slug}.localhost:${PORT}/`);
  expect(down?.status()).toBe(403);
  await expect(guest.getByText("Сайт недоступен")).toBeVisible();

  // The site card: the reason is shown, then the site comes back.
  await owner.goto(`${ORIGIN}/admin/sites/${siteId}`);
  await expect(owner.getByText("Снята: Мошенничество")).toBeVisible();
  await shots(owner, "site");
  await owner.getByRole("button", { name: "Вернуть" }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Вернуть" }).click();
  await expect(owner.getByRole("button", { name: "Снять с публикации" })).toBeVisible();
  const back = await guest.goto(`http://${slug}.localhost:${PORT}/`);
  expect(back?.status()).toBe(200);

  // Users: find and block.
  await owner.goto(`${ORIGIN}/admin/users`);
  await owner.getByRole("searchbox").fill(email);
  await owner.getByRole("link", { name: email }).click();
  await expect(owner.getByRole("heading", { name: email })).toBeVisible();
  await owner.getByRole("button", { name: "Заблокировать" }).click();
  await owner.getByRole("dialog").getByLabel("Причина").fill("Спам");
  await owner.getByRole("dialog").getByRole("button", { name: "Заблокировать" }).click();
  await expect(owner.getByRole("button", { name: "Разблокировать" })).toBeVisible();
  await shots(owner, "user");

  // The blocked user is signed out at once.
  await page.goto(`${ORIGIN}/app`);
  await expect(page).toHaveURL(/\/app\/login/);

  // The audit log has every step.
  await owner.goto(`${ORIGIN}/admin/audit`);
  for (const action of [
    "Заблокировал пользователя",
    "Вернул визитку",
    "Снял визитку с публикации",
    "Закрыл жалобу снятием сайта",
  ]) {
    await expect(owner.getByText(action).first()).toBeVisible();
  }
  await shots(owner, "audit");
});
