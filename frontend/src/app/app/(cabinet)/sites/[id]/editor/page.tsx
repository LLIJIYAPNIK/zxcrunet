import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Builder } from "@/components/builder/Builder";
import { CabinetShell } from "@/components/cabinet/CabinetShell";
import type { Site } from "@/lib/api/client";
import { requireData, requireMe } from "@/lib/auth/session";
import { ru } from "@/i18n/ru";

export const metadata: Metadata = { title: ru.builder.title, robots: { index: false } };

type Params = PageProps<"/app/sites/[id]/editor">["params"];

async function Editor({ params }: { params: Params }) {
  const { id } = await params;
  const next = `/app/sites/${id}/editor`;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [me, site] = await Promise.all([
    requireMe(next),
    requireData<Site>(`/api/sites/${encodeURIComponent(id)}`, next),
  ]);
  if (!site) notFound();
  return <Builder initial={site} emailVerified={me.user.email_verified} />;
}

export default function EditorPage({ params }: { params: Params }) {
  return (
    <CabinetShell>
      <Editor params={params} />
    </CabinetShell>
  );
}
