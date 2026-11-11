import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PublicSite } from "@/components/public/PublicSite";
import { resolveSite } from "@/lib/tenant/resolve";

type Params = PageProps<"/tenant/[host]/[[...path]]">["params"];

/*
 * Reached only through src/proxy.ts, which has already checked that the host has a
 * published site (unknown and suspended hosts get a real 404/403 there).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { host } = await params;
  const site = await resolveSite(host);
  const content = site?.content;
  if (!content) return {};
  return {
    title: { absolute: content.seo.title || content.title },
    description: content.seo.description || undefined,
  };
}

async function TenantContent({ params }: { params: Params }) {
  const { host, path } = await params;
  const site = await resolveSite(host);
  if (!site || site.status !== "published" || !site.content) notFound();

  const wanted = (path ?? []).join("/").toLowerCase();
  const page = site.content.pages.find((p) => p.path === wanted);
  if (!page) notFound();

  return <PublicSite slug={site.slug} content={site.content} page={page} />;
}

export default function TenantPage({ params }: { params: Params }) {
  return (
    <Suspense>
      <TenantContent params={params} />
    </Suspense>
  );
}
