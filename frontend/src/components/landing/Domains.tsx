import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { ru } from "@/i18n/ru";

import { SectionHead } from "./SectionHead";

export function Domains() {
  const t = ru.domains;
  const records = [
    { type: "TXT", name: "_zxc-verify.anna.ru", value: t.own.txtValue },
    { type: "A", name: "anna.ru", value: t.own.aValue },
  ];

  return (
    <section
      id="domains"
      aria-labelledby="domains-title"
      className="wrap scroll-mt-20 py-20 lg:py-28"
    >
      <SectionHead id="domains-title" label={t.label} title={t.title} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Icon name="globe" className="text-accent" />
            <Chip variant="accent">{t.free.badge}</Chip>
          </div>
          <h3 className="font-display text-h3 font-medium">{t.free.title}</h3>
          <p className="text-ink-2">{t.free.text}</p>
          <span className="mt-auto rounded-md border border-line bg-bg px-4 py-3.5 font-mono text-[15px] text-accent">
            https://{t.free.example}
          </span>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <Icon name="link" className="text-accent" />
            <Chip>{t.own.badge}</Chip>
          </div>
          <h3 className="font-display text-h3 font-medium">{t.own.title}</h3>
          <p className="text-ink-2">{t.own.text}</p>
          <div className="mt-auto rounded-md border border-line bg-bg">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line px-4 py-3 font-mono text-[13px] text-muted sm:grid"
            >
              <span>{t.own.recordType}</span>
              <span>{t.own.recordName}</span>
              <span>{t.own.recordValue}</span>
            </div>
            <dl>
              {records.map((r) => (
                <div
                  key={r.type}
                  className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-line px-4 py-3.5 last:border-0 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <dt className="font-mono text-[13px] text-accent">
                    <span className="sr-only">{t.own.recordType} </span>
                    {r.type}
                  </dt>
                  <dd className="font-mono text-[13px] break-all text-ink">
                    <span className="sr-only">{t.own.recordName}: </span>
                    {r.name}
                  </dd>
                  <dd className="col-start-2 text-sm text-ink-2 sm:col-start-auto">
                    <span className="sr-only">{t.own.recordValue}: </span>
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </div>
    </section>
  );
}
