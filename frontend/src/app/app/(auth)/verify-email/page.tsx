import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmailStatus } from "@/components/auth/forms";
import { ru } from "@/i18n/ru";

const t = ru.auth.verify;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <AuthShell title={t.title}>
      <Suspense fallback={<p className="text-ink-2">{t.checking}</p>}>
        <VerifyEmailStatus />
      </Suspense>
    </AuthShell>
  );
}
