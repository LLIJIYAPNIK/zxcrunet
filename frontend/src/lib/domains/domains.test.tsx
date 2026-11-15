import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomDomains } from "@/components/sites/CustomDomains";
import type { CustomDomain, SiteDomains } from "@/lib/api/client";

import { inProgress, problemText, registeredZone, shortName } from "./domains";

const SERVER = { ipv4: ["203.0.113.10"], ipv6: [] };

function domain(overrides: Partial<CustomDomain> = {}): CustomDomain {
  return {
    id: "0195f3a0-0000-7000-8000-000000000001",
    site_id: "0195f3a0-0000-7000-8000-0000000000aa",
    host: "anna.ru",
    status: "pending",
    records: [
      { type: "TXT", name: "_zxc-verify.anna.ru", value: "zxc-token" },
      { type: "A", name: "anna.ru", value: "203.0.113.10" },
    ],
    problems: [],
    created_at: "2026-11-14T10:00:00Z",
    last_checked_at: null,
    next_check_at: "2026-11-14T10:01:00Z",
    verified_at: null,
    activated_at: null,
    ...overrides,
  };
}

function list(...domains: CustomDomain[]): SiteDomains {
  return { domains, used: domains.length, max_domains: 3, server: SERVER };
}

describe("record names", () => {
  it.each([
    ["anna.ru", "anna.ru"],
    ["www.anna.ru", "anna.ru"],
    ["_zxc-verify.blog.anna.ru", "anna.ru"],
    ["anna.co.uk", "anna.co.uk"],
    ["www.anna.co.uk", "anna.co.uk"],
  ])("%s belongs to %s", (host, zone) => {
    expect(registeredZone(host)).toBe(zone);
  });

  it.each([
    ["anna.ru", "@"],
    ["www.anna.ru", "www"],
    ["_zxc-verify.anna.ru", "_zxc-verify"],
    ["_zxc-verify.blog.anna.ru", "_zxc-verify.blog"],
  ])("%s is %s in a registrar panel", (name, short) => {
    expect(shortName(name, "anna.ru")).toBe(short);
  });
});

describe("problems", () => {
  it("explain what was found and what is expected", () => {
    const d = domain();

    expect(problemText({ code: "txt_missing", details: {} }, d, SERVER)).toBe(
      "Не нашли TXT-запись _zxc-verify.anna.ru.",
    );
    expect(problemText({ code: "a_wrong", details: { found: ["198.51.100.7"] } }, d, SERVER)).toBe(
      "A-запись указывает на 198.51.100.7, а нужно 203.0.113.10.",
    );
    expect(problemText({ code: "something_new", details: {} }, d, SERVER)).toBe(
      "Записи пока не совпадают.",
    );
  });

  it("only pending and verified domains are worth refreshing", () => {
    expect(inProgress([domain({ status: "active" }), domain({ status: "failed" })])).toBe(false);
    expect(inProgress([domain({ status: "active" }), domain({ status: "verified" })])).toBe(true);
  });
});

describe("CustomDomains", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the records to create, with copy buttons and registrar names", () => {
    render(
      <CustomDomains
        siteId="s"
        live
        initial={list(domain({ problems: [{ code: "a_missing", details: {} }] }))}
      />,
    );

    expect(screen.getByText("anna.ru", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Ждём записи")).toBeInTheDocument();
    expect(screen.getByText("Не нашли A-запись для anna.ru.")).toBeInTheDocument();
    expect(screen.getByText("zxc-token")).toBeInTheDocument();
    expect(
      screen.getByText("Если панель просит имя без домена: «_zxc-verify»"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скопировать: zxc-token" })).toBeInTheDocument();
    expect(screen.getByText("1 из 3 по тарифу")).toBeInTheDocument();
  });

  it("an active domain hides the instructions and links to the site", () => {
    render(<CustomDomains siteId="s" live initial={list(domain({ status: "active" }))} />);

    expect(screen.getByText("Работает")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Открыть/ })).toHaveAttribute(
      "href",
      "https://anna.ru",
    );
    expect(screen.queryByText("zxc-token")).not.toBeInTheDocument();
  });

  it("«Проверить сейчас» shows the new status", async () => {
    const verified = domain({ status: "verified", last_checked_at: "2026-11-14T10:05:00Z" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(verified), { status: 200 }),
    );
    render(<CustomDomains siteId="s" live initial={list(domain())} />);

    fireEvent.click(screen.getByRole("button", { name: /Проверить сейчас/ }));

    await waitFor(() => expect(screen.getByText("Выпускаем сертификат")).toBeInTheDocument());
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/domains/0195f3a0-0000-7000-8000-000000000001/check",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("explains the plan limit when it is reached", () => {
    const full = { ...list(domain()), used: 3 };
    render(<CustomDomains siteId="s" live={false} initial={full} />);

    const form = screen.getByRole("textbox").closest("form");
    expect(within(form as HTMLElement).getByRole("button", { name: /Подключить/ })).toBeDisabled();
    expect(screen.getByText(/Лимит тарифа: 3 своих домена/)).toBeInTheDocument();
    expect(screen.getByText(/ещё не опубликована/)).toBeInTheDocument();
  });
});
