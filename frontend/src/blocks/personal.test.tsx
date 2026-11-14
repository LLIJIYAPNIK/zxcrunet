import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TitlePage } from "@/components/catalog/TitlePage";
import { CatalogIndex, EMPTY_CATALOG } from "@/lib/catalog/catalog";

import { Blocks } from "./renderers";
import { SAMPLE_CATALOG, SAMPLE_GAMES_BLOCKS, SAMPLE_PERSONAL_BLOCKS } from "./sample-personal";
import { SPINE_MIN_WIDTH, spineSize } from "./personal";
import { validateBlock } from "./schemas";

const ctx = {
  address: "sasha.zxc.ru.net",
  siteTitle: "Саша Орлов",
  catalog: new CatalogIndex(SAMPLE_CATALOG),
};

describe("personal blocks", () => {
  it("the reference sample is valid", () => {
    for (const block of [...SAMPLE_PERSONAL_BLOCKS, ...SAMPLE_GAMES_BLOCKS]) {
      expect(validateBlock(block), block.type).toBeNull();
    }
  });

  it("renders the profile from the catalog", () => {
    render(<Blocks blocks={SAMPLE_PERSONAL_BLOCKS} ctx={ctx} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Саша Орлов");
    expect(screen.getByText("Дочитываю Канемана")).toBeInTheDocument();
    // «Сейчас», bento with the Dark Souls stack, rings, ticket stubs, playlist, posts.
    expect(screen.getAllByRole("link", { name: /Elden Ring.*86 ч наиграно/ })[0]).toHaveAttribute(
      "href",
      "/games/elden-ring",
    );
    expect(screen.getAllByRole("link", { name: /3 части.*Dark Souls/ })[0]).toHaveAttribute(
      "href",
      "/games/dark-souls",
    );
    expect(screen.getByRole("link", { name: /Леви/ })).toHaveAttribute(
      "href",
      "/anime/attack-on-titan",
    );
    expect(screen.getByRole("link", { name: /Дюна: Часть вторая.*9/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Прочитано по месяцам" })).toBeInTheDocument();
    expect(screen.getByText("Dark Souls III закрывает круг")).toBeInTheDocument();
  });

  it("hides catalog blocks with nothing to show, except in the editor preview", () => {
    const empty = { ...ctx, catalog: new CatalogIndex(EMPTY_CATALOG) };
    const { container, rerender } = render(<Blocks blocks={SAMPLE_GAMES_BLOCKS} ctx={empty} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<Blocks blocks={SAMPLE_GAMES_BLOCKS} ctx={{ ...empty, preview: true }} />);
    expect(container.querySelector("[data-empty-hint]")).not.toBeNull();
  });

  it("the games section lets guests filter", () => {
    render(<Blocks blocks={SAMPLE_GAMES_BLOCKS} ctx={ctx} />);
    const filters = screen.getByRole("group", { name: "Статус" });

    expect(within(filters).getByRole("button", { name: "Все" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("region", { name: "Dark Souls" })).toBeInTheDocument();
  });
});

describe("title page", () => {
  it("shows a series: parts, criteria, spoilers, characters, bosses, tracks, related", () => {
    const index = new CatalogIndex(SAMPLE_CATALOG);
    render(<TitlePage title={index.find("game", "dark-souls")!} index={index} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dark Souls");
    expect(screen.getByText("2 из 3")).toBeInTheDocument();
    expect(screen.getByText("142 ч")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Части и дополнения" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показать спойлеры" })).toBeInTheDocument();
    expect(screen.getByText("Боссы · III")).toBeInTheDocument();
    expect(screen.getByText("Firelink Shrine")).toBeInTheDocument();
    expect(screen.getByText(/предшественник · нет на полке/)).toBeInTheDocument();
    expect(screen.getByText("Dark Souls III закрывает круг")).toBeInTheDocument();
  });
});

describe("book spines", () => {
  it("are never too thin for their text, whatever the id", () => {
    const ids = [
      ...SAMPLE_CATALOG.titles.map((t) => t.id),
      "ffffffff-ffff-7fff-bfff-ffffffffffff",
      "0195f3a0-9999-7999-8999-999999999999",
    ];
    for (const id of ids) {
      const { width } = spineSize({ id } as Parameters<typeof spineSize>[0]);
      expect(width, id).toBeGreaterThanOrEqual(SPINE_MIN_WIDTH);
    }
  });
});
