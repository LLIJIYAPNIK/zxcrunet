import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/forms";
import { ru } from "@/i18n/ru";

const t = ru.auth.login;

export const metadata: Metadata = { title: t.title, robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell
      title={t.title}
      lead={t.lead}
      footer={
        <>
          {t.noAccount}{" "}
          <Link href="/app/register" className="text-accent hover:underline">
            {t.toRegister}
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
