"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { api } from "@/lib/api/client";
import { sanitizeSlug } from "@/lib/sites/slug";
import { ru } from "@/i18n/ru";

import { siteErrorText } from "./errors";
import { SlugField, type SlugState } from "./SlugField";

const t = ru.sites;
type Kind = "business" | "personal";

export function NewSiteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [kind, setKind] = useState<Kind>(
    params.get("kind") === "personal" ? "personal" : "business",
  );
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState(sanitizeSlug(params.get("slug") ?? ""));
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError(t.errors.title_required);
      return;
    }
    setPending(true);
    const result = await api.post("/api/sites", { body: { kind, slug, title } });
    setPending(false);
    if (!result.ok) {
      if (result.status === 401) router.replace("/app/login?next=/app/sites/new");
      setError(siteErrorText(result.error.code));
      return;
    }
    router.replace(`/app/sites/${result.data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-2">{t.create.kindLabel}</span>
        <Segmented
          label={t.create.kindLabel}
          value={kind}
          onChange={setKind}
          options={[
            { value: "business", label: t.kind.business },
            { value: "personal", label: t.kind.personal },
          ]}
        />
        <span className="text-[13px] text-muted">{t.kindHint[kind]}</span>
      </div>
      <Field label={t.create.titleLabel}>
        {({ id }) => (
          <Input
            id={id}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.create.titlePlaceholder}
            maxLength={120}
            autoComplete="off"
          />
        )}
      </Field>
      <SlugField
        label={t.create.slugLabel}
        value={slug}
        onChange={setSlug}
        onStateChange={setSlugState}
      />
      <Button
        type="submit"
        arrow
        className="h-12"
        disabled={pending || slugState === "unavailable" || slugState === "checking" || !slug}
      >
        {t.create.submit}
      </Button>
    </form>
  );
}
