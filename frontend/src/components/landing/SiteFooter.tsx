import Link from "next/link";

import { Wordmark } from "@/components/brand/Wordmark";
import { ru } from "@/i18n/ru";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="wrap flex flex-col gap-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <Wordmark />
        <div className="flex items-center gap-6">
          <Link href="/ui" className="transition-colors hover:text-ink">
            {ru.footer.showcase}
          </Link>
          <span>{ru.footer.rights}</span>
        </div>
      </div>
    </footer>
  );
}
