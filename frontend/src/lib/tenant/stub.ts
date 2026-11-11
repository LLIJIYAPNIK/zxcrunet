/**
 * Tiny self-contained HTML pages the proxy returns with a real status code
 * (404 «no site here», 403 «suspended», 503 «try later»). With Cache Components
 * a streamed page always starts as 200, so these never go through React.
 */
import { BRAND, SERVICE_DOMAIN } from "@/config/site";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

type StubOptions = {
  status: 403 | 404 | 503;
  title: string;
  lead: string;
  cta?: { label: string; href: string };
};

export function stubHtml({ title, lead, cta }: Omit<StubOptions, "status">): string {
  const link = cta
    ? `<a class="cta" href="${escapeHtml(cta.href)}">${escapeHtml(cta.label)}</a>`
    : "";
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · ${BRAND}</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;background:#0a0d14;color:#e9edf3;font:400 16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:440px;display:flex;flex-direction:column;gap:16px}
.mark{width:32px;height:32px;border-radius:9px;background:#1a2030;display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(233,237,243,.18)}
h1{margin:8px 0 0;font-size:32px;line-height:1.1;font-weight:500;letter-spacing:-.025em}
p{margin:0;color:rgba(233,237,243,.84)}
.cta{align-self:flex-start;margin-top:8px;display:inline-flex;align-items:center;height:44px;padding:0 24px;border-radius:10px;background:#5ab9fc;color:#0a0d14;font-weight:500;text-decoration:none}
.made{margin-top:24px;font-size:14px;color:#8f98a8}
.made a{color:#e9edf3;font-family:ui-monospace,Consolas,monospace;text-decoration:none}
</style>
</head>
<body>
<main>
<span class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M5 17a7 7 0 0 1 14 0" stroke="#5ab9fc" stroke-width="2.4" stroke-linecap="round"/></svg></span>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(lead)}</p>
${link}
<p class="made">Сделано на <a href="https://${SERVICE_DOMAIN}">${BRAND}</a></p>
</main>
</body>
</html>`;
}

export function stubResponse(options: StubOptions): Response {
  return new Response(stubHtml(options), {
    status: options.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(options.status === 503 ? { "retry-after": "30" } : {}),
    },
  });
}
