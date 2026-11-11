import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/forms";
import { ru } from "@/i18n/ru";

const t = ru.auth.reset;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell title={t.title} lead={t.lead}>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
