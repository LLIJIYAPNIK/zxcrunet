"use client";

import { useState, type FormEvent } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { adminErrorText } from "@/lib/admin/admin";
import { api, type AdminPlan } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { LoadState, PageHead, useAdminData, type Notice } from "./parts";

const t = ru.admin.plans;

type Limits = Omit<AdminPlan, "code">;

const LIMITS = [
  ["max_sites", t.maxSites, 0, 1000],
  ["max_custom_domains", t.maxDomains, 0, 1000],
  ["max_upload_mb", t.maxUpload, 1, 100],
  ["max_video_mb", t.maxVideo, 1, 100],
] as const;

function PlanFields({ value, onChange }: { value: Limits; onChange: (value: Limits) => void }) {
  return (
    <>
      <Field label={t.name}>
        {({ id }) => (
          <Input
            id={id}
            value={value.title}
            maxLength={64}
            required
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        )}
      </Field>
      <div className="grid grid-cols-3 gap-3">
        {LIMITS.map(([key, label, min, max]) => (
          <Field key={key} label={label}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                required
                value={String(value[key])}
                onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
              />
            )}
          </Field>
        ))}
      </div>
    </>
  );
}

function PlanCard({ plan, onSaved }: { plan: AdminPlan; onSaved: (plan: AdminPlan) => void }) {
  const [value, setValue] = useState<Limits>(plan);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await api.put("/api/admin/plans/{code}", {
      path: { code: plan.code },
      body: {
        title: value.title,
        max_sites: value.max_sites,
        max_custom_domains: value.max_custom_domains,
        max_upload_mb: value.max_upload_mb,
        max_video_mb: value.max_video_mb,
      },
    });
    setBusy(false);
    if (!result.ok) return setNotice({ tone: "error", text: adminErrorText(result.error.code) });
    onSaved(result.data);
    setNotice({ tone: "ok", text: ru.admin.saved });
  }

  return (
    <Card>
      <form onSubmit={save} className="flex flex-col gap-4" aria-label={plan.title}>
        <span className="font-mono text-sm text-muted">
          {t.code}: {plan.code}
        </span>
        <PlanFields value={value} onChange={setValue} />
        {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
        <Button type="submit" variant="secondary" className="self-start" disabled={busy}>
          {ru.admin.save}
        </Button>
      </form>
    </Card>
  );
}

const EMPTY: Limits = {
  title: "",
  max_sites: 3,
  max_custom_domains: 3,
  max_upload_mb: 10,
  max_video_mb: 15,
};

export function PlansAdmin() {
  const { data, setData, error } = useAdminData(() => api.get("/api/admin/plans"), "plans");
  const [code, setCode] = useState("");
  const [draft, setDraft] = useState<Limits>(EMPTY);
  const [notice, setNotice] = useState<Notice>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    const result = await api.post("/api/admin/plans", { body: { code, ...draft } });
    if (!result.ok) return setNotice({ tone: "error", text: adminErrorText(result.error.code) });
    setData((d) => (d ? { items: [...d.items, result.data] } : d));
    setCode("");
    setDraft(EMPTY);
    setNotice(null);
  }

  const saved = (plan: AdminPlan) =>
    setData((d) => (d ? { items: d.items.map((p) => (p.code === plan.code ? plan : p)) } : d));

  return (
    <div className="flex flex-col gap-6">
      <PageHead title={t.title} lead={t.lead} />
      <LoadState error={error} loading={!data} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-6">
        {data?.items.map((plan) => (
          <PlanCard key={plan.code} plan={plan} onSaved={saved} />
        ))}
        <Card className="border-dashed">
          <form onSubmit={create} className="flex flex-col gap-4" aria-label={t.create}>
            <h2 className="font-display text-h3 font-medium">{t.create}</h2>
            <Field label={t.code}>
              {({ id }) => (
                <Input
                  id={id}
                  value={code}
                  maxLength={32}
                  required
                  pattern="[a-z0-9-]+"
                  onChange={(e) => setCode(e.target.value.toLowerCase())}
                />
              )}
            </Field>
            <PlanFields value={draft} onChange={setDraft} />
            {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
            <Button type="submit" className="self-start">
              {t.add}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
