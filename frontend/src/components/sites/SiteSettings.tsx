"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import {
  PalettePicker,
  choiceFromColors,
  type PaletteChoice,
} from "@/components/theme/PalettePicker";
import { ThemeScope } from "@/components/theme/ThemeScope";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { useConfirm } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { displayAddress, siteUrl } from "@/config/site";
import { api, type ApiResult, type Site, type SiteDomains, type SitePage } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { CustomDomains } from "./CustomDomains";
import { siteErrorText } from "./errors";
import { SiteStatusChip } from "./SiteStatusChip";
import { SlugField, type SlugState } from "./SlugField";

const t = ru.sites;

type Notice = { tone: "ok" | "error"; text: string } | null;

function choiceOf(site: Site): PaletteChoice {
  return choiceFromColors(site.theme.accent, site.theme.second);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5">
      <h2 className="font-display text-h3 font-medium">{title}</h2>
      {children}
    </Card>
  );
}

function initials(title: string): string {
  return (
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

type SiteSettingsProps = { initial: Site; emailVerified: boolean; domains: SiteDomains | null };

export function SiteSettings({ initial, emailVerified, domains }: SiteSettingsProps) {
  const router = useRouter();
  const [site, setSite] = useState(initial);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  async function run<T>(action: () => Promise<ApiResult<T>>, onOk: (data: T) => void) {
    setBusy(true);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: siteErrorText(result.error.code) });
      return false;
    }
    onOk(result.data);
    return true;
  }

  const path = { site_id: site.id };
  const live = site.status === "published";
  const url = siteUrl(site.host);

  // --- publishing ----------------------------------------------------------
  const publish = () =>
    run(
      () => api.post("/api/sites/{site_id}/publish", { path }),
      (data) => {
        setSite(data);
        setNotice({ tone: "ok", text: t.edit.saved });
      },
    );
  const unpublish = () => run(() => api.post("/api/sites/{site_id}/unpublish", { path }), setSite);

  // --- general: title, neon, SEO ------------------------------------------
  const [title, setTitle] = useState(site.title);
  const [palette, setPalette] = useState<PaletteChoice>(choiceOf(site));
  const [seoTitle, setSeoTitle] = useState(site.seo_title);
  const [seoDescription, setSeoDescription] = useState(site.seo_description);

  async function saveGeneral(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        api.patch("/api/sites/{site_id}", {
          path,
          body: {
            title,
            accent: palette.accent,
            second: palette.second ?? null,
            seo_title: seoTitle,
            seo_description: seoDescription,
          },
        }),
      (data) => {
        setSite(data);
        setNotice({ tone: "ok", text: t.edit.saved });
      },
    );
  }

  // --- address ---------------------------------------------------------------
  const [slug, setSlug] = useState(site.slug);
  const [slugState, setSlugState] = useState<SlugState>("idle");

  async function saveSlug(event: FormEvent) {
    event.preventDefault();
    await run(
      () => api.patch("/api/sites/{site_id}", { path, body: { slug } }),
      (data) => {
        setSite(data);
        setSlug(data.slug);
        setNotice({ tone: "ok", text: t.edit.saved });
      },
    );
  }

  // --- pages -------------------------------------------------------------------
  const [newPath, setNewPath] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const replacePage = (page: SitePage) =>
    setSite((s) => ({ ...s, pages: s.pages.map((p) => (p.id === page.id ? page : p)) }));

  async function addPage(event: FormEvent) {
    event.preventDefault();
    const ok = await run(
      () =>
        api.post("/api/sites/{site_id}/pages", {
          path,
          body: { path: newPath, title: newTitle || newPath },
        }),
      (page) => setSite((s) => ({ ...s, pages: [...s.pages, page] })),
    );
    if (ok) {
      setNewPath("");
      setNewTitle("");
    }
  }

  const deleteSite = async () => {
    const confirmed = await confirm({
      title: t.edit.deleteTitle,
      text: t.edit.deleteConfirm.replace("{address}", displayAddress(site.slug)),
      confirmLabel: ru.dialog.remove,
      danger: true,
    });
    if (!confirmed) return;
    const ok = await run(
      () => api.delete("/api/sites/{site_id}", { path }),
      () => undefined,
    );
    if (ok) {
      router.replace("/app");
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {dialog}
      <div className="flex flex-col gap-4">
        <Link href="/app" className="w-max text-sm text-ink-2 hover:text-ink">
          ← {t.back}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{t.kind[site.kind]}</Chip>
              <SiteStatusChip site={site} />
            </div>
            <h1 className="font-display text-h2 font-medium break-words">{site.title}</h1>
            <span className="font-mono text-[15px] text-accent">{displayAddress(site.slug)}</span>
          </div>
        </div>
      </div>

      {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          {live ? (
            <>
              <span className="text-sm text-muted">{t.publish.liveAt}</span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-mono text-accent hover:underline"
              >
                {displayAddress(site.slug)}
                <Icon name="external" size={16} />
              </a>
            </>
          ) : (
            <p className="text-ink-2">
              {emailVerified ? t.publish.draftNote : t.publish.needVerified}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/app/sites/${site.id}/editor`} variant="secondary" arrow>
            {ru.builder.open}
          </ButtonLink>
          {live && (
            <Button variant="secondary" onClick={unpublish} disabled={busy}>
              {t.publish.unpublish}
            </Button>
          )}
          {(!live || site.has_unpublished_changes) && (
            <Button onClick={publish} disabled={busy || site.status === "suspended"} arrow>
              {live ? t.publish.republish : t.publish.publish}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title={t.edit.general}>
          <form onSubmit={saveGeneral} className="flex flex-col gap-5">
            <Field label={t.create.titleLabel}>
              {({ id }) => (
                <Input
                  id={id}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              )}
            </Field>
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-ink-2">{t.edit.theme}</span>
              <PalettePicker value={palette} onChange={setPalette} />
              <ThemeScope
                accent={palette.accent}
                second={palette.second}
                className="flex items-center gap-4 rounded-md border border-line bg-bg p-4"
              >
                <Avatar initials={initials(title)} size={52} glow />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <b className="truncate font-display font-medium">{title || site.title}</b>
                  <span className="font-mono text-[13px] text-accent">
                    {displayAddress(site.slug)}
                  </span>
                </div>
              </ThemeScope>
            </div>
            <span className="text-sm font-medium text-ink-2">{t.edit.seo}</span>
            <Field label={t.edit.seoTitle}>
              {({ id }) => (
                <Input
                  id={id}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={70}
                  placeholder={title}
                />
              )}
            </Field>
            <Field label={t.edit.seoDescription}>
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={200}
                />
              )}
            </Field>
            <Button type="submit" disabled={busy} className="self-start">
              {t.edit.save}
            </Button>
          </form>
        </Section>

        <div className="flex flex-col gap-6">
          <Section title={t.edit.address}>
            <form onSubmit={saveSlug} className="flex flex-col gap-4">
              <SlugField
                label={t.edit.subdomain}
                value={slug}
                onChange={setSlug}
                current={site.slug}
                onStateChange={setSlugState}
                hint={t.edit.addressHint}
              />
              <Button
                type="submit"
                variant="secondary"
                className="self-start"
                disabled={busy || slug === site.slug || slugState !== "available"}
              >
                {t.edit.save}
              </Button>
            </form>
          </Section>

          <CustomDomains siteId={site.id} live={live} initial={domains} />

          <Section title={t.edit.pages}>
            <ul className="flex flex-col gap-3">
              {site.pages.map((page) => (
                <PageRow
                  key={page.id}
                  siteId={site.id}
                  page={page}
                  busy={busy}
                  run={run}
                  onSaved={replacePage}
                  onDeleted={(id) =>
                    setSite((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== id) }))
                  }
                />
              ))}
            </ul>
            <form onSubmit={addPage} className="flex flex-col gap-3 border-t border-line pt-5">
              <Field label={t.edit.pagePath}>
                {({ id }) => (
                  <Input
                    id={id}
                    prefix="/"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value.toLowerCase())}
                    maxLength={32}
                    placeholder="projects"
                  />
                )}
              </Field>
              <Field label={t.edit.pageTitle}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={120}
                  />
                )}
              </Field>
              <Button
                type="submit"
                variant="secondary"
                className="self-start"
                disabled={busy || !newPath}
              >
                <Icon name="plus" size={18} />
                {t.edit.addPage}
              </Button>
            </form>
          </Section>

          <Section title={t.edit.danger}>
            <Button
              variant="secondary"
              className="self-start border-[#ff6b6b]/50 text-[#ffb3b3] hover:border-[#ff6b6b]"
              onClick={deleteSite}
              disabled={busy}
            >
              {t.edit.deleteSite}
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}

type PageRowProps = {
  siteId: string;
  page: SitePage;
  busy: boolean;
  run: <T>(action: () => Promise<ApiResult<T>>, onOk: (data: T) => void) => Promise<boolean>;
  onSaved: (page: SitePage) => void;
  onDeleted: (id: string) => void;
};

function PageRow({ siteId, page, busy, run, onSaved, onDeleted }: PageRowProps) {
  const [title, setTitle] = useState(page.title);
  const home = page.path === "";
  const path = { site_id: siteId, page_id: page.id };
  const dirty = title !== page.title;

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[13px] text-muted">/{page.path}</span>
        {home ? (
          <Chip>{t.edit.home}</Chip>
        ) : (
          <button
            type="button"
            className="text-[13px] text-muted transition-colors hover:text-[#ffb3b3]"
            disabled={busy}
            onClick={() =>
              run(
                () => api.delete("/api/sites/{site_id}/pages/{page_id}", { path }),
                () => onDeleted(page.id),
              )
            }
          >
            {t.edit.deletePage}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`page-${page.id}`}>
          {t.edit.pageTitle}
        </label>
        <Input
          id={`page-${page.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="h-10 flex-1"
        />
        {dirty && (
          <Button
            size="sm"
            variant="secondary"
            className="h-10"
            disabled={busy}
            onClick={() =>
              run(
                () => api.patch("/api/sites/{site_id}/pages/{page_id}", { path, body: { title } }),
                onSaved,
              )
            }
          >
            {t.edit.save}
          </Button>
        )}
      </div>
    </li>
  );
}
