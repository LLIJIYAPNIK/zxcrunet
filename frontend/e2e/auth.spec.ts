/**
 * Full account journey against the real stack: FastAPI, Taskiq worker, Postgres, Redis, Mailpit.
 * Runs when E2E_FULL=1 (the CI e2e job). Emails are read through the Mailpit API.
 */
import { expect, test } from "@playwright/test";

import { FULL_STACK, PASSWORD, SKIP_REASON, fillCredentials, linkFromEmail } from "./helpers";

test.skip(!FULL_STACK, SKIP_REASON);

test("register → verify email → logout → login → reset password", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  // Registration signs the user in and asks to confirm the email.
  await page.goto("/app/register");
  await fillCredentials(page, email, PASSWORD);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(email);
  await expect(page.getByText(/Подтвердите почту/)).toBeVisible();

  // The verification link from Mailpit confirms the address.
  await page.goto(await linkFromEmail(email, "Подтвердите почту"));
  await expect(page.getByText("Почта подтверждена.")).toBeVisible();
  await page.getByRole("link", { name: "Перейти в кабинет" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(email);
  await expect(page.getByText(/Подтвердите почту/)).toHaveCount(0);

  // Logout protects the cabinet again.
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/app\/login/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app\/login\?next=%2Fapp/);

  // Wrong password shows a generic error; the right one signs in and returns to `next`.
  await fillCredentials(page, email, "wrong password!!");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Неверная почта или пароль.");
  await fillCredentials(page, email, PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Password reset by email, then sign in with the new password.
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/app\/login$/);
  await page.getByRole("link", { name: "Забыли пароль?" }).click();
  await expect(page).toHaveURL(/\/app\/forgot-password$/);
  await page.getByLabel("Почта").filter({ visible: true }).fill(email);
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("письмо уже в пути");

  await page.goto(await linkFromEmail(email, "Сброс пароля"));
  await page.getByLabel("Новый пароль").filter({ visible: true }).fill("brand new password");
  await page.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(page.getByText("Пароль изменён.", { exact: false })).toBeVisible();

  await page.goto("/app/login");
  await fillCredentials(page, email, "brand new password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("duplicate registration suggests signing in", async ({ page }) => {
  const email = `e2e-dup-${Date.now()}@example.com`;
  await page.goto("/app/register");
  await fillCredentials(page, email, PASSWORD);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.context().clearCookies();
  await page.goto("/app/register");
  await fillCredentials(page, email, PASSWORD);
  await page.getByRole("button", { name: "Создать аккаунт" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toContainText("уже зарегистрирована");
});
