"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SelectField, TextField } from "@/blocks/fields";
import { CatalogProvider } from "@/blocks/catalog-context";
import { TitlePicker } from "@/blocks/fields";
import { FormMessage } from "@/components/auth/AuthShell";
import { siteErrorText } from "@/components/sites/errors";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api/client";
import {
  CatalogIndex,
  TITLE_KINDS,
  formatDate,
  statusText,
  yearsText,
  type Catalog,
  type Post,
  type Title,
  type TitleKind,
} from "@/lib/catalog/catalog";
import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

import { Thumb } from "./pieces";

const c = ru.catalog;

type Tab = TitleKind | "posts";

function Row({ title, nested = false }: { title: Title; nested?: boolean }) {
  const meta = [
    title.is_series ? c.seriesOf[title.kind] : title.part_label,
    yearsText(title),
    title.entry ? statusText(title.kind, title.entry.status) : c.page.notOnShelf,
    title.entry?.rating ? `${title.entry.rating}/10` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li>
      <Link
        href={`/app/catalog/${title.id}`}
        className={cn(
          "flex min-h-16 items-center gap-3 rounded-md border border-line bg-surface p-2.5 pr-4 transition-colors hover:border-line-2",
          nested && "ml-6 sm:ml-10",
        )}
      >
        <Thumb title={title} className="size-11" />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate font-medium">{title.name}</b>
          <span className="truncate text-[13px] text-muted">{meta}</span>
        </span>
        <Icon name="arrow" size={16} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

type Draft = {
  id: string | null;
  kind: Post["kind"];
  heading: string;
  body: string;
  title_id: string | null;
  published_on: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  kind: "note",
  heading: "",
  body: "",
  title_id: null,
  published_on: "",
});

function Posts({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const index = new CatalogIndex(catalog);

  async function save() {
    if (!draft) return;
    const body = {
      kind: draft.kind,
      heading: draft.heading,
      body: draft.body,
      title_id: draft.title_id,
      published_on: draft.published_on || null,
    };
    const result = draft.id
      ? await api.put("/api/catalog/posts/{post_id}", { path: { post_id: draft.id }, body })
      : await api.post("/api/catalog/posts", { body });
    if (!result.ok) {
      setError(siteErrorText(result.error.code));
      return;
    }
    setDraft(null);
    setError(null);
    router.refresh();
  }

  async function remove(post: Post) {
    const ok = await confirm({
      title: c.removePostConfirm.replace("{name}", post.heading),
      confirmLabel: ru.dialog.remove,
      danger: true,
    });
    if (!ok) return;
    const result = await api.delete("/api/catalog/posts/{post_id}", { path: { post_id: post.id } });
    if (result.ok) router.refresh();
    else setError(siteErrorText(result.error.code));
  }

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      {!draft && (
        <Button className="self-start" onClick={() => setDraft(emptyDraft())}>
          <Icon name="plus" size={18} />
          {c.addPost}
        </Button>
      )}
      {draft && (
        <form
          aria-label={c.addPost}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5"
        >
          <SelectField
            label={c.fields.kind}
            value={draft.kind}
            options={[
              { value: "review", label: c.postKinds.review },
              { value: "note", label: c.postKinds.note },
            ]}
            onChange={(kind) => setDraft({ ...draft, kind })}
          />
          <TextField
            label={c.fields.heading}
            value={draft.heading}
            onChange={(heading) => setDraft({ ...draft, heading })}
          />
          <TextField
            label={c.fields.body}
            value={draft.body}
            max={5000}
            multiline
            onChange={(body) => setDraft({ ...draft, body })}
          />
          <TitlePicker
            label={c.fields.linkedTitle}
            value={draft.title_id}
            onChange={(title_id) => setDraft({ ...draft, title_id })}
          />
          <Field label={c.fields.publishedOn}>
            {({ id }) => (
              <Input
                id={id}
                type="date"
                value={draft.published_on}
                onChange={(e) => setDraft({ ...draft, published_on: e.target.value })}
              />
            )}
          </Field>
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="flex gap-3">
            <Button type="submit">{draft.id ? c.save : c.create}</Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
              {ru.builder.close}
            </Button>
          </div>
        </form>
      )}
      {catalog.posts.length === 0 && !draft && <p className="text-ink-2">{c.postsEmpty}</p>}
      <ul className="flex flex-col gap-2">
        {catalog.posts.map((post) => (
          <li
            key={post.id}
            className="flex items-center gap-3 rounded-md border border-line bg-surface p-3 pl-4"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate font-medium">{post.heading}</b>
              <span className="truncate text-[13px] text-muted">
                {[
                  c.postKinds[post.kind],
                  formatDate(post.published_on),
                  index.get(post.title_id)?.name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setDraft({
                  id: post.id,
                  kind: post.kind,
                  heading: post.heading,
                  body: post.body,
                  title_id: post.title_id,
                  published_on: post.published_on,
                })
              }
            >
              {ru.builder.edit}
            </Button>
            <button
              type="button"
              aria-label={`${c.remove}: ${post.heading}`}
              onClick={() => void remove(post)}
              className="grid size-9 shrink-0 place-items-center rounded-sm text-muted hover:text-[#ffb3b3]"
            >
              <Icon name="trash" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CatalogHome({
  catalog,
  initialTab,
  limits,
}: {
  catalog: Catalog;
  initialTab: Tab;
  limits: { titles: number; maxTitles: number };
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const index = new CatalogIndex(catalog);
  const ofKind = tab === "posts" ? [] : index.ofKind(tab);
  const top = ofKind.filter((t) => !t.series_id || !index.get(t.series_id));

  return (
    <CatalogProvider catalog={catalog}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <Link href="/app" className="w-max text-sm text-ink-2 hover:text-ink">
              ← {c.toCabinet}
            </Link>
            <h1 className="font-display text-h2 font-medium">{c.title}</h1>
            <p className="text-ink-2">{c.lead}</p>
          </div>
          <span className="label">
            {c.usage
              .replace("{used}", String(limits.titles))
              .replace("{max}", String(limits.maxTitles))}
          </span>
        </div>

        <div
          role="tablist"
          aria-label={c.title}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {([...TITLE_KINDS, "posts"] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="tab"
              aria-selected={tab === x}
              onClick={() => {
                setTab(x);
                window.history.replaceState(null, "", `/app/catalog?kind=${x}`);
              }}
              className={cn(
                "h-11 shrink-0 rounded-full border px-[18px] text-[15px] font-medium transition-colors",
                tab === x
                  ? "border-ink bg-ink text-bg"
                  : "border-line-2 text-ink-2 hover:border-ink hover:text-ink",
              )}
            >
              {x === "posts" ? c.posts : c.kinds[x]}
              <span className="ml-2 font-mono text-[13px] opacity-60">
                {x === "posts" ? catalog.posts.length : index.ofKind(x).length}
              </span>
            </button>
          ))}
        </div>

        <div role="tabpanel" aria-label={tab === "posts" ? c.posts : c.kinds[tab]}>
          {tab === "posts" ? (
            <Posts catalog={catalog} />
          ) : (
            <div className="flex flex-col gap-4">
              <ButtonLink href={`/app/catalog/new?kind=${tab}`} className="self-start">
                <Icon name="plus" size={18} />
                {c.add}: {c.kindOne[tab].toLowerCase()}
              </ButtonLink>
              {top.length === 0 && <p className="text-ink-2">{c.empty}</p>}
              <ul className="flex flex-col gap-2">
                {top.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2">
                    <ul className="flex flex-col gap-2">
                      <Row title={t} />
                      {t.is_series &&
                        index.parts(t).map((p) => <Row key={p.id} title={p} nested />)}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </CatalogProvider>
  );
}
