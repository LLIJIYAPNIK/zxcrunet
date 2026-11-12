import { Card, CardLink } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ru } from "@/i18n/ru";
import { requireMe } from "@/lib/auth/session";

import { SitesList } from "@/components/sites/SitesList";

import { LogoutButton, ResendVerificationButton } from "./actions";

const t = ru.cabinet;

/** Reads the session: render only inside <Suspense>. */
export async function Dashboard({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const claimSlug = (await searchParams).slug;
  const { user, limits } = await requireMe("/app");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="label">{t.title}</span>
          <h1 className="font-display text-h2 font-medium">
            {t.greeting}, <span className="text-accent">{user.email}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {user.role === "owner" && <Chip variant="accent">{t.owner}</Chip>}
          <LogoutButton />
        </div>
      </div>

      {!user.email_verified && (
        <div className="flex flex-col gap-3 rounded-md border border-[color-mix(in_srgb,var(--second)_45%,transparent)] bg-[color-mix(in_srgb,var(--second)_8%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-3 text-ink">
            <Icon name="mail" className="shrink-0 text-second" />
            {t.unverified.replace("{email}", user.email)}
          </p>
          <ResendVerificationButton />
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SitesList claimSlug={claimSlug} />
        <div className="flex flex-col gap-6">
          <CardLink href="/app/catalog" className="flex flex-col gap-2">
            <span className="flex items-center justify-between gap-3">
              <b className="font-display text-h3 font-medium">{ru.catalog.title}</b>
              <Icon name="shelf" className="text-accent" />
            </span>
            <span className="text-ink-2">{t.catalogLead}</span>
          </CardLink>
          <Card className="flex flex-col gap-4">
            <h2 className="flex items-baseline justify-between gap-3 font-display text-h3 font-medium">
              {t.planTitle}
              <Chip>{limits.plan_title}</Chip>
            </h2>
            <dl className="flex flex-col">
              {[
                [limits.max_sites, t.limitSites],
                [limits.max_custom_domains, t.limitDomains],
                [limits.max_upload_mb, t.limitUpload],
              ].map(([value, label]) => (
                <div key={label} className="border-b border-line py-3 last:border-0">
                  <dt className="sr-only">{label}</dt>
                  <dd className="flex items-baseline gap-3">
                    <span className="font-display text-stat font-medium">{value}</span>
                    <span className="text-ink-2" aria-hidden="true">
                      {label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
