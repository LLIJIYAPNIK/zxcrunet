import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PublicSite } from "@/components/public/PublicSite";
import { CatalogIndex, kindFromPath, type Catalog, type Title } from "@/lib/catalog/catalog";
import { resolveCatalog, resolveSite } from "@/lib/tenant/resolve";

type Params = PageProps<"/tenant/[host]/[[...path]]">["params"];

/*
 * Reached only through src/proxy.ts, which has already checked that the host has a
 * published site (unknown and suspended hosts get a real 404/403 there).
 *
 * `/<page>` is a page of blocks; `/<games|books|anime|series|films>/<slug>` is the page of
 * a title from the owner's catalog (personal sites only).
 */
async function load(host: string, path: string[] | undefined) {
  const site = await resolveSite(host);
  if (!site || site.status !== "published" || !site.content) return null;
  const segments = (path ?? []).map((s) => s.toLowerCase());
  const catalog: Catalog | null =
    site.content.kind === "personal" ? await resolveCatalog(host) : null;

  let title: Title | undefined;
  let pagePath = segments.join("/");
  if (segments.length === 2) {
    const kind = kindFromPath(segments[0]);
    title = kind && catalog ? new CatalogIndex(catalog).find(kind, segments[1]) : undefined;
    if (!title) return null;
    pagePath = "";
  } else if (segments.length > 2) {
    return null;
  }
  const page = site.content.pages.find((p) => p.path === pagePath);
  if (!page) return null;
  return { site, content: site.content, page, catalog: catalog ?? undefined, title };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { host, path } = await params;
  const found = await load(host, path);
  if (!found) return {};
  const { content, title } = found;
  if (title) {
    return {
      title: { absolute: `${title.name} · ${content.title}` },
      description: title.description || undefined,
    };
  }
  return {
    title: { absolute: content.seo.title || content.title },
    description: content.seo.description || undefined,
  };
}

async function TenantContent({ params }: { params: Params }) {
  const { host, path } = await params;
  const found = await load(host, path);
  if (!found) notFound();
  return (
    <PublicSite
      slug={found.site.slug}
      content={found.content}
      page={found.page}
      catalog={found.catalog}
      title={found.title}
    />
  );
}

export default function TenantPage({ params }: { params: Params }) {
  return (
    <Suspense>
      <TenantContent params={params} />
    </Suspense>
  );
}
