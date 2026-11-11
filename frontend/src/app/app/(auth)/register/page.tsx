import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/forms";
import { ru } from "@/i18n/ru";

const t = ru.auth.register;

export const metadata: Metadata = { title: t.title };

export default function RegisterPage() {
  return (
    <AuthShell
      title={t.title}
      lead={t.lead}
      footer={
        <>
          {t.hasAccount}{" "}
          <Link href="/app/login" className="text-accent hover:underline">
            {t.toLogin}
          </Link>
        </>
      }
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
