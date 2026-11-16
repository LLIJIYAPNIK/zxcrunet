import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatalogIndex, EMPTY_CATALOG } from "@/lib/catalog/catalog";

import { Blocks } from "./renderers";
import {
  DEFAULT_APPEARANCE,
  carouselSchema,
  validateBlock,
  videoSchema,
  type AnyBlock,
  type SettingsOf,
} from "./schemas";

const ctx = {
  address: "anna.zxc.ru.net",
  siteTitle: "Анна",
  catalog: new CatalogIndex(EMPTY_CATALOG),
};

const CLIP = { id: "0195f3a0-0000-7000-8000-000000000001", url: "/media/2026/11/a.mp4" };
const PICTURE = {
  id: "0195f3a0-0000-7000-8000-000000000002",
  url: "/media/2026/11/b.webp",
  width: 1200,
  height: 800,
};

function video(settings: Partial<SettingsOf<"video">>): AnyBlock {
  return {
    id: "0195f3a0-0000-7000-8000-0000000000a1",
    type: "video",
    version: 1,
    hidden: false,
    settings: videoSchema.parse(settings),
  };
}

function carousel(settings: Partial<SettingsOf<"carousel">>): AnyBlock {
  return {
    id: "0195f3a0-0000-7000-8000-0000000000a2",
    type: "carousel",
    version: 1,
    hidden: false,
    settings: carouselSchema.parse(settings),
  };
}

const items = [
  { media: PICTURE, alt: "Закат над морем", link: null },
  { media: CLIP, alt: "Волны", link: null },
  { media: PICTURE, alt: "Маяк", link: { label: "", url: "https://lighthouse.example" } },
];

describe("video block", () => {
  it("embeds a player built from the id", () => {
    render(
      <Blocks
        blocks={[
          video({
            title: "Мой доклад",
            embed: { provider: "youtube", id: "dQw4w9WgXcQ", hash: "" },
          }),
        ]}
        ctx={ctx}
      />,
    );
    const frame = screen.getByTitle("Мой доклад");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
    expect(frame).toHaveAttribute("loading", "lazy");
  });

  it("plays an uploaded clip with controls or as a silent loop", () => {
    const { container, rerender } = render(
      <Blocks blocks={[video({ source: "file", file: CLIP, poster: PICTURE })]} ctx={ctx} />,
    );
    let clip = container.querySelector("video")!;
    expect(clip).toHaveAttribute("controls");
    expect(clip).toHaveAttribute("poster", PICTURE.url);

    rerender(<Blocks blocks={[video({ source: "file", file: CLIP, mode: "loop" })]} ctx={ctx} />);
    clip = container.querySelector("video")!;
    expect(clip).not.toHaveAttribute("controls");
    expect(clip.muted).toBe(true);
    expect(clip).toHaveAttribute("loop");
  });

  it("renders nothing until a video is chosen", () => {
    const { container } = render(<Blocks blocks={[video({ title: "Скоро" })]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("refuses a picture where a clip is expected", () => {
    expect(validateBlock(video({ source: "file", file: CLIP }))).toBeNull();
    const bad = video({});
    (bad.settings as SettingsOf<"video">).file = PICTURE;
    expect(validateBlock(bad)).not.toBeNull();
  });
});

describe("carousel block", () => {
  it("shows slides with arrows and dots that move between them", () => {
    render(<Blocks blocks={[carousel({ title: "Лето", items })]} ctx={ctx} />);

    const region = screen.getByRole("region", { name: "Лето" });
    expect(region).toHaveAttribute("aria-roledescription", "карусель");
    expect(screen.getByRole("img", { name: "Закат над морем" })).toBeInTheDocument();
    expect(screen.getByLabelText("Волны").tagName).toBe("VIDEO");
    expect(screen.getByRole("link", { name: "Маяк" })).toHaveAttribute(
      "href",
      "https://lighthouse.example",
    );

    const dots = screen.getAllByRole("button", { name: /^Слайд/ });
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Следующий слайд" }));
    expect(dots[1]).toHaveAttribute("aria-current", "true");
    fireEvent.click(screen.getByRole("button", { name: "Предыдущий слайд" }));
    fireEvent.click(screen.getByRole("button", { name: "Предыдущий слайд" }));
    // Round and round: before the first comes the last.
    expect(dots[2]).toHaveAttribute("aria-current", "true");
  });

  it("runs a strip twice over, the copy hidden from screen readers", () => {
    const { container } = render(
      <Blocks
        blocks={[carousel({ items, mode: "marquee", speed: 25, direction: "right" })]}
        ctx={ctx}
      />,
    );
    const strip = container.querySelector("[data-marquee]") as HTMLElement;
    expect(strip).toHaveAttribute("data-direction", "right");
    expect(strip.style.getPropertyValue("--marquee-duration")).toBe("25s");
    const halves = strip.querySelectorAll(".marquee-track > div");
    expect(halves).toHaveLength(2);
    expect(halves[1]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("img", { name: "Закат над морем" })).toHaveLength(1);
  });

  it("skips a frame whose file is still being uploaded (editor preview)", () => {
    const draft = carousel({ items, mode: "marquee" });
    (draft.settings as { items: unknown[] }).items.push({ alt: "", link: null });
    render(<Blocks blocks={[draft]} ctx={ctx} />);
    expect(screen.getAllByRole("img", { name: "Закат над морем" })).toHaveLength(1);
  });

  it("is hidden while empty", () => {
    const { container } = render(<Blocks blocks={[carousel({ title: "Пусто" })]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("video section background", () => {
  it("loops a muted clip under a shade, behind the content", () => {
    const block: AnyBlock = {
      ...carousel({ items }),
      appearance: { ...DEFAULT_APPEARANCE, background: "video", video: CLIP, dim: 30 },
    };
    const { container } = render(<Blocks blocks={[block]} ctx={ctx} />);
    const frame = container.querySelector("[data-section]")!;
    const clip = frame.querySelector(":scope > span[aria-hidden] video") as HTMLVideoElement;
    expect(clip).toHaveAttribute("src", CLIP.url);
    expect(clip.muted).toBe(true);
    expect((frame.querySelector("[data-shade]") as HTMLElement).style.background).toBe(
      "rgba(0, 0, 0, 0.3)",
    );
  });
});
