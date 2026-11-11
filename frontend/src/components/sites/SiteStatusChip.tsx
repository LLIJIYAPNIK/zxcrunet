import { Chip } from "@/components/ui/Chip";
import type { SiteSummary } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

export function SiteStatusChip({ site }: { site: SiteSummary }) {
  const t = ru.sites;
  if (site.status === "suspended") {
    return <Chip className="border-[#ff6b6b]/50 text-[#ffb3b3]">{t.status.suspended}</Chip>;
  }
  if (site.status === "published") {
    return (
      <>
        <Chip variant="accent">{t.status.published}</Chip>
        {site.has_unpublished_changes && <Chip variant="dash">{t.unpublished}</Chip>}
      </>
    );
  }
  return <Chip variant="dash">{t.status.draft}</Chip>;
}
