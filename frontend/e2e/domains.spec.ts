/**
 * Stage 6: connecting a custom domain in the cabinet. Real DNS is asked about a name under
 * the reserved `.example` zone, so the records are never there: the page shows what to add.
 * Full stack only (E2E_FULL=1).
 */
import { expect, test } from "@playwright/test";

import { FULL_STACK, SKIP_REASON, registerVerified } from "./helpers";

test.skip(!FULL_STACK, SKIP_REASON);

const PORT = 3100;
const ORIGIN = `http://localhost:${PORT}`;
const SHOTS = "e2e-shots";

test("add a domain, see the records to create, check, remove", async ({ page }) => {
  await registerVerified(page, "domain");
  const slug = `e2e-d-${Date.now().toString(36)}`;
  const created = await page.request.post(`${ORIGIN}/api/sites`, {
    data: { kind: "business", slug, title: "Анна" },
    headers: { Origin: ORIGIN },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const host = `${slug}.example`;

  await page.goto(`${ORIGIN}/app/sites/${id}`);
  const section = page.getByRole("heading", { name: "Свои домены" }).locator("../..");
  await expect(section.getByText("Своих доменов пока нет.")).toBeVisible();

  // The service's own addresses are refused.
  await section.getByLabel("Домен").fill(`${slug}.localhost`);
  await section.getByRole("button", { name: "Подключить" }).click();
  await expect(section.getByText(/Этот адрес подключить нельзя/)).toBeVisible();

  await section.getByLabel("Домен").fill(`https://${host.toUpperCase()}/`);
  await section.getByRole("button", { name: "Подключить" }).click();
  const item = section.getByRole("listitem").filter({ hasText: host }).first();
  await expect(item.getByText("Ждём записи")).toBeVisible();
  await expect(item.getByText(`_zxc-verify.${host}`, { exact: true })).toBeVisible();
  await expect(item.getByText(/^zxc-[0-9a-f]{32}$/)).toBeVisible();
  await expect(section.getByText("1 из 3 по тарифу")).toBeVisible();

  await item.getByRole("button", { name: "Проверить сейчас" }).click();
  await expect(item.getByText(`Не нашли TXT-запись _zxc-verify.${host}.`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(item.getByText(/^Проверяли/)).toBeVisible();

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await section.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await section.screenshot({ path: `${SHOTS}/domains-${width}.png` });
  }

  await item.getByRole("button", { name: "Отключить" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Отключить" }).click();
  await expect(section.getByText("Своих доменов пока нет.")).toBeVisible();
});
