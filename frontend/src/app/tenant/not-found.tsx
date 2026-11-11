import Link from "next/link";

import { ru } from "@/i18n/ru";

/** A page that does not exist inside a published site. */
export default function TenantNotFound() {
  return (
    <main className="wrap flex flex-1 flex-col justify-center gap-4 py-24">
      <h1 className="font-display text-h2 font-medium">{ru.publicSite.pageMissing}</h1>
      <Link href="/" className="w-max text-accent hover:underline">
        {ru.publicSite.toHome}
      </Link>
    </main>
  );
}
