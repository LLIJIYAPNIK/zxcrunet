"use client";

import { useState, type FormEvent } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { adminErrorText } from "@/lib/admin/admin";
import { api, type ReservedName } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { LoadState, PageHead, useAdminData, useAsk, type Notice } from "./parts";
import { Row, Rows, StatusChip } from "./rows";

const t = ru.admin.reserved;

export function ReservedAdmin() {
  const { data, setData, error } = useAdminData(
    () => api.get("/api/admin/reserved-slugs"),
    "reserved",
  );
  const [slug, setSlug] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const { ask, dialog } = useAsk();

  async function add(event: FormEvent) {
    event.preventDefault();
    const result = await api.post("/api/admin/reserved-slugs", { body: { slug, reason } });
    if (!result.ok) return setNotice({ tone: "error", text: adminErrorText(result.error.code) });
    setData((d) =>
      d ? { items: [...d.items, result.data].sort((a, b) => a.slug.localeCompare(b.slug)) } : d,
    );
    setSlug("");
    setReason("");
    setNotice(null);
  }

  async function release(name: ReservedName) {
    const ok = await ask({
      title: t.releaseTitle.replace("{slug}", name.slug),
      text: t.releaseText,
      confirmLabel: t.release,
      danger: true,
    });
    if (ok === null) return;
    const result = await api.delete("/api/admin/reserved-slugs/{slug}", {
      path: { slug: name.slug },
    });
    if (!result.ok) return setNotice({ tone: "error", text: adminErrorText(result.error.code) });
    setData((d) => (d ? { items: d.items.filter((n) => n.slug !== name.slug) } : d));
  }

  return (
    <div className="flex flex-col gap-6">
      {dialog}
      <PageHead title={t.title} lead={t.lead} />
      <Card>
        <form
          onSubmit={add}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
          aria-label={t.add}
        >
          <div className="sm:w-56">
            <Field label={t.slug}>
              {({ id }) => (
                <Input
                  id={id}
                  value={slug}
                  required
                  maxLength={32}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                />
              )}
            </Field>
          </div>
          <div className="min-w-0 flex-1">
            <Field label={t.reason}>
              {({ id }) => (
                <Input
                  id={id}
                  value={reason}
                  maxLength={120}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Button type="submit">{t.add}</Button>
        </form>
      </Card>
      {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
      <LoadState error={error} loading={!data} />
      {data && data.items.length > 0 && (
        <Rows>
          {data.items.map((name) => (
            <Row
              key={name.slug}
              title={<span className="font-mono">{name.slug}</span>}
              meta={name.reason ? <span>{name.reason}</span> : undefined}
              side={
                <>
                  {name.in_use && <StatusChip tone="warn">{t.inUse}</StatusChip>}
                  <Button size="sm" variant="secondary" onClick={() => void release(name)}>
                    {t.release}
                  </Button>
                </>
              }
            />
          ))}
        </Rows>
      )}
    </div>
  );
}
