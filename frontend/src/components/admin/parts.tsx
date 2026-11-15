"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { adminErrorText, shownText } from "@/lib/admin/admin";
import type { ApiResult } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

const t = ru.admin;

export function PageHead({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-display text-h2 font-medium">{title}</h1>
        {lead && <p className="text-ink-2">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * Loads data on the client and reloads when `key` changes (filters, page).
 * The latest request wins: an older answer arriving late is dropped.
 */
export function useAdminData<T>(load: () => Promise<ApiResult<T>>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    const result = await loadRef.current();
    if (mine !== seq.current) return;
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(adminErrorText(result.error.code));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [key, reload]);

  return { data, setData, error, reload };
}

/** Search box that reports its value after the user pauses typing. */
export function SearchBox({
  label,
  onSearch,
}: {
  label: string;
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });
  useEffect(() => {
    const timer = window.setTimeout(() => onSearchRef.current(value.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [value]);
  return (
    <label className="flex min-w-0 flex-1 basis-64 items-center gap-2.5 rounded-md border border-line-2 bg-surface px-3.5 focus-within:border-accent">
      <Icon name="search" size={18} className="shrink-0 text-muted" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={label}
        className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
      />
    </label>
  );
}

type FilterOption<T extends string> = { value: T; label: string; count?: number };

/** One row of exclusive filter pills, «Все» first. */
export function Filters<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly FilterOption<T>[];
  value: T | "";
  onChange: (value: T | "") => void;
}) {
  const all: FilterOption<T | "">[] = [{ value: "", label: t.all }, ...options];
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {all.map((opt) => (
        <button
          key={opt.value || "all"}
          type="button"
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
            opt.value === value
              ? "border-accent bg-accent text-accent-ink"
              : "border-line-2 text-ink-2 hover:border-ink hover:text-ink",
          )}
        >
          {opt.label}
          {opt.count !== undefined && <span className="font-mono text-[13px]">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pager({
  offset,
  count,
  total,
  limit,
  onChange,
}: {
  offset: number;
  count: number;
  total: number;
  limit: number;
  onChange: (offset: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>{shownText(offset, count, total)}</span>
      {total > limit && (
        <span className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={offset === 0}
            onClick={() => onChange(Math.max(0, offset - limit))}
          >
            {t.prev}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={offset + count >= total}
            onClick={() => onChange(offset + limit)}
          >
            {t.next}
          </Button>
        </span>
      )}
    </div>
  );
}

export function LoadState({ error, loading }: { error: string | null; loading: boolean }) {
  if (error) return <FormMessage tone="error">{error}</FormMessage>;
  if (loading) return <p className="text-ink-2">{t.loading}</p>;
  return null;
}

export type Notice = { tone: "ok" | "error"; text: string } | null;

type AskOptions = {
  title: string;
  text?: string;
  confirmLabel: string;
  danger?: boolean;
  /** Ask for a reason (or a note); `required` keeps the button off until it is typed. */
  reason?: { label: string; hint?: string; required?: boolean };
};

type Pending = AskOptions & { resolve: (value: string | null) => void };

/**
 * A confirmation that can also collect a reason: `await ask({...})` gives the text
 * (empty when no reason is asked), or null when the owner cancels.
 */
export function useAsk(): {
  ask: (options: AskOptions) => Promise<string | null>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");

  const ask = useCallback(
    (options: AskOptions) =>
      new Promise<string | null>((resolve) => {
        setText("");
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = (value: string | null) => {
    pending?.resolve(value);
    setPending(null);
  };

  const blocked = Boolean(pending?.reason?.required) && text.trim().length === 0;
  const dialog = pending ? (
    <Dialog
      title={pending.title}
      onClose={() => settle(null)}
      footer={
        <>
          <button
            type="button"
            onClick={() => settle(null)}
            className={buttonClass({ variant: "secondary" })}
          >
            {ru.dialog.cancel}
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => settle(text.trim())}
            className={buttonClass({ variant: pending.danger ? "danger" : "primary" })}
          >
            {pending.confirmLabel}
          </button>
        </>
      }
    >
      {pending.text && <p className="text-ink-2">{pending.text}</p>}
      {pending.reason && (
        <Field label={pending.reason.label} hint={pending.reason.hint}>
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              autoFocus
              rows={3}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
      )}
    </Dialog>
  ) : null;

  return { ask, dialog };
}

/** Label + value pairs of a card. */
export function Facts({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-muted">{label}</dt>
          <dd className="min-w-0 break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
