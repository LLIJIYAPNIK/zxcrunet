import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/forms";
import { ru } from "@/i18n/ru";

const t = ru.auth.forgot;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title={t.title}
      lead={t.lead}
      footer={
        <Link href="/app/login" className="text-accent hover:underline">
          {t.back}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
