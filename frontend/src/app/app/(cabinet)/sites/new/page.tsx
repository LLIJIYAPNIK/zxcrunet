import type { Metadata } from "next";

import { CabinetShell } from "@/components/cabinet/CabinetShell";
import { NewSiteForm } from "@/components/sites/NewSiteForm";
import { Card } from "@/components/ui/Card";
import { requireMe } from "@/lib/auth/session";
import { ru } from "@/i18n/ru";

const t = ru.sites.create;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

async function NewSite() {
  await requireMe("/app/sites/new");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h2 font-medium">{t.title}</h1>
        <p className="text-ink-2">{t.lead}</p>
      </div>
      <Card>
        <NewSiteForm />
      </Card>
    </div>
  );
}

export default function NewSitePage() {
  return (
    <CabinetShell>
      <NewSite />
    </CabinetShell>
  );
}
