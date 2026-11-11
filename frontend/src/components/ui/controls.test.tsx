import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ProgressBar } from "./ProgressBar";
import { Segmented, Tabs } from "./Segmented";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("exposes switch role and toggles", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Свечение" />);

    const sw = screen.getByRole("switch", { name: "Свечение" });
    expect(sw).toHaveAttribute("aria-checked", "false");

    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Segmented", () => {
  it("marks the selected option as pressed", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Сторона"
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "Бизнес" },
          { value: "b", label: "Личное" },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Бизнес" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Личное" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

function TabsHarness() {
  const [value, setValue] = useState("one");
  return (
    <Tabs
      idBase="t"
      label="Разделы"
      value={value}
      onChange={setValue}
      options={[
        { value: "one", label: "Игры" },
        { value: "two", label: "Книги" },
        { value: "three", label: "Аниме" },
      ]}
    />
  );
}

describe("Tabs", () => {
  it("moves selection with arrow keys and wraps around", () => {
    render(<TabsHarness />);
    const list = screen.getByRole("tablist", { name: "Разделы" });

    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Книги" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Книги" })).toHaveFocus();

    fireEvent.keyDown(list, { key: "ArrowLeft" });
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Аниме" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps only the selected tab in the tab order", () => {
    render(<TabsHarness />);

    expect(screen.getByRole("tab", { name: "Игры" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Книги" })).toHaveAttribute("tabindex", "-1");
  });
});

describe("ProgressBar", () => {
  it("clamps and reports the value", () => {
    render(<ProgressBar label="Прочитано" value={1.4} />);

    expect(screen.getByRole("progressbar", { name: "Прочитано" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });
});
