import { BRAND, SERVICE_DOMAIN } from "@/config/site";
import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

/** «Сделано на zxcrunet» — shown in the footer of every published site. */
export function MadeWith({ className }: { className?: string }) {
  return (
    <a
      href={`https://${SERVICE_DOMAIN}`}
      className={cn("text-sm text-muted transition-colors hover:text-ink-2", className)}
    >
      {ru.footer.madeWith} <b className="font-mono font-medium text-ink">{BRAND}</b>
    </a>
  );
}
