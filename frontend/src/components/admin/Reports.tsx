"use client";

import Link from "next/link";
import { useState } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { adminErrorText, formatDateTime, PAGE_SIZE } from "@/lib/admin/admin";
import { api, type AdminReport } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { Filters, LoadState, PageHead, Pager, useAdminData, useAsk, type Notice } from "./parts";
import { Row, Rows, StatusChip } from "./rows";

const t = ru.admin.reports;
const STATUSES = ["open", "resolved", "dismissed"] as const;
type Status = (typeof STATUSES)[number];

/** The report queue: open ones oldest first; `siteId` shows one site with every status. */
export function ReportsList({ siteId }: { siteId?: string }) {
  const [status, setStatus] = useState<Status | "">(siteId ? "" : "open");
  const [offset, setOffset] = useState(0);
  const [round, setRound] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const { ask, dialog } = useAsk();
  const { data, error } = useAdminData(
    () =>
      api.get("/api/admin/reports", {
        query: { status: status || undefined, site_id: siteId, offset, limit: PAGE_SIZE },
      }),
    `${status}|${siteId}|${offset}|${round}`,
  );

  async function decide(report: AdminReport, decision: "suspend" | "dismiss") {
    const suspend = decision === "suspend";
    const note = await ask({
      title: suspend ? t.suspendTitle.replace("{host}", report.host) : t.dismissTitle,
      text: suspend ? t.suspendText : t.dismissText,
      confirmLabel: suspend ? t.suspend : t.dismiss,
      danger: suspend,
      reason: {
        label: suspend ? ru.admin.reasonLabel : ru.admin.noteLabel,
        hint: suspend ? ru.admin.reasonHint : undefined,
        required: suspend,
      },
    });
    if (note === null) return;
    const result = await api.post("/api/admin/reports/{report_id}/decision", {
      path: { report_id: report.id },
      body: { decision, note },
    });
    if (!result.ok) {
      setNotice({ tone: "error", text: adminErrorText(result.error.code) });
      return;
    }
    setNotice(null);
    setRound((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      {!siteId && (
        <Filters
          label={ru.admin.search}
          options={STATUSES.map((value) => ({
            value,
            label: t.status[value],
            count: data?.counts[value],
          }))}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setOffset(0);
          }}
        />
      )}
      {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
      <LoadState error={error} loading={!data} />
      {data && data.items.length === 0 && (
        <p className="text-ink-2">{siteId ? ru.admin.sites.noReports : ru.admin.empty}</p>
      )}
      {data && data.items.length > 0 && (
        <Rows>
          {data.items.map((report) => (
            <Row
              key={report.id}
              title={t.reason[report.reason]}
              meta={
                <>
                  <span className="font-mono">{formatDateTime(report.created_at)}</span>
                  {!siteId && (
                    <Link
                      href={`/admin/sites/${report.site_id}`}
                      className="font-mono text-accent hover:underline"
                    >
                      {report.host}
                    </Link>
                  )}
                  <span className="font-mono">{t.page.replace("{path}", report.path)}</span>
                </>
              }
              side={
                report.status === "open" ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void decide(report, "dismiss")}
                    >
                      {t.dismiss}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void decide(report, "suspend")}
                    >
                      {t.suspend}
                    </Button>
                  </>
                ) : (
                  <StatusChip tone={report.status === "resolved" ? "bad" : "muted"}>
                    {t.status[report.status]}
                  </StatusChip>
                )
              }
            >
              <p className="whitespace-pre-line text-ink-2">{report.message || t.noMessage}</p>
              {report.decided_at && (
                <p className="text-[13px] text-muted">
                  {t.decided.replace("{time}", formatDateTime(report.decided_at))}
                  {report.note && ` · ${report.note}`}
                </p>
              )}
            </Row>
          ))}
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

export function ReportsAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title={t.title} />
      <ReportsList />
    </div>
  );
}
