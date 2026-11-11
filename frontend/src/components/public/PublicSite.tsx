import Link from "next/link";

import { CWRAP, Blocks } from "@/blocks/renderers";
import { META, anchorId, type AnyBlock } from "@/blocks/schemas";
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
  /** Editor preview: links do not leave the editor, no entrance animation. */
  preview?: boolean;
};

function href(path: string): string {
  return path ? `/${path}` : "/";
}

type NavItem = { href: string; label: string; current?: boolean };

function navItems(content: Content, page: PublicPage, blocks: readonly AnyBlock[]): NavItem[] {
  if (content.pages.length > 1) {
    return content.pages.map((p) => ({
      href: href(p.path),
      label: p.title,
      current: p.path === page.path,
    }));
  }
  return blocks
    .filter((b) => !b.hidden)
    .flatMap((b) => {
      const label = (META[b.type]?.navLabel as ((s: unknown) => string | null) | undefined)?.(
        b.settings,
      );
      return label ? [{ href: `#${anchorId(b)}`, label }] : [];
    });
}

/** A published card: address bar, navigation, blocks, «Сделано на zxcrunet». */
export function PublicSite({ slug, content, page, preview = false }: PublicSiteProps) {
  const t = ru.publicSite;
  const blocks = page.blocks as unknown as AnyBlock[];
  const visible = blocks.filter((b) => !b.hidden);
  const nav = navItems(content, page, blocks);
  const address = `${slug}.${SERVICE_DOMAIN}`;

  return (
    <ThemeScope
      accent={content.theme.accent}
      second={content.theme.second ?? undefined}
      className="@container flex min-h-full flex-1 flex-col bg-bg text-ink"
    >
      <header className="border-b border-line">
        <div
          className={cn(
            CWRAP,
            "flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 @3xl:min-h-[72px]",
          )}
        >
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
            <span>
              {slug}
              <span className="text-muted">.{SERVICE_DOMAIN}</span>
            </span>
          </Link>
          {nav.length > 0 && (
            <nav aria-label={content.title} className="@max-3xl:hidden">
              <ul className="flex flex-wrap gap-x-7 gap-y-1">
                {nav.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={item.current ? "page" : undefined}
                      className={cn(
                        "relative py-2 text-[15px] font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-neon hover:text-ink hover:after:scale-x-100",
                        item.current ? "text-ink" : "text-ink-2",
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </header>

      <main className={cn("flex flex-1 flex-col", preview && "[&_[data-enter]>*]:animate-none")}>
        {visible.length === 0 ? (
          <div className={cn(CWRAP, "flex flex-col gap-4 py-16 @3xl:py-24")} data-enter>
            {page.path && <span className="label">{page.title}</span>}
            <h1 className="font-display text-ch1 font-medium">{content.title}</h1>
            <div className="mt-6 max-w-xl rounded-lg border border-dashed border-line-2 p-6 @lg:p-8">
              <p className="font-display text-h3 font-medium">{t.empty}</p>
              <p className="mt-2 text-ink-2">{t.emptyLead}</p>
            </div>
          </div>
        ) : (
          <Blocks blocks={visible} ctx={{ address, siteTitle: content.title }} />
        )}
      </main>

      <footer className="border-t border-line">
        <div
          className={cn(
            CWRAP,
            "flex min-h-[88px] flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted",
          )}
        >
          <span>{content.title}</span>
          <MadeWith />
        </div>
      </footer>
    </ThemeScope>
  );
}
