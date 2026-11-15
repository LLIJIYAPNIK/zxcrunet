"use client";

import Link from "next/link";
import { useState } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { adminErrorText, formatDateTime, PAGE_SIZE } from "@/lib/admin/admin";
import { api, type AdminDomain } from "@/lib/api/client";
import { problemText } from "@/lib/domains/domains";
import { ru } from "@/i18n/ru";

import {
  Filters,
  LoadState,
  PageHead,
  Pager,
  SearchBox,
  useAdminData,
  useAsk,
  type Notice,
} from "./parts";
import { domainStatusText, domainTone, Row, Rows, StatusChip } from "./rows";

const t = ru.admin.domains;
const STATUSES = ["pending", "verified", "active", "failed", "lost"] as const;
type Status = (typeof STATUSES)[number];

/** Where the records must point, as the API listed them for this domain. */
function serverOf(domain: AdminDomain) {
  const values = (type: string) =>
    domain.records.filter((r) => r.type === type).map((r) => r.value);
  return { ipv4: values("A"), ipv6: values("AAAA") };
}

/** Custom domains with manual confirm and revoke; `siteId` shows one site only. */
export function DomainsList({ siteId }: { siteId?: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const { ask, dialog } = useAsk();
  const { data, setData, error } = useAdminData(
    () =>
      api.get("/api/admin/domains", {
        query: {
          q: q || undefined,
          status: status || undefined,
          site_id: siteId,
          offset,
          limit: PAGE_SIZE,
        },
      }),
    `${q}|${status}|${siteId}|${offset}`,
  );

  const replace = (domain: AdminDomain) =>
    setData((d) =>
      d ? { ...d, items: d.items.map((x) => (x.id === domain.id ? domain : x)) } : d,
    );

  async function confirmDomain(domain: AdminDomain) {
    const ok = await ask({
      title: t.confirmTitle.replace("{host}", domain.host),
      text: t.confirmText,
      confirmLabel: t.confirm,
    });
    if (ok === null) return;
    const result = await api.post("/api/admin/domains/{domain_id}/confirm", {
      path: { domain_id: domain.id },
    });
    if (!result.ok) return setNotice({ tone: "error", text: adminErrorText(result.error.code) });
    replace(result.data);
    setNotice(null);
  }

  async function revoke(domain: AdminDomain) {
    const reason = await ask({
      title: t.revokeTitle.replace("{host}", domain.host),
      text: t.revokeText,
      confirmLabel: t.revoke,
      danger: true,
      reason: { label: ru.admin.reasonLabel, hint: ru.admin.reasonHint, required: true },
    });
    if (reason === null) return;
    const result = await api.post("/api/admin/domains/{domain_id}/revoke", {
      path: { domain_id: domain.id },
      body: { reason },
    });
    if (!result.ok) return setNotice({ tone: "error", text: adminErrorText(result.error.code) });
    replace(result.data);
    setNotice(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      {!siteId && (
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
            options={STATUSES.map((value) => ({ value, label: domainStatusText(value) }))}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setOffset(0);
            }}
          />
        </div>
      )}
      {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
      <LoadState error={error} loading={!data} />
      {data && data.items.length === 0 && siteId && (
        <p className="text-ink-2">{ru.admin.sites.noDomains}</p>
      )}
      {data && data.items.length > 0 && (
        <Rows>
          {data.items.map((domain) => {
            const serving = domain.status === "active" || domain.status === "verified";
            return (
              <Row
                key={domain.id}
                title={<span className="font-mono">{domain.host}</span>}
                meta={
                  <>
                    {!siteId && domain.site_host && (
                      <Link
                        href={`/admin/sites/${domain.site_id}`}
                        className="font-mono text-accent hover:underline"
                      >
                        {domain.site_host}
                      </Link>
                    )}
                    {!siteId && <span>{domain.owner_email ?? domain.owner_id}</span>}
                    <span>{formatDateTime(domain.created_at)}</span>
                    <span>{t.attempts.replace("{n}", String(domain.attempts))}</span>
                  </>
                }
                side={
                  <>
                    <StatusChip tone={domain.revoked ? "bad" : domainTone(domain.status)}>
                      {domain.revoked ? t.revoked : domainStatusText(domain.status)}
                    </StatusChip>
                    {!serving && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void confirmDomain(domain)}
                      >
                        {t.confirm}
                      </Button>
                    )}
                    {!domain.revoked && (
                      <Button size="sm" variant="secondary" onClick={() => void revoke(domain)}>
                        {t.revoke}
                      </Button>
                    )}
                  </>
                }
              >
                {domain.problems.length > 0 && (
                  <ul className="flex flex-col gap-1 text-[13px] text-ink-2">
                    {domain.problems.map((p) => (
                      <li key={p.code}>{problemText(p, domain, serverOf(domain))}</li>
                    ))}
                  </ul>
                )}
              </Row>
            );
          })}
        </Rows>
      )}
      {data && (!siteId || data.total > PAGE_SIZE) && (
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

export function DomainsAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title={t.title} />
      <DomainsList />
    </div>
  );
}
