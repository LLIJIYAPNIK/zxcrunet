"use client";

import { useState } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { adminErrorText, formatDateTime, PAGE_SIZE } from "@/lib/admin/admin";
import { api, type AdminUser, type ApiResult } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { AuditList } from "./Audit";
import {
  Facts,
  Filters,
  LoadState,
  PageHead,
  Pager,
  SearchBox,
  useAdminData,
  useAsk,
  type Notice,
} from "./parts";
import { Row, Rows, StatusChip } from "./rows";
import { SitesList } from "./Sites";

const t = ru.admin.users;
const STATUSES = ["active", "blocked"] as const;
type Status = (typeof STATUSES)[number];

export function UsersAdmin() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [offset, setOffset] = useState(0);
  const { data, error } = useAdminData(
    () =>
      api.get("/api/admin/users", {
        query: { q: q || undefined, status: status || undefined, offset, limit: PAGE_SIZE },
      }),
    `${q}|${status}|${offset}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHead title={t.title} />
      <div className="flex flex-col gap-3">
        <SearchBox
          label={t.search}
          onSearch={(value) => {
            setQ(value);
            setOffset(0);
          }}
        />
        <Filters
          label={ru.admin.search}
          options={STATUSES.map((value) => ({ value, label: t.status[value] }))}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setOffset(0);
          }}
        />
      </div>
      <LoadState error={error} loading={!data} />
      {data && data.items.length > 0 && (
        <Rows>
          {data.items.map((user) => (
            <Row
              key={user.id}
              href={`/admin/users/${user.id}`}
              title={user.email}
              meta={
                <>
                  <span>{formatDateTime(user.created_at)}</span>
                  <span>
                    {t.plan}: {user.plan}
                  </span>
                  {!user.email_verified && <span>{t.unverified}</span>}
                </>
              }
              side={
                <>
                  {user.role === "owner" && <StatusChip tone="ok">{t.role.owner}</StatusChip>}
                  {user.status === "blocked" && (
                    <StatusChip tone="bad">{t.status.blocked}</StatusChip>
                  )}
                </>
              }
            />
          ))}
        </Rows>
      )}
      {data && (
        <Pager
          offset={offset}
          count={data.items.length}
          total={data.total}
          limit={PAGE_SIZE}
          onChange={setOffset}
        />
      )}
    </div>
  );
}

export function UserCard({ userId }: { userId: string }) {
  const {
    data: user,
    setData,
    error,
  } = useAdminData(
    () => api.get("/api/admin/users/{user_id}", { path: { user_id: userId } }),
    userId,
  );
  const plans = useAdminData(() => api.get("/api/admin/plans"), "plans");
  const [plan, setPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(0);
  const { ask, dialog } = useAsk();

  async function done(result: ApiResult<AdminUser>) {
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: adminErrorText(result.error.code) });
      return;
    }
    setData(result.data);
    setNotice({ tone: "ok", text: ru.admin.saved });
    setHistory((n) => n + 1);
  }

  async function block(current: AdminUser) {
    const reason = await ask({
      title: t.blockTitle.replace("{email}", current.email),
      text: t.blockText,
      confirmLabel: t.block,
      danger: true,
      reason: { label: ru.admin.reasonLabel, hint: ru.admin.reasonHint },
    });
    if (reason === null) return;
    setBusy(true);
    await done(
      await api.post("/api/admin/users/{user_id}/block", {
        path: { user_id: userId },
        body: { reason },
      }),
    );
  }

  async function unblock(current: AdminUser) {
    const ok = await ask({
      title: t.unblockTitle.replace("{email}", current.email),
      confirmLabel: t.unblock,
    });
    if (ok === null) return;
    setBusy(true);
    await done(await api.post("/api/admin/users/{user_id}/unblock", { path: { user_id: userId } }));
  }

  async function changePlan(code: string) {
    setBusy(true);
    await done(
      await api.put("/api/admin/users/{user_id}/plan", {
        path: { user_id: userId },
        body: { plan: code },
      }),
    );
  }

  if (!user) return <LoadState error={error} loading />;
  const selected = plan ?? user.plan;

  return (
    <div className="flex flex-col gap-6">
      {dialog}
      <PageHead title={user.email}>
        <span className="flex flex-wrap gap-2">
          {user.role === "owner" && <StatusChip tone="ok">{t.role.owner}</StatusChip>}
          <StatusChip tone={user.status === "blocked" ? "bad" : "ok"}>
            {t.status[user.status]}
          </StatusChip>
        </span>
      </PageHead>
      {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-5">
          <Facts
            items={[
              [ru.admin.created, formatDateTime(user.created_at)],
              [t.plan, user.plan],
              [t.emailLabel, user.email_verified ? t.verified : t.unverified],
              [
                t.idLabel,
                <span key="id" className="font-mono text-sm">
                  {user.id}
                </span>,
              ],
            ]}
          />
          {user.role !== "owner" && (
            <div className="flex flex-wrap gap-3 border-t border-line pt-4">
              {user.status === "blocked" ? (
                <Button onClick={() => void unblock(user)} disabled={busy}>
                  {t.unblock}
                </Button>
              ) : (
                <Button variant="danger" onClick={() => void block(user)} disabled={busy}>
                  {t.block}
                </Button>
              )}
            </div>
          )}
        </Card>
        <Card className="flex flex-col gap-4">
          <Field label={t.changePlan}>
            {({ id }) => (
              <select
                id={id}
                value={selected}
                onChange={(e) => setPlan(e.target.value)}
                className="h-12 rounded-md border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-accent"
              >
                {(plans.data?.items ?? [{ code: user.plan, title: user.plan }]).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.title} ({p.code})
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Button
            variant="secondary"
            className="self-start"
            disabled={busy || selected === user.plan}
            onClick={() => void changePlan(selected)}
          >
            {ru.admin.save}
          </Button>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-medium">{t.sites}</h2>
        <SitesList ownerId={userId} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-medium">{t.history}</h2>
        <AuditList key={history} targetId={userId} compact />
      </section>
    </div>
  );
}
