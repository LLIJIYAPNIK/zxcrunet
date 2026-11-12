"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { CatalogProvider } from "@/blocks/catalog-context";
import {
  ChipsField,
  ListField,
  MediaField,
  NumberField,
  SelectField,
  TextField,
  TitlePicker,
  ToggleField,
} from "@/blocks/fields";
import type { MediaRef } from "@/blocks/schemas";
import { FormMessage } from "@/components/auth/AuthShell";
import { siteErrorText } from "@/components/sites/errors";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { api, type Schemas } from "@/lib/api/client";
import {
  STATUSES,
  TITLE_KINDS,
  statusText,
  type Catalog,
  type ShelfStatus,
  type Title,
  type TitleKind,
} from "@/lib/catalog/catalog";
import { ru } from "@/i18n/ru";

const c = ru.catalog;
const f = c.fields;

type TitleIn = Schemas["TitleIn"];
type DetailsForm = {
  criteria: { name: string; score: number }[];
  plot: { label: string; text: string; spoiler: boolean }[];
  characters: {
    name: string;
    role: string;
    parts: string[];
    favorite: boolean;
    avatar: MediaRef | null;
  }[];
  bosses: { name: string; note: string; defeated: boolean }[];
  tracks: { title: string; artist: string; part: string; url: string | null }[];
  extras: { name: string; done: boolean }[];
  screenshots: (MediaRef | null)[];
  related: { title_id: string | null; name: string; note: string }[];
  place: string;
  favorite_part: string;
};

type Form = Omit<TitleIn, "entry" | "cover"> & {
  cover: MediaRef | null;
  onShelf: boolean;
  status: ShelfStatus;
  rating: number | null;
  hours: number | null;
  progress: number | null;
  progress_total: number | null;
  favorite: boolean;
  started_on: string;
  finished_on: string;
  notes: string;
  details: DetailsForm;
};

function toForm(title: Title | null, kind: TitleKind): Form {
  const e = title?.entry;
  const d = e?.details;
  return {
    kind: title?.kind ?? kind,
    name: title?.name ?? "",
    slug: title?.slug ?? "",
    year: title?.year ?? null,
    year_end: title?.year_end ?? null,
    creator: title?.creator ?? "",
    genres: title?.genres ?? [],
    description: title?.description ?? "",
    cover: (title?.cover as MediaRef | null) ?? null,
    is_series: title?.is_series ?? false,
    series_id: title?.series_id ?? null,
    part_label: title?.part_label ?? "",
    position: title?.position ?? 0,
    onShelf: title ? !!e : true,
    status: e?.status ?? "done",
    rating: e?.rating ?? null,
    hours: e?.hours ?? null,
    progress: e?.progress ?? null,
    progress_total: e?.progress_total ?? null,
    favorite: e?.favorite ?? false,
    started_on: e?.started_on ?? "",
    finished_on: e?.finished_on ?? "",
    notes: e?.notes ?? "",
    details: {
      criteria: d?.criteria ?? [],
      plot: (d?.plot ?? []).map((p) => ({
        label: p.label ?? "",
        text: p.text,
        spoiler: p.spoiler ?? true,
      })),
      characters: (d?.characters ?? []).map((ch) => ({
        name: ch.name,
        role: ch.role,
        parts: ch.parts ?? [],
        favorite: ch.favorite,
        avatar: (ch.avatar as MediaRef | null) ?? null,
      })),
      bosses: (d?.bosses ?? []).map((b) => ({
        name: b.name,
        note: b.note ?? "",
        defeated: b.defeated ?? false,
      })),
      tracks: (d?.tracks ?? []).map((t) => ({
        title: t.title,
        artist: t.artist ?? "",
        part: t.part ?? "",
        url: t.url ?? null,
      })),
      extras: (d?.extras ?? []).map((x) => ({ name: x.name, done: x.done ?? false })),
      screenshots: (d?.screenshots ?? []) as MediaRef[],
      related: (d?.related ?? []).map((r) => ({
        title_id: r.title_id ?? null,
        name: r.name ?? "",
        note: r.note ?? "",
      })),
      place: d?.place ?? "",
      favorite_part: d?.favorite_part ?? "",
    },
  };
}

function toBody(form: Form): TitleIn {
  const { onShelf, status, rating, hours, progress, progress_total, favorite, notes, details } =
    form;
  return {
    kind: form.kind,
    name: form.name,
    slug: form.slug,
    year: form.year,
    year_end: form.year_end,
    creator: form.creator,
    genres: form.genres,
    description: form.description,
    cover: form.cover,
    is_series: form.is_series,
    series_id: form.is_series ? null : form.series_id,
    part_label: form.is_series ? "" : form.part_label,
    position: form.position,
    entry: onShelf
      ? {
          status,
          rating,
          hours,
          progress,
          progress_total,
          favorite,
          notes,
          started_on: form.started_on || null,
          finished_on: form.finished_on || null,
          details: {
            ...details,
            screenshots: details.screenshots.filter((s): s is MediaRef => !!s),
          },
        }
      : null,
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="font-display text-h3 font-medium">{title}</h2>
      {children}
    </section>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      {({ id }) => (
        <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

const grid2 = "grid grid-cols-1 gap-5 sm:grid-cols-2";

export function TitleForm({
  catalog,
  initial,
  kind = "game",
}: {
  catalog: Catalog;
  initial: Title | null;
  kind?: TitleKind;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(initial, kind));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => {
    setForm((v) => ({ ...v, ...patch }));
    setSaved(false);
  };
  const setDetails = (patch: Partial<DetailsForm>) =>
    set({ details: { ...form.details, ...patch } });
  const d = form.details;
  const k = form.kind;
  const series = catalog.titles.filter((t) => t.is_series && t.kind === k && t.id !== initial?.id);
  const hasProgress = k !== "game" && k !== "film";

  async function save() {
    if (!form.name.trim()) {
      setError(ru.sites.errors.title_required);
      return;
    }
    setBusy(true);
    setError(null);
    const body = toBody(form);
    const result = initial
      ? await api.put("/api/catalog/titles/{title_id}", {
          path: { title_id: initial.id },
          body,
        })
      : await api.post("/api/catalog/titles", { body });
    setBusy(false);
    if (!result.ok) {
      setError(siteErrorText(result.error.code));
      return;
    }
    if (initial) {
      setForm(toForm(result.data, k));
      setSaved(true);
      router.refresh();
    } else {
      router.replace(`/app/catalog/${result.data.id}`);
    }
  }

  async function remove() {
    if (!initial || !window.confirm(c.removeTitleConfirm.replace("{name}", initial.name))) return;
    const result = await api.delete("/api/catalog/titles/{title_id}", {
      path: { title_id: initial.id },
    });
    if (result.ok) router.replace(`/app/catalog?kind=${k}`);
    else setError(siteErrorText(result.error.code));
  }

  return (
    <CatalogProvider catalog={catalog}>
      <form
        className="mx-auto flex max-w-3xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-2">
          <Link href={`/app/catalog?kind=${k}`} className="w-max text-sm text-ink-2 hover:text-ink">
            ← {c.back}
          </Link>
          <span className="label">{c.kindOne[k]}</span>
          <h1 className="font-display text-h2 font-medium">
            {initial ? form.name || initial.name : c.addTitle}
          </h1>
        </div>

        <Section title={c.sections.main}>
          {!initial && (
            <SelectField
              label={f.kind}
              value={form.kind}
              options={TITLE_KINDS.map((x) => ({ value: x, label: c.kindOne[x] }))}
              onChange={(next) => set({ kind: next, series_id: null })}
            />
          )}
          <TextField
            label={f.name}
            value={form.name}
            max={120}
            onChange={(name) => set({ name })}
          />
          <div className={grid2}>
            <NumberField
              label={f.year}
              value={form.year ?? null}
              min={1800}
              max={2100}
              fallback={null}
              onChange={(year) => set({ year })}
            />
            <NumberField
              label={f.yearEnd}
              value={form.year_end ?? null}
              min={1800}
              max={2100}
              fallback={null}
              onChange={(year_end) => set({ year_end })}
            />
          </div>
          <TextField
            label={f.creator}
            value={form.creator ?? ""}
            max={80}
            onChange={(creator) => set({ creator })}
          />
          <ChipsField
            label={f.genres}
            value={form.genres ?? []}
            max={6}
            onChange={(genres) => set({ genres })}
          />
          <TextField
            label={f.description}
            value={form.description ?? ""}
            max={1200}
            multiline
            onChange={(description) => set({ description })}
          />
          <MediaField
            label={f.cover}
            purpose="image"
            value={form.cover}
            onChange={(cover) => set({ cover })}
          />
          <Field label={f.slug} hint={f.slugHint}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                value={form.slug ?? ""}
                maxLength={64}
                aria-describedby={describedBy}
                className="font-mono"
                onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
              />
            )}
          </Field>
        </Section>

        <Section title={c.sections.series}>
          <ToggleField
            label={f.isSeries}
            checked={!!form.is_series}
            onChange={(is_series) => set({ is_series })}
          />
          {!form.is_series && (
            <>
              <SelectField
                label={f.series}
                value={form.series_id ?? ""}
                options={[
                  { value: "", label: f.noSeries },
                  ...series.map((s) => ({ value: s.id, label: s.name })),
                ]}
                onChange={(id) => set({ series_id: id || null })}
              />
              {form.series_id && (
                <div className={grid2}>
                  <Field label={f.partLabel} hint={f.partLabelHint}>
                    {({ id, describedBy }) => (
                      <Input
                        id={id}
                        value={form.part_label ?? ""}
                        maxLength={24}
                        aria-describedby={describedBy}
                        onChange={(e) => set({ part_label: e.target.value })}
                      />
                    )}
                  </Field>
                  <NumberField
                    label={f.position}
                    value={form.position ?? 0}
                    min={0}
                    max={999}
                    fallback={0}
                    onChange={(position) => set({ position })}
                  />
                </div>
              )}
            </>
          )}
        </Section>

        <Section title={c.sections.shelf}>
          <ToggleField
            label={f.onShelf}
            checked={form.onShelf}
            onChange={(onShelf) => set({ onShelf })}
          />
          {form.onShelf && (
            <>
              <div className={grid2}>
                <SelectField
                  label={f.status}
                  value={form.status}
                  options={STATUSES.map((s) => ({ value: s, label: statusText(k, s) }))}
                  onChange={(status) => set({ status })}
                />
                <SelectField
                  label={f.rating}
                  value={form.rating ? String(form.rating) : ""}
                  options={[
                    { value: "", label: f.noRating },
                    ...Array.from({ length: 10 }, (_, i) => ({
                      value: String(10 - i),
                      label: `${10 - i} / 10`,
                    })),
                  ]}
                  onChange={(r) => set({ rating: r ? Number(r) : null })}
                />
              </div>
              <div className={grid2}>
                {(k === "game" || form.is_series) && (
                  <NumberField
                    label={f.hours}
                    value={form.hours}
                    min={0}
                    max={100000}
                    fallback={null}
                    onChange={(hours) => set({ hours })}
                  />
                )}
                {hasProgress && !form.is_series && (
                  <>
                    <NumberField
                      label={c.progressUnit[k]}
                      value={form.progress}
                      min={0}
                      max={100000}
                      fallback={null}
                      onChange={(progress) => set({ progress })}
                    />
                    <NumberField
                      label={c.progressTotal[k]}
                      value={form.progress_total}
                      min={0}
                      max={100000}
                      fallback={null}
                      onChange={(progress_total) => set({ progress_total })}
                    />
                  </>
                )}
              </div>
              <div className={grid2}>
                <DateField
                  label={f.startedOn}
                  value={form.started_on}
                  onChange={(started_on) => set({ started_on })}
                />
                <DateField
                  label={f.finishedOn}
                  value={form.finished_on}
                  onChange={(finished_on) => set({ finished_on })}
                />
              </div>
              <ToggleField
                label={f.favorite}
                checked={form.favorite}
                onChange={(favorite) => set({ favorite })}
              />
              {(k === "film" || k === "series" || k === "book") && (
                <TextField
                  label={f.place}
                  value={d.place}
                  max={80}
                  onChange={(place) => setDetails({ place })}
                />
              )}
              {form.is_series && (
                <TextField
                  label={f.favoritePart}
                  value={d.favorite_part}
                  max={24}
                  onChange={(favorite_part) => setDetails({ favorite_part })}
                />
              )}
              <TextField
                label={f.notes}
                value={form.notes}
                max={2000}
                multiline
                onChange={(notes) => set({ notes })}
              />
            </>
          )}
        </Section>

        {form.onShelf && (
          <>
            <Section title={c.sections.criteria}>
              <ListField
                label={c.sections.criteria}
                items={d.criteria}
                min={0}
                max={8}
                make={() => ({ name: "", score: 8 })}
                title={(x) => x.name || "—"}
                onChange={(criteria) => setDetails({ criteria })}
              >
                {(x, update) => (
                  <div className={grid2}>
                    <TextField
                      label={f.criterion}
                      value={x.name}
                      max={40}
                      onChange={(name) => update({ ...x, name })}
                    />
                    <NumberField
                      label={f.score}
                      value={x.score}
                      min={1}
                      max={10}
                      fallback={1}
                      onChange={(score) => update({ ...x, score })}
                    />
                  </div>
                )}
              </ListField>
            </Section>

            <Section title={c.sections.plot}>
              <ListField
                label={c.sections.plot}
                items={d.plot}
                min={0}
                max={12}
                make={() => ({ label: "", text: "", spoiler: true })}
                title={(x) => x.label || x.text.slice(0, 30) || "—"}
                onChange={(plot) => setDetails({ plot })}
              >
                {(x, update) => (
                  <>
                    <TextField
                      label={f.sectionLabel}
                      value={x.label}
                      max={80}
                      onChange={(label) => update({ ...x, label })}
                    />
                    <TextField
                      label={ru.builder.fields.text}
                      value={x.text}
                      max={2000}
                      multiline
                      onChange={(text) => update({ ...x, text })}
                    />
                    <ToggleField
                      label={f.spoiler}
                      checked={x.spoiler}
                      onChange={(spoiler) => update({ ...x, spoiler })}
                    />
                  </>
                )}
              </ListField>
            </Section>

            <Section title={c.sections.characters}>
              <ListField
                label={c.sections.characters}
                items={d.characters}
                min={0}
                max={24}
                make={() => ({ name: "", role: "", parts: [], favorite: false, avatar: null })}
                title={(x) => x.name || "—"}
                onChange={(characters) => setDetails({ characters })}
              >
                {(x, update) => (
                  <>
                    <TextField
                      label={f.characterName}
                      value={x.name}
                      max={80}
                      onChange={(name) => update({ ...x, name })}
                    />
                    <TextField
                      label={f.role}
                      value={x.role}
                      max={80}
                      onChange={(role) => update({ ...x, role })}
                    />
                    {form.is_series && (
                      <ChipsField
                        label={f.parts}
                        value={x.parts}
                        max={12}
                        onChange={(parts) => update({ ...x, parts })}
                      />
                    )}
                    <MediaField
                      label={f.avatar}
                      purpose="image"
                      value={x.avatar}
                      onChange={(avatar) => update({ ...x, avatar })}
                    />
                    <ToggleField
                      label={f.favoriteCharacter}
                      checked={x.favorite}
                      onChange={(favorite) => update({ ...x, favorite })}
                    />
                  </>
                )}
              </ListField>
            </Section>

            {k === "game" && (
              <Section title={c.sections.bosses}>
                <ListField
                  label={c.sections.bosses}
                  items={d.bosses}
                  min={0}
                  max={40}
                  make={() => ({ name: "", note: "", defeated: false })}
                  title={(x) => x.name || "—"}
                  onChange={(bosses) => setDetails({ bosses })}
                >
                  {(x, update) => (
                    <>
                      <TextField
                        label={f.bossName}
                        value={x.name}
                        max={80}
                        onChange={(name) => update({ ...x, name })}
                      />
                      <TextField
                        label={f.note}
                        value={x.note}
                        max={80}
                        onChange={(note) => update({ ...x, note })}
                      />
                      <ToggleField
                        label={f.defeated}
                        checked={x.defeated}
                        onChange={(defeated) => update({ ...x, defeated })}
                      />
                    </>
                  )}
                </ListField>
              </Section>
            )}

            <Section title={c.sections.tracks}>
              <ListField
                label={c.sections.tracks}
                items={d.tracks}
                min={0}
                max={30}
                make={() => ({ title: "", artist: "", part: "", url: null })}
                title={(x) => x.title || "—"}
                onChange={(tracks) => setDetails({ tracks })}
              >
                {(x, update) => (
                  <>
                    <TextField
                      label={f.track}
                      value={x.title}
                      max={80}
                      onChange={(title) => update({ ...x, title })}
                    />
                    <TextField
                      label={f.artist}
                      value={x.artist}
                      max={80}
                      onChange={(artist) => update({ ...x, artist })}
                    />
                    {form.is_series && (
                      <TextField
                        label={f.part}
                        value={x.part}
                        max={24}
                        onChange={(part) => update({ ...x, part })}
                      />
                    )}
                    <TextField
                      label={f.listen}
                      value={x.url ?? ""}
                      max={500}
                      placeholder="https://"
                      onChange={(url) => update({ ...x, url: url.trim() || null })}
                    />
                  </>
                )}
              </ListField>
            </Section>

            {!form.is_series && (
              <Section title={c.sections.extras}>
                <ListField
                  label={c.sections.extras}
                  items={d.extras}
                  min={0}
                  max={12}
                  make={() => ({ name: "", done: false })}
                  title={(x) => x.name || "—"}
                  onChange={(extras) => setDetails({ extras })}
                >
                  {(x, update) => (
                    <>
                      <TextField
                        label={f.extraName}
                        value={x.name}
                        max={80}
                        onChange={(name) => update({ ...x, name })}
                      />
                      <ToggleField
                        label={f.done}
                        checked={x.done}
                        onChange={(done) => update({ ...x, done })}
                      />
                    </>
                  )}
                </ListField>
              </Section>
            )}

            <Section title={c.sections.screenshots}>
              <ListField
                label={c.sections.screenshots}
                items={d.screenshots}
                min={0}
                max={24}
                make={() => null}
                title={(x, i) => (x ? `#${i + 1}` : "—")}
                onChange={(screenshots) => setDetails({ screenshots })}
              >
                {(x, update) => (
                  <MediaField
                    label={c.sections.screenshots}
                    purpose="image"
                    value={x}
                    onChange={update}
                  />
                )}
              </ListField>
            </Section>

            <Section title={c.sections.related}>
              <ListField
                label={c.sections.related}
                items={d.related}
                min={0}
                max={8}
                make={() => ({ title_id: null, name: "", note: "" })}
                title={(x) =>
                  catalog.titles.find((t) => t.id === x.title_id)?.name ?? (x.name || "—")
                }
                onChange={(related) => setDetails({ related })}
              >
                {(x, update) => (
                  <>
                    <TitlePicker
                      label={f.relatedTitle}
                      value={x.title_id}
                      onChange={(title_id) => update({ ...x, title_id })}
                    />
                    {!x.title_id && (
                      <TextField
                        label={f.relatedName}
                        value={x.name}
                        max={80}
                        onChange={(name) => update({ ...x, name })}
                      />
                    )}
                    <TextField
                      label={f.relatedNote}
                      value={x.note}
                      max={80}
                      onChange={(note) => update({ ...x, note })}
                    />
                  </>
                )}
              </ListField>
            </Section>
          </>
        )}

        {error && <FormMessage tone="error">{error}</FormMessage>}
        {saved && <FormMessage tone="ok">{c.saved}</FormMessage>}
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
          <Button type="submit" disabled={busy} arrow>
            {initial ? c.save : c.create}
          </Button>
          {initial && (
            <Button type="button" variant="ghost" onClick={remove}>
              {c.remove}
            </Button>
          )}
        </div>
      </form>
    </CatalogProvider>
  );
}
