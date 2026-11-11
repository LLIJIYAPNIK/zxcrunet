"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { ru } from "@/i18n/ru";
import { apiPost } from "@/lib/api/client";
import { errorText } from "@/lib/auth/schemas";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await apiPost("/api/auth/logout");
          router.replace("/app/login");
          router.refresh();
        })
      }
    >
      {ru.cabinet.logout}
    </Button>
  );
}

export function ResendVerificationButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await apiPost("/api/auth/verify-email/resend");
            setMessage(result.ok ? ru.cabinet.resent : errorText(result.error.code));
          })
        }
      >
        {ru.cabinet.resend}
      </Button>
      {message && (
        <span role="status" className="text-sm text-ink-2">
          {message}
        </span>
      )}
    </span>
  );
}
