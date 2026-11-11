/** Shared steps for the full-stack e2e tests (E2E_FULL=1). */
import { expect, type Page } from "@playwright/test";

export const FULL_STACK = process.env.E2E_FULL === "1";
export const SKIP_REASON = "needs backend, worker and Mailpit (E2E_FULL=1)";

export const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";
export const PASSWORD = "correct horse battery";

type MailpitSummary = { ID: string; Subject: string };

/** Waits for a new email to `to` with a subject containing `subject`, returns its link. */
export async function linkFromEmail(to: string, subject: string): Promise<string> {
  const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
  let message: MailpitSummary | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${query}`);
        const body = (await res.json()) as { messages: MailpitSummary[] };
        message = body.messages[0];
        return message?.ID ?? null;
      },
      { timeout: 20_000, message: `email "${subject}" to ${to}` },
    )
    .not.toBeNull();
  const res = await fetch(`${MAILPIT}/api/v1/message/${message!.ID}`);
  const { Text } = (await res.json()) as { Text: string };
  const link = Text.match(/https?:\/\/\S+token=\S+/)?.[0];
  expect(link, "link in the email").toBeTruthy();
  return link!;
}

/*
 * Next.js 16 keeps the previous route mounted but hidden (<Activity>) after client navigation,
 * and getByLabel does not skip hidden elements, so form fields are filtered to visible ones.
 */
export async function fillCredentials(page: Page, email: string, password: string) {
  await page.getByLabel("Почта").filter({ visible: true }).fill(email);
  await page
    .getByLabel(/^(Пароль|Новый пароль)$/)
    .filter({ visible: true })
    .fill(password);
}

/** Registers a fresh user and confirms the email through Mailpit. Returns the email. */
export async function registerVerified(page: Page, prefix = "e2e"): Promise<string> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/app/register");
  await fillCredentials(page, email, PASSWORD);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto(await linkFromEmail(email, "Подтвердите почту"));
  await expect(page.getByText("Почта подтверждена.")).toBeVisible();
  return email;
}
