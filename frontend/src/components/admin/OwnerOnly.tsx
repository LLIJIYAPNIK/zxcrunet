import type { ReactNode } from "react";

import { requireOwner } from "@/lib/auth/session";

/**
 * Reads the session: render inside <Suspense>. Anyone but the owner gets a 404, a guest
 * goes to the login page. The API checks the role again on every request.
 */
export async function OwnerOnly({ next, children }: { next: string; children: ReactNode }) {
  await requireOwner(next);
  return <>{children}</>;
}
