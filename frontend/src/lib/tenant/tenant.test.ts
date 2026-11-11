import { describe, expect, it } from "vitest";

import { siteUrl } from "@/config/site";
import { buildUrl } from "@/lib/api/client";
import { sanitizeSlug } from "@/lib/sites/slug";

import { DEFAULT_APP_HOSTS, isAppHost, normalizeHost, parseAppHosts, tenantPath } from "./hosts";
import { escapeHtml, stubHtml } from "./stub";

describe("normalizeHost", () => {
  it.each([
    ["Anna.ZXC.ru.net", "anna.zxc.ru.net"],
    ["anna.localhost:3000", "anna.localhost"],
    ["zxc.ru.net.", "zxc.ru.net"],
    ["  localhost  ", "localhost"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeHost(raw)).toBe(expected);
  });

  it.each([null, "", "bad host", "evil.com/<x>", "a".repeat(254)])("rejects %s", (raw) => {
    expect(normalizeHost(raw)).toBeNull();
  });
});

describe("app hosts", () => {
  it("falls back to defaults and parses a list", () => {
    expect(parseAppHosts(undefined)).toEqual(DEFAULT_APP_HOSTS);
    expect(parseAppHosts(" Localhost:3000 , zxc.ru.net ")).toEqual(["localhost", "zxc.ru.net"]);
  });

  it("separates the app from tenant hosts", () => {
    expect(isAppHost("zxc.ru.net", DEFAULT_APP_HOSTS)).toBe(true);
    expect(isAppHost("anna.zxc.ru.net", DEFAULT_APP_HOSTS)).toBe(false);
    expect(isAppHost("anna.ru", DEFAULT_APP_HOSTS)).toBe(false);
  });

  it("builds the internal tenant path", () => {
    expect(tenantPath("anna.zxc.ru.net", "/")).toBe("/tenant/anna.zxc.ru.net");
    expect(tenantPath("anna.zxc.ru.net", "/games")).toBe("/tenant/anna.zxc.ru.net/games");
  });
});

describe("stub pages", () => {
  it("escapes text", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;",
    );
    expect(stubHtml({ title: "<b>", lead: "ok" })).toContain("<h1>&lt;b&gt;</h1>");
  });

  it("is not indexed and carries the label", () => {
    const html = stubHtml({ title: "Нет", lead: "—" });
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain("zxcrunet");
  });
});

describe("urls", () => {
  it("fills path params and query", () => {
    expect(buildUrl("/api/sites/{site_id}/pages/{page_id}", { site_id: "a b", page_id: "1" })).toBe(
      "/api/sites/a%20b/pages/1",
    );
    expect(buildUrl("/api/sites/slug-check", undefined, { slug: "anna", x: undefined })).toBe(
      "/api/sites/slug-check?slug=anna",
    );
  });

  it("links a site host through the template", () => {
    expect(siteUrl("anna.zxc.ru.net")).toBe("https://anna.zxc.ru.net");
    expect(siteUrl("anna.localhost", "http://{host}:3000")).toBe("http://anna.localhost:3000");
  });

  it("sanitizes slugs typed by people", () => {
    expect(sanitizeSlug("Анна Anna_V-1!")).toBe("annav-1");
  });
});
