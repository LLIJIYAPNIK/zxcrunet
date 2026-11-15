"use client";

import { useState } from "react";

import { actionText, auditSubject, formatDateTime, PAGE_SIZE } from "@/lib/admin/admin";
import { api } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

import { Filters, LoadState, PageHead, Pager, useAdminData } from "./parts";
import { Row, Rows } from "./rows";

const t = ru.admin.audit;
type Target = keyof typeof t.targets;
const TARGETS = Object.keys(t.targets) as Target[];

/** Owner actions, newest first; `targetId` narrows it to one user, site, domain… */
export function AuditList({ targetId, compact = false }: { targetId?: string; compact?: boolean }) {
  const [target, setTarget] = useState<Target | "">("");
  const [offset, setOffset] = useState(0);
  const limit = compact ? 20 : PAGE_SIZE;
  const { data, error } = useAdminData(
    () =>
      api.get("/api/admin/audit", {
        query: {
          target_type: target || undefined,
          target_id: targetId,
          offset,
          limit,
        },
      }),
    `${target}|${targetId}|${offset}`,
  );

  return (
    <div className="flex flex-col gap-4">
      {!compact && (
        <Filters
          label={t.target}
          options={TARGETS.map((value) => ({ value, label: t.targets[value] }))}
          value={target}
          onChange={(value) => {
            setTarget(value);
            setOffset(0);
          }}
        />
      )}
      <LoadState error={error} loading={!data} />
      {data && data.items.length > 0 && (
        <Rows>
          {data.items.map((entry) => (
            <Row
              key={entry.id}
              title={actionText(entry.action)}
              meta={
                <>
                  <span className="font-mono">{formatDateTime(entry.at)}</span>
                  <span>{entry.actor_email ?? entry.actor_id}</span>
                  <span className="min-w-0 text-ink-2 [overflow-wrap:anywhere]">
                    {auditSubject(entry)}
                  </span>
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
          limit={limit}
          onChange={setOffset}
        />
      )}
    </div>
  );
}

export function AuditAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <PageHead title={t.title} lead={t.lead} />
      <AuditList />
    </div>
  );
}
