"use client";

import { useEffect, useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { SERVICE_DOMAIN } from "@/config/site";
import { api } from "@/lib/api/client";
import { sanitizeSlug } from "@/lib/sites/slug";
import { ru } from "@/i18n/ru";

const t = ru.sites.slug;

export type SlugState = "idle" | "checking" | "available" | "unavailable";

type SlugFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The site's current slug: not re-checked. */
  current?: string;
  onStateChange?: (state: SlugState) => void;
  hint?: string;
};

export function SlugField({
  label,
  value,
  onChange,
  current,
  onStateChange,
  hint,
}: SlugFieldProps) {
  const [checked, setChecked] = useState<{
    slug: string;
    available: boolean;
    reason: string | null;
  }>();
  const needsCheck = Boolean(value) && value !== current;

  useEffect(() => {
    if (!needsCheck) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await api.get("/api/sites/slug-check", { query: { slug: value } });
      if (cancelled || !result.ok) return;
      setChecked({
        slug: value,
        available: result.data.available,
        reason: result.data.reason ?? null,
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, needsCheck]);

  const state: SlugState = !needsCheck
    ? "idle"
    : checked?.slug !== value
      ? "checking"
      : checked.available
        ? "available"
        : "unavailable";
  const reason = state === "unavailable" ? (checked?.reason ?? null) : null;

  useEffect(() => onStateChange?.(state), [state, onStateChange]);

  const reasonText =
    reason && reason in t.reasons ? t.reasons[reason as keyof typeof t.reasons] : t.hint;
  const note =
    state === "checking"
      ? t.checking
      : state === "available"
        ? t.available
        : state === "unavailable"
          ? reasonText
          : (hint ?? t.hint);

  return (
    <Field label={label} error={state === "unavailable" ? note : undefined} hint={note}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(sanitizeSlug(e.target.value))}
          suffix={`.${SERVICE_DOMAIN}`}
          autoComplete="off"
          spellCheck={false}
          inputMode="url"
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      )}
    </Field>
  );
}
