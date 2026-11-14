import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogIndex, EMPTY_CATALOG } from "@/lib/catalog/catalog";

import { Blocks } from "./renderers";
import { SAMPLE_BUSINESS_BLOCKS } from "./sample";
import {
  BLOCK_TYPES,
  META,
  SCHEMAS,
  anchorId,
  defaultSettings,
  linkSchema,
  validateBlock,
  type AnyBlock,
} from "./schemas";

const ctx = {
  address: "anna.zxc.ru.net",
  siteTitle: "Анна Волкова",
  catalog: new CatalogIndex(EMPTY_CATALOG),
};

describe("block registry", () => {
  it("has metadata, a schema and a default for every type", () => {
    for (const type of BLOCK_TYPES) {
      expect(META[type].title).toBeTruthy();
      expect(SCHEMAS[type]).toBeDefined();
      const result = SCHEMAS[type].safeParse(defaultSettings(type, "Анна"));
      // These start with an empty item for the owner to fill in (autosave waits for it).
      const waitsForInput = ["top", "quotes", "playlist"].includes(type);
      expect(result.success, `${type} default is valid`).toBe(!waitsForInput);
    }
  });

  it("validates the reference sample", () => {
    for (const block of SAMPLE_BUSINESS_BLOCKS) {
      expect(validateBlock(block), block.type).toBeNull();
    }
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "//evil.example", "https://a b"])(
    "rejects unsafe link %s",
    (url) => {
      expect(linkSchema.safeParse({ label: "x", url }).success).toBe(false);
    },
  );

  it.each(["https://t.me/anna", "mailto:a@b.c", "tel:+7999", "tg://resolve?domain=a", "#contacts"])(
    "accepts link %s",
    (url) => {
      expect(linkSchema.safeParse({ label: "x", url }).success).toBe(true);
    },
  );

  it("builds stable anchors", () => {
    expect(anchorId({ id: "0195f3a0-0000-7000-8000-000000000004", type: "projects" })).toBe(
      "b-00000004",
    );
    expect(anchorId({ id: "x", type: "contacts" })).toBe("contacts");
  });
});

const facts = (n: number): AnyBlock => ({
  id: "f",
  type: "facts",
  version: 1,
  hidden: false,
  settings: { items: Array.from({ length: n }, (_, i) => ({ value: String(i), label: "x" })) },
});

describe("facts layout", () => {
  it.each([
    [3, "@4xl:grid-cols-3"],
    [5, "@4xl:grid-cols-5"],
    [6, "@4xl:grid-cols-3"],
    [8, "@4xl:grid-cols-4"],
    [10, "@4xl:grid-cols-5"],
  ])("%i facts get balanced rows", (n, cols) => {
    expect(validateBlock(facts(n))).toBeNull();
    const { container } = render(<Blocks blocks={[facts(n)]} ctx={ctx} />);

    expect(container.querySelector(".grid")).toHaveClass(cols);
  });

  it("an odd last fact spans the whole row on phones", () => {
    const { container } = render(<Blocks blocks={[facts(3)]} ctx={ctx} />);
    const cells = container.querySelectorAll(".grid > div");

    expect(cells[2]).toHaveClass("@max-4xl:col-span-2");
    expect(cells[1]).not.toHaveClass("@max-4xl:col-span-2");
  });

  it("takes at most ten facts", () => {
    expect(validateBlock(facts(11))).not.toBeNull();
  });
});

describe("renders", () => {
  it("renders every block of the sample", () => {
    render(<Blocks blocks={SAMPLE_BUSINESS_BLOCKS} ctx={ctx} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Анна Волкова");
    expect(screen.getByText("anna.zxc.ru.net")).toBeInTheDocument();
    expect(screen.getByText("7 лет")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Где училась и работаю" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Мобильный банк/ })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByText("Доступность")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Figma" })).toHaveAttribute("aria-valuenow", "95");
    expect(screen.getAllByText("Senior")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /anna@example.com/ })).toHaveAttribute(
      "href",
      "mailto:anna@example.com",
    );
  });

  it("skips hidden blocks and a resume without a file", () => {
    const blocks: AnyBlock[] = [
      { ...SAMPLE_BUSINESS_BLOCKS.find((b) => b.type === "interests")!, hidden: true },
      {
        id: "r",
        type: "resume",
        version: 1,
        hidden: false,
        settings: { label: "Скачать резюме", file: null },
      },
    ];

    const { container } = render(<Blocks blocks={blocks} ctx={ctx} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("ignores unknown block types instead of crashing", () => {
    const blocks = [{ id: "x", type: "future", version: 1, hidden: false, settings: {} }];

    const { container } = render(<Blocks blocks={blocks as unknown as AnyBlock[]} ctx={ctx} />);

    expect(container).toBeEmptyDOMElement();
  });
});
