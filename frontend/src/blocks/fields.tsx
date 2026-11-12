"use client";

import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { siteErrorText } from "@/components/sites/errors";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { parseResponse } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { useCatalog } from "./catalog-context";
import type { Link, MediaRef } from "./schemas";

const f = ru.builder.fields;

export function TextField({
  label,
  value,
  onChange,
  max = 160,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      {({ id }) =>
        multiline ? (
          <Textarea
            id={id}
            rows={3}
            value={value}
            maxLength={max}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            id={id}
            value={value}
            maxLength={max}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Field>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-line bg-surface pr-1 pl-3.5 text-[15px] font-medium">
      {label}
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** Optional link: «Добавить кнопку» until set, then label + url with «Убрать». */
export function LinkField({
  label,
  value,
  onChange,
  placeholderUrl = "https://",
}: {
  label: string;
  value: Link | null;
  onChange: (value: Link | null) => void;
  placeholderUrl?: string;
}) {
  if (!value) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-2">{label}</span>
        <Button size="sm" variant="secondary" onClick={() => onChange({ label: "", url: "" })}>
          <Icon name="plus" size={16} />
          {f.addLink}
        </Button>
      </div>
    );
  }
  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-line p-3">
      <legend className="flex w-full items-center justify-between gap-3 px-1 text-sm font-medium text-ink-2">
        {label}
      </legend>
      <TextField
        label={f.linkLabel}
        value={value.label}
        max={80}
        onChange={(labelText) => onChange({ ...value, label: labelText })}
      />
      <TextField
        label={f.linkUrl}
        value={value.url}
        max={500}
        placeholder={placeholderUrl}
        onChange={(url) => onChange({ ...value, url: url.trim() })}
      />
      <button
        type="button"
        onClick={() => onChange(null)}
        className="self-start text-[13px] text-muted hover:text-[#ffb3b3]"
      >
        {f.removeLink}
      </button>
    </fieldset>
  );
}

export function ChipsField({
  label,
  value,
  onChange,
  max = 8,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");

  function commit() {
    const items = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length) onChange([...value, ...items].slice(0, max));
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((chip, i) => (
            <li key={`${chip}-${i}`}>
              <Chip className="pr-1.5">
                {chip}
                <button
                  type="button"
                  aria-label={`${f.removeItem}: ${chip}`}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  className="grid size-5 place-items-center rounded-full text-muted hover:text-ink"
                >
                  <Icon name="close" size={12} />
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <Input
          id={id}
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
        />
      )}
      <span className="text-[13px] text-muted">{f.chipsHint}</span>
    </div>
  );
}

/** A list of sub-items with add / remove / move. */
export function ListField<T>({
  label,
  items,
  onChange,
  make,
  max,
  min = 1,
  title,
  children,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  make: () => T;
  max: number;
  min?: number;
  title: (item: T, index: number) => string;
  children: (item: T, update: (item: T) => void, index: number) => ReactNode;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <ol className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-md border border-line bg-bg p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                <span className="mr-2 font-mono text-[13px] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {title(item, i)}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-muted">
                <button
                  type="button"
                  aria-label={ru.builder.moveUp}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="grid size-8 place-items-center rounded-sm hover:text-ink disabled:opacity-30"
                >
                  <Icon name="up" size={16} />
                </button>
                <button
                  type="button"
                  aria-label={ru.builder.moveDown}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="grid size-8 place-items-center rounded-sm hover:text-ink disabled:opacity-30"
                >
                  <Icon name="down" size={16} />
                </button>
                <button
                  type="button"
                  aria-label={f.removeItem}
                  disabled={items.length <= min}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="grid size-8 place-items-center rounded-sm hover:text-[#ffb3b3] disabled:opacity-30"
                >
                  <Icon name="trash" size={16} />
                </button>
              </span>
            </div>
            {children(item, (next) => onChange(items.map((it, j) => (j === i ? next : it))), i)}
          </li>
        ))}
      </ol>
      {items.length < max && (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => onChange([...items, make()])}
        >
          <Icon name="plus" size={16} />
          {f.addItem}
        </Button>
      )}
    </div>
  );
}

type UploadResult = { id: string; url: string; width: number | null; height: number | null };

/** Uploads to `/api/media` (multipart); the server re-encodes images to WebP. */
export function MediaField({
  label,
  purpose,
  value,
  onChange,
}: {
  label: string;
  purpose: "image" | "resume";
  value: MediaRef | null;
  onChange: (value: MediaRef | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", purpose);
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      const result = await parseResponse<UploadResult>(response);
      if (result.ok) {
        const { id, url, width, height } = result.data;
        onChange({ id, url, width, height });
      } else {
        setError(f.uploadError.replace("{reason}", siteErrorText(result.error.code)));
      }
    } catch {
      setError(f.uploadError.replace("{reason}", siteErrorText("network")));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-2">{label}</span>
      <div className="flex items-center gap-3">
        {value &&
          (purpose === "image" ? (
            <Image
              src={value.url}
              alt=""
              width={56}
              height={56}
              unoptimized
              className="size-14 rounded-full border border-line-2 object-cover"
            />
          ) : (
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[13px] text-accent"
            >
              PDF
            </a>
          ))}
        <input
          ref={input}
          type="file"
          hidden
          accept={
            purpose === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "application/pdf"
          }
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? f.uploading : value ? f.replace : f.upload}
        </Button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[13px] text-muted hover:text-[#ffb3b3]"
          >
            {f.removeFile}
          </button>
        )}
      </div>
      {error && (
        <span role="alert" className="text-[13px] text-[#ff6b6b]">
          {error}
        </span>
      )}
    </div>
  );
}

export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  return (
    <Field label={label}>
      {({ id }) => (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as V)}
          className="h-12 rounded-md border border-line-2 bg-surface px-3 text-base text-ink"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

/** Integer input; an empty field becomes `fallback` (or null when allowed). */
export function NumberField<N extends number | null>({
  label,
  value,
  onChange,
  min,
  max,
  fallback,
  hint,
}: {
  label: string;
  value: N;
  onChange: (value: N) => void;
  min: number;
  max: number;
  fallback: N;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {({ id, describedBy }) => (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value ?? ""}
          aria-describedby={describedBy}
          onChange={(e) => {
            const raw = e.target.value;
            const n = Number.parseInt(raw, 10);
            onChange((raw === "" || Number.isNaN(n) ? fallback : n) as N);
          }}
        />
      )}
    </Field>
  );
}

/** A title from the owner's catalog (optionally only of one kind). */
export function TitlePicker({
  label,
  value,
  onChange,
  kind,
  allowEmpty = true,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  kind?: string;
  allowEmpty?: boolean;
}) {
  const index = useCatalog();
  const titles = index.catalog.titles.filter((t) => !kind || t.kind === kind);
  const kinds = ru.catalog.kindOne;
  return (
    <Field label={label} hint={titles.length ? undefined : ru.catalog.empty}>
      {({ id, describedBy }) => (
        <select
          id={id}
          value={value ?? ""}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-12 rounded-md border border-line-2 bg-surface px-3 text-base text-ink"
        >
          {(allowEmpty || !value) && <option value="">{ru.catalog.fields.noTitle}</option>}
          {titles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.year ? ` (${t.year})` : ""} · {kinds[t.kind]}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
