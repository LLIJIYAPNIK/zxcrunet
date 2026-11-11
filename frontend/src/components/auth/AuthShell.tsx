import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/Wordmark";
import { ru } from "@/i18n/ru";

type AuthShellProps = {
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered card for login, registration and password pages. */
export function AuthShell({ title, lead, children, footer }: AuthShellProps) {
  return (
    <main className="wrap flex flex-1 flex-col items-center justify-center py-12">
      <div className="flex w-full max-w-[420px] flex-col gap-8">
        <Link href="/" aria-label={ru.auth.toHome} className="w-max">
          <Wordmark />
        </Link>
        <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] sm:p-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[28px] leading-tight font-medium tracking-[-0.02em]">
              {title}
            </h1>
            {lead && <p className="text-ink-2">{lead}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-md border border-[#ff6b6b]/40 bg-[#ff6b6b]/10 px-3.5 py-3 text-sm text-[#ffb3b3]"
          : "rounded-md border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3.5 py-3 text-sm text-ink"
      }
    >
      {children}
    </p>
  );
}
