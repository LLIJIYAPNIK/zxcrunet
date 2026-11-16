import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteScope } from "@/components/public/SiteScope";
import { CatalogIndex, EMPTY_CATALOG } from "@/lib/catalog/catalog";
import { contrast } from "@/lib/theme/color";
import { BODY_FONT_IDS, FONTS, FONT_IDS } from "@/lib/theme/fonts";
import { derivePalette } from "@/lib/theme/palette";
import { STYLES, lookFonts } from "@/lib/theme/styles";

import { Blocks } from "./renderers";
import {
  DEFAULT_APPEARANCE,
  appearanceSchema,
  cleanAppearance,
  validateBlock,
  type AnyBlock,
} from "./schemas";

const ctx = {
  address: "anna.zxc.ru.net",
  siteTitle: "Анна",
  catalog: new CatalogIndex(EMPTY_CATALOG),
};

const facts = (appearance?: AnyBlock["appearance"]): AnyBlock => ({
  id: "0193a0b0-0000-7000-8000-000000000001",
  type: "facts",
  version: 1,
  hidden: false,
  settings: { items: [{ value: "8", label: "лет в профессии" }] },
  appearance,
});

function frame(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-section]");
}

describe("fonts and styles", () => {
  it("offers only readable faces for text, and every style uses known fonts", () => {
    expect(BODY_FONT_IDS.every((id) => FONTS[id].body)).toBe(true);
    expect(BODY_FONT_IDS.length).toBeLessThan(FONT_IDS.length);
    for (const style of Object.values(STYLES)) {
      expect(FONT_IDS).toContain(style.heading);
      expect(BODY_FONT_IDS).toContain(style.body);
    }
  });

  it("falls back to the style's fonts", () => {
    expect(lookFonts({ style: "gothic", heading_font: "", body_font: "" })).toEqual({
      heading: "cormorant",
      body: "lora",
    });
    expect(lookFonts({ style: "gothic", heading_font: "ruslan" }).heading).toBe("ruslan");
  });

  it("makes gothic grounds darker with a softer glow, keeping contrast", () => {
    const neon = derivePalette("#f0283f", "#d4af37");
    const gothic = derivePalette("#f0283f", "#d4af37", "gothic");
    expect(contrast(gothic.bg, "#000000")).toBeLessThan(contrast(neon.bg, "#000000"));
    expect(gothic.glow).toContain("0.2)");
    expect(contrast(gothic.accent, gothic.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("puts the style and fonts on the card root", () => {
    const { container } = render(
      <SiteScope
        theme={{
          accent: "#5ab9fc",
          second: null,
          style: "gothic",
          heading_font: "ruslan",
          body_font: "",
        }}
      >
        <p>Привет</p>
      </SiteScope>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-style", "gothic");
    expect(root.style.getPropertyValue("--site-display")).toBe("var(--ff-ruslan)");
    expect(root.style.getPropertyValue("--site-sans")).toBe("var(--ff-lora)");
  });
});

describe("section appearance", () => {
  it("leaves a plain block unwrapped", () => {
    const { container } = render(<Blocks blocks={[facts()]} ctx={ctx} />);
    expect(frame(container)).toBeNull();
  });

  it("paints a light colour with dark ink and adds room", () => {
    const { container } = render(
      <Blocks
        blocks={[
          facts({ ...DEFAULT_APPEARANCE, background: "color", color: "#f4efe6", space: "l" }),
        ]}
        ctx={ctx}
      />,
    );
    const el = frame(container)!;
    expect(el.style.backgroundColor).toBe("rgb(244, 239, 230)");
    expect(el.style.getPropertyValue("--ink")).toBe("#14110f");
    expect(el.className).toContain("py-20");
    expect(screen.getByText("лет в профессии")).toBeInTheDocument();
  });

  it("darkens a background image and switches fonts for the section", () => {
    const { container } = render(
      <Blocks
        blocks={[
          facts({
            ...DEFAULT_APPEARANCE,
            background: "image",
            image: { id: "0193a0b0-0000-7000-8000-0000000000aa", url: "/media/2026/11/c.webp" },
            dim: 60,
            heading_font: "monomakh",
            body_font: "eb-garamond",
            divider: "ornament",
          }),
        ]}
        ctx={ctx}
      />,
    );
    const el = frame(container)!;
    expect(el.style.backgroundImage).toContain("rgba(0, 0, 0, 0.6)");
    expect(el.style.backgroundImage).toContain("/media/2026/11/c.webp");
    expect(el.style.getPropertyValue("--site-display")).toBe("var(--ff-monomakh)");
    expect(el.style.getPropertyValue("--site-sans")).toBe("var(--ff-eb-garamond)");
    expect(el.querySelector("[data-ornament]")).not.toBeNull();
  });

  it("draws a pattern layer for pattern backgrounds", () => {
    const { container } = render(
      <Blocks
        blocks={[facts({ ...DEFAULT_APPEARANCE, background: "pattern", pattern: "arches" })]}
        ctx={ctx}
      />,
    );
    expect(container.querySelector('[data-pattern="arches"]')).not.toBeNull();
  });

  it("validates appearance and drops an all-default one", () => {
    expect(cleanAppearance({ ...DEFAULT_APPEARANCE })).toBeNull();
    expect(cleanAppearance({ ...DEFAULT_APPEARANCE, divider: "line" })?.divider).toBe("line");
    expect(appearanceSchema.safeParse({ body_font: "ruslan" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ color: "red" }).success).toBe(false);
    expect(
      validateBlock(facts({ ...DEFAULT_APPEARANCE, dim: 95 } as AnyBlock["appearance"])),
    ).not.toBeNull();
    expect(validateBlock(facts({ ...DEFAULT_APPEARANCE, background: "accent" }))).toBeNull();
  });
});
