import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { SERVICE_DOMAIN } from "@/config/site";
import { ru } from "@/i18n/ru";

/** Final call to action: type the desired subdomain and go to registration. */
export function Claim() {
  const t = ru.claim;
  return (
    <section aria-labelledby="claim-title" className="wrap py-20 lg:py-28">
      <div className="grid items-end gap-8 rounded-lg border border-line-2 bg-surface p-6 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col gap-3">
          <h2 id="claim-title" className="font-display text-h2 font-medium">
            {t.title}
          </h2>
          <p className="text-lead text-ink-2">{t.text}</p>
        </div>
        <form action="/app/register" method="get" className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="claim-slug">
            {t.inputLabel}
          </label>
          <Input
            id="claim-slug"
            name="slug"
            suffix={`.${SERVICE_DOMAIN}`}
            placeholder={ru.hero.addressPlaceholder}
            autoComplete="off"
            spellCheck={false}
            pattern="[a-z0-9-]{3,32}"
            className="flex-1"
          />
          <Button type="submit" arrow className="h-12">
            {t.submit}
          </Button>
        </form>
      </div>
    </section>
  );
}
