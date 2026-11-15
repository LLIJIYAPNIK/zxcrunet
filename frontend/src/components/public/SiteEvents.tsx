"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button, buttonClass } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { api } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

const t = ru.report;
const REASONS = Object.keys(ru.admin.reports.reason) as (keyof typeof ru.admin.reports.reason)[];
type Reason = (typeof REASONS)[number];

/**
 * Counts a view of each page the guest opens. Fire-and-forget: the page never waits for
 * it, and nothing is stored in the browser. The API counts no bots and keeps no IP.
 */
export function ViewBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    const body = JSON.stringify({ host: window.location.host, path: window.location.pathname });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/public/events/views", blob)) {
      void fetch("/api/public/events/views", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => undefined);
    }
  }, [pathname]);
  return null;
}

function errorText(code: string): string {
  return code in t.errors ? t.errors[code as keyof typeof t.errors] : t.errors.unknown;
}

/** «Пожаловаться» in the footer of every published site. */
export function ReportButton() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("spam");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setSent(false);
    setError(null);
    setMessage("");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await api.post("/api/public/events/reports", {
      body: {
        host: window.location.host,
        path: window.location.pathname,
        reason,
        message,
      },
    });
    setBusy(false);
    if (!result.ok) return setError(errorText(result.error.code));
    setSent(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-muted underline-offset-4 transition-colors hover:text-ink-2 hover:underline"
      >
        {t.open}
      </button>
      {open && (
        <Dialog
          title={t.title}
          onClose={close}
          footer={
            sent ? (
              <button
                type="button"
                onClick={close}
                className={buttonClass({ variant: "secondary" })}
              >
                {t.close}
              </button>
            ) : undefined
          }
        >
          {sent ? (
            <FormMessage tone="ok">{t.sent}</FormMessage>
          ) : (
            <form onSubmit={send} className="flex flex-col gap-4">
              <p className="text-ink-2">{t.lead}</p>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-ink-2">{t.reasonLabel}</legend>
                {REASONS.map((value) => (
                  <label key={value} className="flex items-center gap-3 text-ink">
                    <input
                      type="radio"
                      name="reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    {ru.admin.reports.reason[value]}
                  </label>
                ))}
              </fieldset>
              <Field label={t.messageLabel} hint={t.messageHint}>
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    rows={3}
                    maxLength={1000}
                    required={reason === "other"}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                )}
              </Field>
              {error && <FormMessage tone="error">{error}</FormMessage>}
              <span className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={close}>
                  {ru.dialog.cancel}
                </Button>
                <Button type="submit" disabled={busy}>
                  {t.send}
                </Button>
              </span>
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}
