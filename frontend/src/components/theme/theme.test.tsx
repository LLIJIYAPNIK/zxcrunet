import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PRESETS } from "@/lib/theme/palette";

import { NeonProvider, useNeon } from "./NeonProvider";
import { PalettePicker } from "./PalettePicker";

function Harness() {
  const { choice, setChoice, palette } = useNeon();
  return (
    <>
      <PalettePicker value={choice} onChange={setChoice} />
      <output data-testid="accent">{palette.accent}</output>
    </>
  );
}

function renderHarness() {
  const { container } = render(
    <NeonProvider>
      <Harness />
    </NeonProvider>,
  );
  const scope = container.firstElementChild as HTMLElement;
  return { scope };
}

describe("PalettePicker + NeonProvider", () => {
  it("starts with the default preset selected", () => {
    renderHarness();

    expect(screen.getByRole("radio", { name: PRESETS[0].name })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("repaints the scope when a preset is picked", () => {
    const { scope } = renderHarness();
    const rose = PRESETS.find((p) => p.id === "rose")!;

    fireEvent.click(screen.getByRole("radio", { name: rose.name }));

    expect(scope.style.getPropertyValue("--accent")).toBe(rose.accent);
    expect(screen.getByRole("radio", { name: rose.name })).toHaveAttribute("aria-checked", "true");
  });

  it("accepts a custom hex and clears the preset selection", () => {
    const { scope } = renderHarness();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "#00ff99" } });

    expect(scope.style.getPropertyValue("--accent")).toBe("#00ff99");
    for (const preset of PRESETS) {
      expect(screen.getByRole("radio", { name: preset.name })).toHaveAttribute(
        "aria-checked",
        "false",
      );
    }
  });

  it("flags an invalid hex without changing the palette", () => {
    renderHarness();
    const before = screen.getByTestId("accent").textContent;

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "#zz" } });

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("accent").textContent).toBe(before);
  });
});
