"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { ru } from "@/i18n/ru";
import { apiPost } from "@/lib/api/client";
import { errorText } from "@/lib/auth/schemas";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await apiPost("/api/auth/logout");
          // Full page load on purpose: drops every cached route that still holds the user's data.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/app/login");
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
