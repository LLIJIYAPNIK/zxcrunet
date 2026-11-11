import type { Metadata } from "next";
import { JetBrains_Mono, Onest } from "next/font/google";

import { BRAND } from "@/config/site";
import { ru } from "@/i18n/ru";

import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: ru.meta.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
