import { z } from "zod";

import { ru } from "@/i18n/ru";

const v = ru.auth.validation;

export const emailField = z.string().trim().min(1, v.email).max(254, v.email).email(v.email);

export const passwordField = z.string().min(8, v.passwordShort).max(128, v.passwordLong);

export const credentialsSchema = z.object({ email: emailField, password: passwordField });
export type CredentialsForm = z.infer<typeof credentialsSchema>;

/** Login does not re-check password rules: the server decides, and the error stays generic. */
export const loginSchema = z.object({ email: emailField, password: z.string().min(1).max(128) });
export type LoginForm = z.infer<typeof loginSchema>;

export const emailSchema = z.object({ email: emailField });
export type EmailForm = z.infer<typeof emailSchema>;

export const newPasswordSchema = z.object({ password: passwordField });
export type NewPasswordForm = z.infer<typeof newPasswordSchema>;

type ErrorCode = keyof typeof ru.auth.errors;

export function errorText(code: string): string {
  return code in ru.auth.errors ? ru.auth.errors[code as ErrorCode] : ru.auth.errors.unknown;
}
