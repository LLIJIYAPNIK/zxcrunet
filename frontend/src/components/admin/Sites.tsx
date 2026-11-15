"use client";

import Link from "next/link";
import { useState } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { adminErrorText, formatDateTime, PAGE_SIZE } from "@/lib/admin/admin";
import { api, type AdminSite, type ApiResult } from "@/lib/api/client";
import { siteUrl } from "@/config/site";
import { ru } from "@/i18n/ru";

import { AuditList } from "./Audit";
import { DayBars } from "./DayBars";
import { DomainsList } from "./Domains";
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
import { ReportsList } from "./Reports";
import { Row, Rows, siteStatusText, siteTone, StatusChip } from "./rows";

const t = ru.admin.sites;
const STATUSES = ["published", "draft", "suspended"] as const;
type Status = (typeof STATUSES)[number];

export function SitesList({ ownerId }: { ownerId?: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [offset, setOffset] = useState(0);
  const { data, error } = useAdminData(
    () =>
      api.get("/api/admin/sites", {
        query: {
          q: q || undefined,
          status: status || undefined,
          owner_id: ownerId,
          offset,
          limit: PAGE_SIZE,
        },
      }),
    `${q}|${status}|${ownerId}|${offset}`,
  );

  return (
    <div className="flex flex-col gap-4">
      {!ownerId && (
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
            options={STATUSES.map((value) => ({ value, label: siteStatusText(value) }))}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setOffset(0);
            }}
          />
        </div>
      )}
      <LoadState error={error} loading={!data} />
      {data && data.items.length === 0 && ownerId && (
        <p className="text-ink-2">{ru.admin.users.noSites}</p>
      )}
      {data && data.items.length > 0 && (
        <Rows>
          {data.items.map((site) => (
            <Row
              key={site.id}
              href={`/admin/sites/${site.id}`}
              title={
                <>
                  {site.title} <span className="font-mono text-ink-2">{site.host}</span>
                </>
              }
              meta={
                <>
                  <span>{ru.sites.kind[site.kind]}</span>
                  {!ownerId && <span>{site.owner_email ?? site.owner_id}</span>}
                  <span>{formatDateTime(site.created_at)}</span>
                </>
              }
              side={
                <StatusChip tone={siteTone(site.status)}>{siteStatusText(site.status)}</StatusChip>
              }
            />
          ))}
        </Rows>
      )}
      {data && (!ownerId || data.total > PAGE_SIZE) && (
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

export function SitesAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title={t.title} />
      <SitesList />
    </div>
  );
}

export function SiteCard({ siteId }: { siteId: string }) {
  const {
    data: site,
    setData,
    error,
  } = useAdminData(
    () => api.get("/api/admin/sites/{site_id}", { path: { site_id: siteId } }),
    siteId,
  );
  const views = useAdminData(
    () =>
      api.get("/api/admin/sites/{site_id}/views", {
        path: { site_id: siteId },
        query: { days: 30 },
      }),
    siteId,
  );
  const { ask, dialog } = useAsk();
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(0);

  async function act(next: Promise<ApiResult<AdminSite>>) {
    setBusy(true);
    const result = await next;
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "error", text: adminErrorText(result.error.code) });
      return;
    }
    setData(result.data);
    setNotice({ tone: "ok", text: ru.admin.saved });
    setHistory((n) => n + 1);
  }

  async function suspend(current: AdminSite) {
    const reason = await ask({
      title: t.suspendTitle.replace("{host}", current.host),
      text: t.suspendText,
      confirmLabel: t.suspend,
      danger: true,
      reason: { label: ru.admin.reasonLabel, hint: ru.admin.reasonHint, required: true },
    });
    if (reason === null) return;
    await act(
      api.post("/api/admin/sites/{site_id}/suspend", {
        path: { site_id: siteId },
        body: { reason },
      }),
    );
  }

  async function restore(current: AdminSite) {
    const ok = await ask({
      title: t.restoreTitle.replace("{host}", current.host),
      text: t.restoreText,
      confirmLabel: t.restore,
    });
    if (ok === null) return;
    await act(api.post("/api/admin/sites/{site_id}/restore", { path: { site_id: siteId } }));
  }

  if (!site) return <LoadState error={error} loading />;
  const viewTotal = (views.data?.days ?? []).reduce((sum, d) => sum + d.views, 0);

  return (
    <div className="flex flex-col gap-6">
      {dialog}
      <PageHead title={site.title}>
        <span className="flex flex-wrap gap-2">
          <StatusChip tone={siteTone(site.status)}>{siteStatusText(site.status)}</StatusChip>
          <Chip>{ru.sites.kind[site.kind]}</Chip>
        </span>
      </PageHead>
      {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="flex flex-col gap-5">
          <Facts
            items={[
              [
                ru.admin.domains.site,
                <a
                  key="host"
                  href={siteUrl(site.host)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-accent hover:underline"
                >
                  {site.host}
                  <Icon name="external" size={14} />
                </a>,
              ],
              [
                ru.admin.owner,
                <Link
                  key="owner"
                  href={`/admin/users/${site.owner_id}`}
                  className="text-accent hover:underline"
                >
                  {site.owner_email ?? site.owner_id}
                </Link>,
              ],
              [ru.admin.created, formatDateTime(site.created_at)],
              [t.publishedAt, formatDateTime(site.published_at)],
              [t.pagesLabel, String(site.pages)],
            ]}
          />
          {site.status === "suspended" && site.suspension_reason && (
            <p className="rounded-md border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-3.5 py-3 text-sm text-[#ffb3b3]">
              {t.suspendedBecause.replace("{reason}", site.suspension_reason)}
            </p>
          )}
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            {site.status === "suspended" ? (
              <Button onClick={() => void restore(site)} disabled={busy}>
                {t.restore}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => void suspend(site)} disabled={busy}>
                {t.suspend}
              </Button>
            )}
          </div>
        </Card>
        <Card>
          {views.data ? (
            <DayBars
              title={t.views}
              summary={ru.admin.overview.total.replace("{n}", String(viewTotal))}
              data={views.data.days.map((d) => ({ day: d.day, value: d.views }))}
              height={110}
            />
          ) : (
            <LoadState error={views.error} loading />
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-medium">{t.domains}</h2>
        <DomainsList siteId={siteId} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-medium">{t.reports}</h2>
        <ReportsList siteId={siteId} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-medium">{t.history}</h2>
        <AuditList key={history} targetId={siteId} compact />
      </section>
    </div>
  );
}
