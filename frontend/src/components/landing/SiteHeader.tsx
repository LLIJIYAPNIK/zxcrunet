import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { ru } from "@/i18n/ru";

const LINKS = [
  { href: "#sides", label: ru.nav.sides },
  { href: "#palette", label: ru.nav.palette },
  { href: "#domains", label: ru.nav.domains },
  { href: "#steps", label: ru.nav.steps },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-md">
      <div className="wrap flex h-16 items-center justify-between gap-6 sm:h-[72px]">
        <Link href="/" aria-label="zxcrunet — на главную">
          <Wordmark />
        </Link>
        <nav aria-label={ru.nav.label} className="hidden lg:block">
          <ul className="flex gap-7">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative py-2 text-[15px] font-medium text-ink-2 transition-colors after:absolute after:inset-x-0 after:bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-neon hover:text-ink hover:after:scale-x-100"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/app/login" variant="ghost" size="sm" className="max-sm:hidden">
            {ru.nav.login}
          </ButtonLink>
          <ButtonLink href="/app/register" size="sm">
            {ru.nav.create}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
