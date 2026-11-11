import Link from "next/link";

import { MadeWith } from "@/components/brand/MadeWith";
import { ThemeScope } from "@/components/theme/ThemeScope";
import { SERVICE_DOMAIN } from "@/config/site";
import { cn } from "@/lib/cn";
import type { Schemas } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

type Content = Schemas["PublicContentOut"];
type PublicPage = Schemas["PublicPageOut"];

type PublicSiteProps = {
  slug: string;
  content: Content;
  page: PublicPage;
};

function href(path: string): string {
  return path ? `/${path}` : "/";
}

/** A published card: address bar, page nav, the page's blocks, «Сделано на zxcrunet». */
export function PublicSite({ slug, content, page }: PublicSiteProps) {
  const t = ru.publicSite;
  return (
    <ThemeScope
      accent={content.theme.accent}
      second={content.theme.second ?? undefined}
      className="flex min-h-full flex-1 flex-col bg-bg text-ink"
    >
      <header className="border-b border-line">
        <div className="wrap flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 sm:min-h-[72px]">
          <Link href="/" className="flex items-center gap-2.5 font-mono text-[15px] font-medium">
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-sm border-[1.5px] border-accent"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none">
                <path
                  d="M5 17a7 7 0 0 1 14 0"
                  stroke="var(--accent)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            {slug}
            <span className="text-muted">.{SERVICE_DOMAIN}</span>
          </Link>
          {content.pages.length > 1 && (
            <nav aria-label={content.title}>
              <ul className="flex flex-wrap gap-x-7 gap-y-1">
                {content.pages.map((p) => (
                  <li key={p.path}>
                    <Link
                      href={href(p.path)}
                      aria-current={p.path === page.path ? "page" : undefined}
                      className={cn(
                        "relative py-2 text-[15px] font-medium transition-colors hover:text-ink",
                        p.path === page.path ? "text-ink" : "text-ink-2",
                      )}
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </header>

      <main className="wrap flex flex-1 flex-col py-16 lg:py-24">
        {page.blocks.length === 0 ? (
          <div className="flex flex-col gap-4" data-enter>
            <span className="label">{page.title}</span>
            <h1 className="font-display text-h1 font-medium">{content.title}</h1>
            <div className="mt-6 max-w-xl rounded-lg border border-dashed border-line-2 p-6 sm:p-8">
              <p className="font-display text-h3 font-medium">{t.empty}</p>
              <p className="mt-2 text-ink-2">{t.emptyLead}</p>
            </div>
          </div>
        ) : (
          // Blocks are rendered in stage 4 (block registry).
          <h1 className="font-display text-h1 font-medium">{content.title}</h1>
        )}
      </main>

      <footer className="border-t border-line">
        <div className="wrap flex min-h-[88px] flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted">
          <span>{content.title}</span>
          <MadeWith />
        </div>
      </footer>
    </ThemeScope>
  );
}
