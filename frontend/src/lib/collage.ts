/**
 * Collage geometry: tiles sit on a 12-column grid (4 on phones), rows are a fixed
 * height that grows if text needs more. Pure functions, shared by the render and the editor.
 */
import {
  DESKTOP_COLUMNS,
  MAX_ROW,
  MAX_SPAN_ROWS,
  PHONE_COLUMNS,
  type Place,
  type Tile,
} from "@/blocks/schemas";

export type Cell = "s" | "m" | "l";
export type Grid = "desktop" | "phone";

/** Row height in px (desktop, phone). */
export const CELL_PX: Record<Cell, { desktop: number; phone: number }> = {
  s: { desktop: 56, phone: 44 },
  m: { desktop: 80, phone: 60 },
  l: { desktop: 112, phone: 84 },
};

/** Column width the layouts are judged by: a 1200px desktop row, a 360px phone. */
const COLUMN_PX = { desktop: 1200 / DESKTOP_COLUMNS, phone: 360 / PHONE_COLUMNS };

export const COLUMNS: Record<Grid, number> = { desktop: DESKTOP_COLUMNS, phone: PHONE_COLUMNS };

export function clampPlace(place: Place, grid: Grid): Place {
  const cols = COLUMNS[grid];
  const w = Math.min(Math.max(1, Math.round(place.w)), cols);
  const h = Math.min(Math.max(1, Math.round(place.h)), MAX_SPAN_ROWS);
  return {
    x: Math.min(Math.max(0, Math.round(place.x)), cols - w),
    y: Math.min(Math.max(0, Math.round(place.y)), MAX_ROW - 1),
    w,
    h,
  };
}

/** First free row under all tiles of a layout. */
export function bottom(places: readonly Place[]): number {
  return places.reduce((max, p) => Math.max(max, p.y + p.h), 0);
}

const isMedia = (tile: Tile) =>
  tile.kind === "image" || tile.kind === "video" || tile.kind === "embed";

/**
 * The phone layout when the owner has not drawn one: tiles in reading order (top to
 * bottom, left to right), narrow neighbours side by side, the rest full width, pictures
 * keeping their desktop proportions.
 */
export function autoPhone(tiles: readonly Tile[], cell: Cell): Map<string, Place> {
  const order = [...tiles].sort((a, b) => a.desktop.y - b.desktop.y || a.desktop.x - b.desktop.x);
  const result = new Map<string, Place>();
  let y = 0;
  let pending: { tile: Tile; h: number } | null = null;

  const height = (tile: Tile, w: number) => {
    if (!isMedia(tile)) return Math.max(1, Math.min(tile.desktop.h, 3));
    const ratio = (tile.desktop.h * CELL_PX[cell].desktop) / (tile.desktop.w * COLUMN_PX.desktop);
    const px = w * COLUMN_PX.phone * ratio;
    return Math.min(MAX_SPAN_ROWS, Math.max(1, Math.round(px / CELL_PX[cell].phone)));
  };

  for (const tile of order) {
    const narrow = tile.desktop.w <= DESKTOP_COLUMNS / 3 && isMedia(tile);
    if (narrow && pending) {
      const h = Math.max(pending.h, height(tile, 2));
      result.set(pending.tile.id, { x: 0, y, w: 2, h });
      result.set(tile.id, { x: 2, y, w: 2, h });
      y += h;
      pending = null;
      continue;
    }
    if (pending) {
      result.set(pending.tile.id, { x: 0, y, w: PHONE_COLUMNS, h: height(pending.tile, 4) });
      y += result.get(pending.tile.id)!.h;
      pending = null;
    }
    if (narrow) {
      pending = { tile, h: height(tile, 2) };
      continue;
    }
    const h = height(tile, PHONE_COLUMNS);
    result.set(tile.id, { x: 0, y, w: PHONE_COLUMNS, h });
    y += h;
  }
  if (pending) {
    result.set(pending.tile.id, {
      x: 0,
      y,
      w: PHONE_COLUMNS,
      h: height(pending.tile, PHONE_COLUMNS),
    });
  }
  return result;
}

/** Where every tile sits on phones: the owner's places, or the automatic ones. */
export function phonePlaces(
  tiles: readonly Tile[],
  mode: "auto" | "custom",
  cell: Cell,
): Map<string, Place> {
  const auto = autoPhone(tiles, cell);
  if (mode === "auto") return auto;
  return new Map(tiles.map((t) => [t.id, t.phone ?? auto.get(t.id)!]));
}

export function newTileId(): string {
  return (
    Math.random()
      .toString(36)
      .slice(2, 10)
      .replace(/[^a-z0-9]/g, "") || "t"
  );
}
