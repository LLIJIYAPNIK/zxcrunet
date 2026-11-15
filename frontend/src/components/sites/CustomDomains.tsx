"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

import { FormMessage } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { useConfirm } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { api, type CustomDomain, type SiteDomains } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import {
  formatTime,
  inProgress,
  isServing,
  problemText,
  registeredZone,
  shortName,
} from "@/lib/domains/domains";
import { ru } from "@/i18n/ru";

import { siteErrorText } from "./errors";

const t = ru.sites.domains;
/** While a domain waits for DNS or a certificate, the page asks for news this often. */
const REFRESH_MS = 30_000;

type Notice = { tone: "ok" | "error"; text: string } | null;

function errorText(code: string, details: Record<string, unknown>, max: number): string {
  if (code === "plan_limit_exceeded") {
    return t.limitReached.replace("{max}", String(details.allowed ?? max));
  }
  return siteErrorText(code);
}

type CustomDomainsProps = { siteId: string; live: boolean; initial: SiteDomains | null };

export function CustomDomains({ siteId, live, initial }: CustomDomainsProps) {
  const [data, setData] = useState<SiteDomains | null>(initial);
  const [failed, setFailed] = useState(initial === null);
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    const result = await api.get("/api/sites/{site_id}/domains", { path: { site_id: siteId } });
    if (result.ok) {
      setData(result.data);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, [siteId]);

  const waiting = data ? inProgress(data.domains) : false;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [waiting, load]);

  const replace = (domain: CustomDomain) =>
    setData((d) =>
      d ? { ...d, domains: d.domains.map((x) => (x.id === domain.id ? domain : x)) } : d,
    );

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setNotice(null);
    const result = await api.post("/api/sites/{site_id}/domains", {
      path: { site_id: siteId },
      body: { host },
    });
    setBusy(false);
    if (!result.ok) {
      setNotice({
        tone: "error",
        text: errorText(result.error.code, result.error.details, data.max_domains),
      });
      return;
    }
    setHost("");
    setData({ ...data, domains: [...data.domains, result.data], used: data.used + 1 });
  }

  async function remove(domain: CustomDomain) {
    const confirmed = await confirm({
      title: t.removeTitle,
      text: t.removeConfirm.replace("{host}", domain.host),
      confirmLabel: t.remove,
      danger: true,
    });
    if (!confirmed) return;
    const result = await api.delete("/api/domains/{domain_id}", {
      path: { domain_id: domain.id },
    });
    if (!result.ok) {
      setNotice({ tone: "error", text: siteErrorText(result.error.code) });
      return;
    }
    setData((d) =>
      d ? { ...d, domains: d.domains.filter((x) => x.id !== domain.id), used: d.used - 1 } : d,
    );
  }

  const full = data ? data.used >= data.max_domains : false;

  return (
    <Card className="flex flex-col gap-5">
      {dialog}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-h3 font-medium">{t.title}</h2>
        {data && (
          <span className="font-mono text-[13px] text-muted">
            {t.usage
              .replace("{used}", String(data.used))
              .replace("{max}", String(data.max_domains))}
          </span>
        )}
      </div>
      <p className="text-ink-2">{t.lead}</p>
      {!live && <p className="text-sm text-muted">{t.draftNote}</p>}
      {notice && <FormMessage tone={notice.tone}>{notice.text}</FormMessage>}
      {failed && !data && <FormMessage tone="error">{t.loadError}</FormMessage>}

      {data && (
        <>
          {data.domains.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {data.domains.map((domain) => (
                <DomainItem
                  key={domain.id}
                  domain={domain}
                  server={data.server}
                  onChange={replace}
                  onRemove={() => void remove(domain)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t.empty}</p>
          )}

          <form
            onSubmit={add}
            className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Field label={t.hostLabel}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder={t.hostPlaceholder}
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={253}
                    disabled={full}
                  />
                )}
              </Field>
            </div>
            <Button type="submit" variant="secondary" disabled={busy || !host.trim() || full}>
              <Icon name="plus" size={18} />
              {t.add}
            </Button>
          </form>
          {full && (
            <p className="text-sm text-muted">
              {t.limitReached.replace("{max}", String(data.max_domains))}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

const STATUS_CHIP: Record<CustomDomain["status"], ReactNode> = {
  pending: <Chip variant="dash">{t.status.pending}</Chip>,
  verified: <Chip variant="accent">{t.status.verified}</Chip>,
  active: <Chip variant="fill">{t.status.active}</Chip>,
  failed: <Chip className="border-[#ff6b6b]/50 text-[#ffb3b3]">{t.status.failed}</Chip>,
  lost: <Chip className="border-[#ff6b6b]/50 text-[#ffb3b3]">{t.status.lost}</Chip>,
};

type DomainItemProps = {
  domain: CustomDomain;
  server: SiteDomains["server"];
  onChange: (domain: CustomDomain) => void;
  onRemove: () => void;
};

function DomainItem({ domain, server, onChange, onRemove }: DomainItemProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = domain.status === "active";
  const zone = registeredZone(domain.host);
  const www = domain.records.find((r) => r.type === "CNAME");

  async function check() {
    setChecking(true);
    setError(null);
    const result = await api.post("/api/domains/{domain_id}/check", {
      path: { domain_id: domain.id },
    });
    setChecking(false);
    if (result.ok) onChange(result.data);
    else setError(siteErrorText(result.error.code));
  }

  return (
    <li className="flex flex-col gap-4 rounded-md border border-line bg-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[15px] break-all">{domain.host}</span>
        <span className="flex items-center gap-2">
          {STATUS_CHIP[domain.status]}
          {isServing(domain) && (
            <a
              href={`https://${domain.host}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              {t.open}
              <Icon name="external" size={14} />
            </a>
          )}
        </span>
      </div>
      <p className="text-sm text-ink-2">{t.statusHint[domain.status]}</p>

      {domain.problems.length > 0 && !done && (
        <ul className="flex flex-col gap-1.5 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/5 p-3">
          {domain.problems.map((problem, i) => (
            <li key={`${problem.code}-${i}`} className="text-sm text-[#ffb3b3]">
              {problemText(problem, domain, server)}
            </li>
          ))}
        </ul>
      )}

      {!done && (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium text-ink-2">{t.steps}</span>
          <ol className="flex flex-col gap-2">
            {domain.records.map((record) => (
              <RecordRow
                key={`${record.type}-${record.value}`}
                type={record.type}
                name={record.name}
                short={shortName(record.name, zone)}
                value={record.value}
              />
            ))}
          </ol>
          {www && <p className="text-sm text-muted">{t.wwwNote.replace("{apex}", www.value)}</p>}
        </div>
      )}

      {error && <FormMessage tone="error">{error}</FormMessage>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-[13px] text-muted">
          {domain.last_checked_at
            ? [
                t.lastChecked.replace("{time}", formatTime(domain.last_checked_at)),
                domain.next_check_at &&
                  t.nextCheck.replace("{time}", formatTime(domain.next_check_at)),
              ]
                .filter(Boolean)
                .join(", ")
            : t.neverChecked}
        </span>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void check()} disabled={checking}>
            <Icon name="refresh" size={16} className={cn(checking && "animate-spin")} />
            {checking ? t.checking : t.checkNow}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onRemove}
            className="border-[#ff6b6b]/40 text-[#ffb3b3] hover:border-[#ff6b6b]"
          >
            {t.remove}
          </Button>
        </span>
      </div>
    </li>
  );
}

type RecordRowProps = {
  type: CustomDomain["records"][number]["type"];
  name: string;
  short: string;
  value: string;
};

function RecordRow({ type, name, short, value }: RecordRowProps) {
  return (
    <li className="flex flex-col gap-2.5 rounded-md border border-line bg-surface p-3">
      <span className="flex items-center gap-2.5">
        <span className="grid h-7 min-w-14 place-items-center rounded-sm bg-raised px-2 font-mono text-[13px] font-medium text-accent">
          {type}
        </span>
        <span className="text-[13px] text-muted">{t.purpose[type]}</span>
      </span>
      <CopyValue
        label={t.recordName}
        value={name}
        hint={short !== name ? t.nameHint.replace("{short}", short) : undefined}
      />
      <CopyValue label={t.recordValue} value={value} />
    </li>
  );
}

function CopyValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[12px] text-muted">{label}</span>
        <code className="font-mono text-[13px] break-all text-ink">{value}</code>
        {hint && <span className="text-[12px] text-muted">{hint}</span>}
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`${t.copy}: ${value}`}
        title={copied ? t.copied : t.copy}
        className="grid size-9 shrink-0 place-items-center rounded-sm text-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <Icon name={copied ? "check" : "copy"} size={16} />
      </button>
    </div>
  );
}
