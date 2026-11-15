"use client";

import Link from "next/link";
import { useState } from "react";

import { META } from "@/blocks/schemas";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { formatCount } from "@/lib/admin/admin";
import { api, type DashboardData } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { DayBars } from "./DayBars";
import { LoadState, PageHead, useAdminData } from "./parts";

const t = ru.admin.overview;
const PERIODS = ["7", "30", "90"] as const;
type Period = (typeof PERIODS)[number];

function blockTitle(type: string): string {
  return type in META ? META[type as keyof typeof META].title : type;
}

function Tile({
  label,
  value,
  notes,
  href,
}: {
  label: string;
  value: number;
  notes: string[];
  href?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-5 sm:p-6">
      <span className="text-sm text-ink-2">{label}</span>
      <b className="font-display text-stat font-medium">{formatCount(value)}</b>
      <span className="flex flex-wrap gap-x-3 text-[13px] text-muted">
        {notes.map((n) => (
          <span key={n}>{n}</span>
        ))}
        {href && (
          <Link href={href} className="text-accent hover:underline">
            {t.toReports}
          </Link>
        )}
      </span>
    </Card>
  );
}

export function Overview() {
  const [period, setPeriod] = useState<Period>("30");
  const { data, error } = useAdminData(
    () => api.get("/api/admin/dashboard", { query: { days: Number(period) } }),
    period,
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHead title={t.title}>
        <Segmented
          label={t.period}
          options={PERIODS.map((p) => ({ value: p, label: t.days.replace("{days}", p) }))}
          value={period}
          onChange={setPeriod}
          className="w-full sm:w-72"
        />
      </PageHead>
      <LoadState error={error} loading={!data} />
      {data && <Figures data={data} />}
    </div>
  );
}

function Figures({ data }: { data: DashboardData }) {
  const signups = data.registrations.reduce((sum, r) => sum + r.count, 0);
  const views = data.views.reduce((sum, v) => sum + v.views, 0);
  const visitors = data.views.reduce((sum, v) => sum + v.visitors, 0);
  const sites = (status: string) => data.sites[status] ?? 0;
  const domains = (status: string) => data.domains[status] ?? 0;
  const topBlock = Math.max(1, ...data.blocks.map((b) => b.blocks));

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
        <Tile label={t.users} value={data.users} notes={[`+${signups} ${t.newUsers}`]} />
        <Tile
          label={t.published}
          value={sites("published")}
          notes={[
            t.drafts.replace("{n}", String(sites("draft"))),
            t.suspended.replace("{n}", String(sites("suspended"))),
          ]}
        />
        <Tile
          label={t.domains}
          value={domains("active") + domains("verified")}
          notes={[t.domainsPending.replace("{n}", String(domains("pending")))]}
        />
        <Tile
          label={t.reports}
          value={data.open_reports}
          notes={[]}
          href={data.open_reports > 0 ? "/admin/reports" : undefined}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-8">
          <DayBars
            title={t.views}
            summary={t.total.replace("{n}", formatCount(views))}
            data={data.views.map((v) => ({ day: v.day, value: v.views }))}
          />
          <DayBars
            title={t.visitors}
            summary={t.total.replace("{n}", formatCount(visitors))}
            data={data.views.map((v) => ({ day: v.day, value: v.visitors }))}
            height={96}
          />
          <p className="text-[13px] text-muted">{t.privacy}</p>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <DayBars
              title={t.registrations}
              summary={t.total.replace("{n}", formatCount(signups))}
              data={data.registrations.map((r) => ({ day: r.day, value: r.count }))}
              height={96}
            />
          </Card>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-medium text-ink">{t.blocks}</h2>
              <p className="text-sm text-muted">{t.blocksLead}</p>
            </div>
            {data.blocks.length === 0 ? (
              <p className="text-ink-2">{t.blocksEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.blocks.map((b) => (
                  <li key={b.type} className="flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">{blockTitle(b.type)}</span>
                      <span className="font-mono text-ink-2">
                        {b.blocks}{" "}
                        <span className="text-muted">
                          {t.blockSites.replace("{n}", String(b.sites))}
                        </span>
                      </span>
                    </span>
                    <span className="h-1.5 rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(b.blocks / topBlock) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
