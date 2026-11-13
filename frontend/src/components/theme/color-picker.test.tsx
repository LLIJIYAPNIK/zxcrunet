import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ColorPicker } from "./ColorPicker";

function Harness() {
  const [color, setColor] = useState("#5ab9fc");
  return (
    <>
      <ColorPicker label="Основной" value={color} onChange={setColor} />
      <output data-testid="color">{color}</output>
    </>
  );
}

describe("ColorPicker", () => {
  it("shows the colour as HEX and RGB", () => {
    render(<Harness />);

    expect(screen.getByRole("textbox")).toHaveValue("#5ab9fc");
    expect(screen.getByRole("spinbutton", { name: "R" })).toHaveValue(90);
    expect(screen.getByRole("spinbutton", { name: "G" })).toHaveValue(185);
    expect(screen.getByRole("spinbutton", { name: "B" })).toHaveValue(252);
  });

  it("takes RGB and updates HEX", () => {
    render(<Harness />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "R" }), { target: { value: "255" } });

    expect(screen.getByTestId("color")).toHaveTextContent("#ffb9fc");
    expect(screen.getByRole("textbox")).toHaveValue("#ffb9fc");
  });

  it("takes HEX and updates RGB, clamping nothing on bad input", () => {
    render(<Harness />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "#00ff99" } });
    expect(screen.getByRole("spinbutton", { name: "G" })).toHaveValue(255);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "#zz" } });
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("color")).toHaveTextContent("#00ff99");
  });

  it("moves the hue with arrow keys on the wheel", () => {
    render(<Harness />);
    const wheel = screen.getByRole("slider", { name: "Цветовой круг" });
    const before = Number(wheel.getAttribute("aria-valuenow"));

    fireEvent.keyDown(wheel, { key: "ArrowRight", shiftKey: true });

    expect(Number(wheel.getAttribute("aria-valuenow"))).toBe((before + 10) % 360);
    expect(screen.getByTestId("color")).not.toHaveTextContent("#5ab9fc");
  });
});
