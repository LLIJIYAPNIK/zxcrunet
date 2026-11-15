import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CabinetShell } from "@/components/cabinet/CabinetShell";
import { SiteSettings } from "@/components/sites/SiteSettings";
import type { Site, SiteDomains } from "@/lib/api/client";
import { requireData, requireMe } from "@/lib/auth/session";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = { title: ru.sites.settings, robots: { index: false } };

type Params = PageProps<"/app/sites/[id]">["params"];

async function Editor({ params }: { params: Params }) {
  const { id } = await params;
  const next = `/app/sites/${id}`;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [me, site, domains] = await Promise.all([
    requireMe(next),
    requireData<Site>(`/api/sites/${encodeURIComponent(id)}`, next),
    requireData<SiteDomains>(`/api/sites/${encodeURIComponent(id)}/domains`, next),
  ]);
  if (!site) notFound();
  return <SiteSettings initial={site} emailVerified={me.user.email_verified} domains={domains} />;
}

export default function SitePage({ params }: { params: Params }) {
  return (
    <CabinetShell>
      <Editor params={params} />
    </CabinetShell>
  );
}
