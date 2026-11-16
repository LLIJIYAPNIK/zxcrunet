import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { CollageEditor } from "@/components/builder/CollageEditor";
import { CatalogIndex, EMPTY_CATALOG } from "@/lib/catalog/catalog";
import { autoPhone, bottom, clampPlace, phonePlaces } from "@/lib/collage";

import { Blocks } from "./renderers";
import { LOOK_BASE, SAMPLE_GOTHIC_BLOCKS } from "./sample-gothic";
import {
  DEFAULT_APPEARANCE,
  collageSchema,
  heroSchema,
  tileSchema,
  validateBlock,
  type AnyBlock,
  type SettingsOf,
  type Tile,
} from "./schemas";

const ctx = {
  address: "mira.zxc.ru.net",
  siteTitle: "Мира",
  catalog: new CatalogIndex(EMPTY_CATALOG),
};

const PICTURE = { id: "0195f3a0-0000-7000-8000-000000000002", url: "/media/2026/11/b.webp" };
const CLIP = { id: "0195f3a0-0000-7000-8000-000000000001", url: "/media/2026/11/a.mp4" };

function tile(id: string, kind: Tile["kind"], x: number, y: number, w: number, h: number) {
  return tileSchema.parse({
    id,
    kind,
    desktop: { x, y, w, h },
    ...(kind === "image" ? { media: PICTURE, alt: id } : {}),
    ...(kind === "text" ? { text: `Текст ${id}` } : {}),
  });
}

function block(type: "collage" | "hero", settings: unknown): AnyBlock {
  return {
    id: "0195f3a0-0000-7000-8000-0000000000c1",
    type,
    version: 1,
    hidden: false,
    settings,
  } as AnyBlock;
}

describe("collage geometry", () => {
  it("keeps places inside the grid", () => {
    expect(clampPlace({ x: 10, y: -2, w: 5, h: 40 }, "desktop")).toEqual({
      x: 7,
      y: 0,
      w: 5,
      h: 24,
    });
    expect(clampPlace({ x: 3, y: 1, w: 9, h: 1 }, "phone")).toEqual({ x: 0, y: 1, w: 4, h: 1 });
    expect(
      bottom([
        { x: 0, y: 2, w: 1, h: 3 },
        { x: 0, y: 0, w: 1, h: 1 },
      ]),
    ).toBe(5);
  });

  it("stacks tiles for phones in reading order, narrow pictures in pairs", () => {
    const tiles = [
      tile("text", "text", 0, 4, 12, 2),
      tile("big", "image", 0, 0, 8, 4),
      tile("a", "image", 8, 0, 4, 2),
      tile("b", "image", 8, 2, 4, 2),
    ];
    const phone = autoPhone(tiles, "m");

    expect(phone.get("big")).toMatchObject({ x: 0, y: 0, w: 4 });
    const big = phone.get("big")!;
    expect(phone.get("a")).toMatchObject({ x: 0, y: big.h, w: 2 });
    expect(phone.get("b")).toMatchObject({ x: 2, y: big.h, w: 2 });
    expect(phone.get("text")!.y).toBe(big.h + phone.get("a")!.h);
    // A 8×4 picture (≈ 800×320 px) stays wide on a phone: 360 px → about 2 rows of 60.
    expect(big.h).toBe(2);
  });

  it("uses the owner's phone places when asked", () => {
    const custom = { ...tile("a", "image", 0, 0, 6, 3), phone: { x: 1, y: 7, w: 3, h: 2 } };
    expect(phonePlaces([custom], "custom", "m").get("a")).toEqual({ x: 1, y: 7, w: 3, h: 2 });
    expect(phonePlaces([custom], "auto", "m").get("a")).toMatchObject({ x: 0, y: 0, w: 4 });
  });
});

describe("collage block", () => {
  it("puts every tile on both grids through CSS variables, layered", () => {
    const settings = collageSchema.parse({
      title: "Работы",
      tiles: [
        { ...tile("pic", "image", 2, 1, 6, 4), layer: 3 },
        tile("note", "text", 6, 3, 6, 2),
        {
          ...tile("go", "button", 0, 5, 3, 1),
          link: { label: "Написать", url: "https://t.me/mira" },
        },
        { ...tile("clip", "video", 8, 0, 4, 3), media: CLIP, alt: "Туман" },
      ],
    });
    const { container } = render(<Blocks blocks={[block("collage", settings)]} ctx={ctx} />);

    const pic = container.querySelector('[data-tile="image"]') as HTMLElement;
    expect(pic.style.getPropertyValue("--dx")).toBe("3");
    expect(pic.style.getPropertyValue("--dw")).toBe("6");
    expect(pic.style.getPropertyValue("--layer")).toBe("3");
    expect(pic.style.getPropertyValue("--pw")).toBe("4");
    expect(screen.getByRole("img", { name: "pic" })).toBeInTheDocument();
    expect(screen.getByText("Текст note")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Написать/ })).toHaveAttribute(
      "href",
      "https://t.me/mira",
    );
    expect(screen.getByLabelText("Туман").tagName).toBe("VIDEO");
  });

  it("validates the shape of tiles", () => {
    const ok = collageSchema.parse({ tiles: [tile("a", "text", 0, 0, 12, 1)] });
    expect(validateBlock(block("collage", ok))).toBeNull();
    const wide = { ...ok, tiles: [{ ...ok.tiles[0], desktop: { x: 8, y: 0, w: 6, h: 1 } }] };
    expect(validateBlock(block("collage", wide))).not.toBeNull();
    const twins = { ...ok, tiles: [ok.tiles[0], ok.tiles[0]] };
    expect(validateBlock(block("collage", twins))).not.toBeNull();
  });
});

describe("hero layouts", () => {
  const base = { title: "Мира Чернова" };

  it("lays pictures out as a scrapbook collage", () => {
    const settings = heroSchema.parse({ ...base, layout: "collage", media: [PICTURE, CLIP] });
    const { container } = render(<Blocks blocks={[block("hero", settings)]} ctx={ctx} />);
    const board = container.querySelector("[data-hero-collage]")!;
    expect(board.children).toHaveLength(2);
    expect(board.querySelector("video")).not.toBeNull();
    expect(container.querySelector('[data-hero="collage"]')).not.toBeNull();
  });

  it("fills the first screen with a picture or clip under a shade", () => {
    const settings = heroSchema.parse({
      ...base,
      layout: "fullscreen",
      background: CLIP,
      dim: 30,
      align: "center",
    });
    const { container } = render(<Blocks blocks={[block("hero", settings)]} ctx={ctx} />);
    expect(container.querySelector('[data-hero="fullscreen"] video')).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).parentElement).toHaveClass("text-center");
  });
});

describe("gothic sample", () => {
  it("is valid once its demo files are uploaded", () => {
    const uploaded = JSON.parse(
      JSON.stringify(SAMPLE_GOTHIC_BLOCKS).replaceAll('"/demo/', '"/media/demo/'),
    ) as AnyBlock[];
    for (const b of uploaded) expect(validateBlock(b), b.type).toBeNull();
    expect(LOOK_BASE).toEqual(DEFAULT_APPEARANCE);
  });
});

function Harness({ initial }: { initial: SettingsOf<"collage"> }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CollageEditor value={value} onChange={setValue} />
      <output data-testid="state">{JSON.stringify(value.tiles.map((t) => t.desktop))}</output>
    </>
  );
}

describe("collage editor", () => {
  it("adds tiles under the others and moves or resizes them with the keyboard", () => {
    render(<Harness initial={collageSchema.parse({ tiles: [tile("a", "text", 0, 0, 6, 2)] })} />);
    const state = () => JSON.parse(screen.getByTestId("state").textContent!);

    fireEvent.click(screen.getByRole("button", { name: "Картинка" }));
    expect(state()[1]).toEqual({ x: 0, y: 2, w: 6, h: 4 });

    const added = screen.getByRole("button", { name: /^Картинка: колонка 1, ряд 3/ });
    fireEvent.keyDown(added, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("button", { name: /^Картинка: колонка 2/ }), {
      key: "ArrowDown",
      shiftKey: true,
    });
    expect(state()[1]).toEqual({ x: 1, y: 2, w: 6, h: 5 });

    fireEvent.click(screen.getByRole("button", { name: "Удалить плитку" }));
    expect(state()).toHaveLength(1);
  });
});
