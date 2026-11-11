"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { SERVICE_DOMAIN } from "@/config/site";
import { ru } from "@/i18n/ru";
import { apiPost } from "@/lib/api/client";
import { safeNext } from "@/lib/auth/next";
import {
  credentialsSchema,
  emailSchema,
  errorText,
  loginSchema,
  newPasswordSchema,
  type CredentialsForm,
  type EmailForm,
  type LoginForm as LoginValues,
  type NewPasswordForm,
} from "@/lib/auth/schemas";

import { FormMessage } from "./AuthShell";

const t = ru.auth;

function EmailField({ error, ...register }: { error?: string } & UseFormRegisterReturn) {
  return (
    <Field label={t.email} error={error}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          {...register}
        />
      )}
    </Field>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await apiPost("/api/auth/login", values);
    if (!result.ok) {
      setServerError(errorText(result.error.code));
      return;
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
      <EmailField error={errors.email?.message} {...form.register("email")} />
      <Field label={t.password} error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            autoComplete="current-password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...form.register("password")}
          />
        )}
      </Field>
      <Link href="/app/forgot-password" className="-mt-2 w-max text-sm text-accent hover:underline">
        {t.login.forgot}
      </Link>
      <Button type="submit" disabled={isSubmitting} className="h-12">
        {t.login.submit}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const slug =
    params
      .get("slug")
      ?.toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 32) ?? "";
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CredentialsForm>({ resolver: zodResolver(credentialsSchema) });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await apiPost("/api/auth/register", values);
    if (!result.ok) {
      setServerError(errorText(result.error.code));
      return;
    }
    router.replace(slug ? `/app?slug=${encodeURIComponent(slug)}` : "/app");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {slug && (
        <FormMessage tone="ok">
          {t.register.slugHint.replace("{address}", `${slug}.${SERVICE_DOMAIN}`)}
        </FormMessage>
      )}
      {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
      <EmailField error={errors.email?.message} {...form.register("email")} />
      <Field label={t.password} hint={t.passwordHint} error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...form.register("password")}
          />
        )}
      </Field>
      <Button type="submit" disabled={isSubmitting} arrow className="h-12">
        {t.register.submit}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const result = await apiPost("/api/auth/password/forgot", values);
    if (!result.ok) {
      setServerError(errorText(result.error.code));
      return;
    }
    setSent(true);
  });

  if (sent) return <FormMessage tone="ok">{t.forgot.sent}</FormMessage>;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
      <EmailField error={errors.email?.message} {...form.register("email")} />
      <Button type="submit" disabled={isSubmitting} className="h-12">
        {t.forgot.submit}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<NewPasswordForm>({ resolver: zodResolver(newPasswordSchema) });
  const { errors, isSubmitting } = form.formState;

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="error">{t.reset.noToken}</FormMessage>
        <ButtonLink href="/app/forgot-password" variant="secondary">
          {t.reset.requestNew}
        </ButtonLink>
      </div>
    );
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setServerError(null);
    const result = await apiPost("/api/auth/password/reset", { token, password });
    if (!result.ok) {
      setServerError(errorText(result.error.code));
      return;
    }
    setDone(true);
  });

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="ok">{t.reset.done}</FormMessage>
        <ButtonLink href="/app/login" arrow>
          {t.login.submit}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError && <FormMessage tone="error">{serverError}</FormMessage>}
      <Field label={t.newPassword} hint={t.passwordHint} error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="password"
            autoComplete="new-password"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...form.register("password")}
          />
        )}
      </Field>
      <Button type="submit" disabled={isSubmitting} className="h-12">
        {t.reset.submit}
      </Button>
    </form>
  );
}

type VerifyState = { kind: "checking" } | { kind: "done" } | { kind: "error"; message: string };

export function VerifyEmailStatus() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<VerifyState>(
    token ? { kind: "checking" } : { kind: "error", message: t.verify.noToken },
  );
  const started = useRef(false);

  useEffect(() => {
    // The token is single-use: guard against the dev-mode double effect.
    if (!token || started.current) return;
    started.current = true;
    void apiPost("/api/auth/verify-email", { token }).then((result) =>
      setState(
        result.ok ? { kind: "done" } : { kind: "error", message: errorText(result.error.code) },
      ),
    );
  }, [token]);

  if (state.kind === "checking") return <p className="text-ink-2">{t.verify.checking}</p>;
  if (state.kind === "error") return <FormMessage tone="error">{state.message}</FormMessage>;
  return (
    <div className="flex flex-col gap-4">
      <FormMessage tone="ok">{t.verify.done}</FormMessage>
      <ButtonLink href="/app" arrow>
        {t.verify.toCabinet}
      </ButtonLink>
    </div>
  );
}
