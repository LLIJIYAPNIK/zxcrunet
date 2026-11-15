import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportButton } from "@/components/public/SiteEvents";
import { actionText, adminErrorText, auditSubject, formatDay, shownText } from "@/lib/admin/admin";
import type { AuditEntry } from "@/lib/api/client";

import { DayBars } from "./DayBars";
import { useAsk } from "./parts";

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    id: "0195f3a0-0000-7000-8000-000000000001",
    actor_id: "0195f3a0-0000-7000-8000-000000000002",
    actor_email: "owner@example.com",
    action: "user.block",
    target_type: "user",
    target_id: "0195f3a0-0000-7000-8000-000000000003",
    at: "2026-11-15T10:00:00Z",
    details: {},
    ...overrides,
  };
}

describe("admin helpers", () => {
  it("translates codes and keeps unknown ones readable", () => {
    expect(actionText("site.suspend")).toBe("Снял визитку с публикации");
    expect(actionText("site.teleport")).toBe("site.teleport");
    expect(adminErrorText("owner_protected")).toBe("Владельца нельзя заблокировать.");
    expect(adminErrorText("whatever")).toBe("Что-то пошло не так. Попробуйте ещё раз.");
  });

  it("names the subject of an audit entry", () => {
    expect(auditSubject(entry({ details: { email: "anna@example.com", reason: "спам" } }))).toBe(
      "anna@example.com · спам",
    );
    expect(auditSubject(entry({ target_type: "plan", target_id: "pro", details: {} }))).toBe("pro");
    expect(auditSubject(entry({ details: { host: "anna.ru" } }))).toBe("anna.ru");
  });

  it("formats days as UTC and the shown range", () => {
    expect(formatDay("2026-11-15")).toMatch(/^15 нояб/);
    expect(shownText(50, 20, 70)).toBe("51–70 из 70");
    expect(shownText(0, 0, 0)).toBe("Ничего не нашли.");
  });
});

describe("DayBars", () => {
  const data = [
    { day: "2026-11-13", value: 0 },
    { day: "2026-11-14", value: 4 },
    { day: "2026-11-15", value: 2 },
  ];

  it("shows a column per day with a readable label and a table", () => {
    render(<DayBars title="Просмотры" summary="за период: 6" data={data} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /14 ноября: 4/ })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("за период: 6")).toBeInTheDocument();
  });

  it("shows the hovered day instead of the summary", () => {
    render(<DayBars title="Просмотры" summary="за период: 6" data={data} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: /15 ноября/ }));

    expect(screen.queryByText("за период: 6")).not.toBeInTheDocument();
    expect(screen.getByText(/15 ноября: 2$/)).toBeInTheDocument();
  });
});

function AskHarness({ onResult }: { onResult: (value: string | null) => void }) {
  const { ask, dialog } = useAsk();
  return (
    <>
      <button
        type="button"
        onClick={async () =>
          onResult(
            await ask({
              title: "Снять визитку?",
              confirmLabel: "Снять",
              danger: true,
              reason: { label: "Причина", required: true },
            }),
          )
        }
      >
        open
      </button>
      {dialog}
    </>
  );
}

describe("useAsk", () => {
  it("needs the reason when it is required and returns it trimmed", async () => {
    const results: (string | null)[] = [];
    render(<AskHarness onResult={(v) => results.push(v)} />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    const submit = screen.getByRole("button", { name: "Снять" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Причина"), { target: { value: "  фишинг " } });
    await act(async () => fireEvent.click(submit));

    expect(results).toEqual(["фишинг"]);
  });

  it("gives null on cancel", async () => {
    const results: (string | null)[] = [];
    render(<AskHarness onResult={(v) => results.push(v)} />);
    fireEvent.click(screen.getByRole("button", { name: "open" }));

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Отмена" })));

    expect(results).toEqual([null]);
  });
});

describe("ReportButton", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the reason and message of the current page", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "x" }), { status: 201 }));
    render(<ReportButton />);

    fireEvent.click(screen.getByRole("button", { name: "Пожаловаться" }));
    fireEvent.click(screen.getByLabelText("Мошенничество"));
    fireEvent.change(screen.getByLabelText("Подробности"), {
      target: { value: "просит деньги" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Отправить" })));

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/public/events/reports");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      reason: "fraud",
      message: "просит деньги",
      host: window.location.host,
    });
    expect(screen.getByText("Спасибо, жалоба отправлена.")).toBeInTheDocument();
  });

  it("explains a refusal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "rate_limited", message: "", details: {} } }), {
        status: 429,
      }),
    );
    render(<ReportButton />);

    fireEvent.click(screen.getByRole("button", { name: "Пожаловаться" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Отправить" })));

    expect(screen.getByRole("alert")).toHaveTextContent("Слишком много жалоб");
  });
});
