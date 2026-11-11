import Link from "next/link";

import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { displayAddress, siteUrl } from "@/config/site";
import type { Schemas } from "@/lib/api/client";
import { requireData } from "@/lib/auth/session";
import { sanitizeSlug } from "@/lib/sites/slug";
import { ru } from "@/i18n/ru";

import { SiteStatusChip } from "./SiteStatusChip";

const t = ru.cabinet;
const s = ru.sites;

/** Server component: the user's sites with plan usage. Render inside <Suspense>. */
export async function SitesList({ claimSlug }: { claimSlug?: string }) {
  const data = await requireData<Schemas["SitesListOut"]>("/api/sites", "/app");
  const sites = data?.sites ?? [];
  const max = data?.max_sites ?? 0;
  const canCreate = sites.length < max;
  const claim = claimSlug ? sanitizeSlug(claimSlug) : "";
  const newHref = claim ? `/app/sites/new?slug=${encodeURIComponent(claim)}` : "/app/sites/new";

  return (
    <Card className="flex min-h-56 flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-baseline gap-3 font-display text-h3 font-medium">
          {t.sitesTitle}
          <span className="font-mono text-[13px] text-muted">
            {t.sitesUsage.replace("{used}", String(sites.length)).replace("{max}", String(max))}
          </span>
        </h2>
        {canCreate && (
          <ButtonLink href={newHref} size="sm" arrow>
            {t.createSite}
          </ButtonLink>
        )}
      </div>

      {claim && canCreate && !sites.some((site) => site.slug === claim) && (
        <p className="rounded-md border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3.5 py-3 text-sm">
          {t.claimSlug.replace("{address}", displayAddress(claim))}
        </p>
      )}

      {sites.length === 0 ? (
        <p className="max-w-[44ch] text-ink-2">{t.sitesEmpty}</p>
      ) : (
        <ul className="flex flex-col">
          {sites.map((site) => (
            <li
              key={site.id}
              className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/app/sites/${site.id}`}
                    className="truncate font-display text-lg font-medium hover:text-accent"
                  >
                    {site.title}
                  </Link>
                  <Chip>{s.kind[site.kind]}</Chip>
                  <SiteStatusChip site={site} />
                </div>
                <span className="font-mono text-[13px] text-muted">
                  {displayAddress(site.slug)}
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                {site.status === "published" && (
                  <ButtonLink
                    href={siteUrl(site.host)}
                    target="_blank"
                    rel="noreferrer"
                    variant="ghost"
                    size="sm"
                  >
                    {s.open}
                    <Icon name="external" size={16} />
                  </ButtonLink>
                )}
                <ButtonLink href={`/app/sites/${site.id}`} variant="secondary" size="sm">
                  {s.settings}
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!canCreate && (
        <p className="text-sm text-muted">{t.limitReached.replace("{max}", String(max))}</p>
      )}
    </Card>
  );
}
