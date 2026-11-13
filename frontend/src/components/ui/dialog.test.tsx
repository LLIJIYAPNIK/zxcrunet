import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useConfirm } from "./Dialog";

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button
        type="button"
        onClick={async () => onResult(await confirm({ title: "Удалить блок?", danger: true }))}
      >
        open
      </button>
      {dialog}
    </>
  );
}

async function open() {
  const results: boolean[] = [];
  render(<Harness onResult={(ok) => results.push(ok)} />);
  fireEvent.click(screen.getByRole("button", { name: "open" }));
  return results;
}

describe("useConfirm", () => {
  it("resolves true on confirm and closes", async () => {
    const results = await open();
    expect(screen.getByRole("heading", { name: "Удалить блок?" })).toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Подтвердить" })));

    expect(results).toEqual([true]);
    expect(screen.queryByRole("heading", { name: "Удалить блок?" })).not.toBeInTheDocument();
  });

  it("resolves false on cancel and on Esc", async () => {
    const results = await open();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Отмена" })));

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    const dialog = screen.getByRole("heading", { name: "Удалить блок?" }).closest("dialog")!;
    await act(async () => fireEvent(dialog, new Event("cancel", { cancelable: true })));

    expect(results).toEqual([false, false]);
  });
});
