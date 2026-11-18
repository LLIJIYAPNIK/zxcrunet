"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  LinkField,
  MediaField,
  NumberField,
  SelectField,
  TextField,
  ToggleField,
} from "@/blocks/fields";
import { VideoLinkField } from "@/blocks/media-editors";
import {
  DESKTOP_COLUMNS,
  MAX_ROW,
  MAX_SPAN_ROWS,
  PHONE_COLUMNS,
  TILE_KINDS,
  isVideo,
  type Place,
  type SettingsOf,
  type Tile,
  type TileKind,
} from "@/blocks/schemas";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { ColorPicker } from "@/components/theme/ColorPicker";
import { FontPicker } from "@/components/builder/FontPicker";
import { ru } from "@/i18n/ru";
import { cn } from "@/lib/cn";
import { FONT_IDS } from "@/lib/theme/fonts";
import {
  CELL_PX,
  COLUMNS,
  autoPhone,
  bottom,
  clampPlace,
  newTileId,
  type Grid,
} from "@/lib/collage";

const t = ru.builder.collage;
const f = ru.builder.fields;

type Settings = SettingsOf<"collage">;

/** Reference widths the row heights are designed for (see lib/collage.ts). */
const DESIGN_WIDTH: Record<Grid, number> = { desktop: 1200, phone: 360 };

const NEW_SIZE: Record<TileKind, { w: number; h: number }> = {
  image: { w: 6, h: 4 },
  video: { w: 6, h: 4 },
  embed: { w: 8, h: 5 },
  audio: { w: 5, h: 2 },
  text: { w: 6, h: 2 },
  button: { w: 3, h: 1 },
};

function blankTile(kind: TileKind, desktop: Place, phone: Place | null): Tile {
  return {
    id: newTileId(),
    kind,
    media: null,
    embed: null,
    audio_url: null,
    audio_title: "",
    audio_artist: "",
    audio_animation: "equalizer",
    audio_progress: "line",
    audio_color: "#b8ff3b",
    audio_background: "#171a20",
    text: "",
    text_style: kind === "text" ? "heading" : "body",
    text_font: null,
    text_size: null,
    text_color: null,
    align: "left",
    link: null,
    fill: "none",
    fit: "cover",
    rounded: true,
    alt: "",
    desktop,
    phone,
    layer: 1,
  };
}

function Thumb({ tile }: { tile: Tile }) {
  if ((tile.kind === "image" || tile.kind === "video") && tile.media) {
    return isVideo(tile.media) ? (
      <span className="grid size-full place-items-center bg-black/60 text-ink">
        <Icon name="play" size={16} />
      </span>
    ) : (
      <span
        className="block size-full bg-cover bg-center"
        style={{ backgroundImage: `url(${tile.media.url})` }}
      />
    );
  }
  const text =
    tile.kind === "text"
      ? tile.text
      : tile.kind === "audio"
        ? tile.audio_title || t.kinds.audio
        : tile.kind === "button"
          ? tile.link?.label
          : tile.kind === "embed" && tile.embed
            ? t.kinds.embed
            : "";
  return (
    <span className="flex size-full flex-col justify-center gap-0.5 overflow-hidden p-1.5 text-[11px] leading-tight">
      <span className="font-medium text-ink-2">{t.kinds[tile.kind]}</span>
      <span className="line-clamp-2 text-muted">{text || t.empty}</span>
    </span>
  );
}

type Drag = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  from: Place;
};

/** The grid the owner arranges tiles on, scaled to the editor panel. */
function Canvas({
  tiles,
  grid,
  places,
  cell,
  selected,
  onSelect,
  onPlace,
}: {
  tiles: readonly Tile[];
  grid: Grid;
  places: Map<string, Place>;
  cell: Settings["cell"];
  selected: string | null;
  onSelect: (id: string) => void;
  onPlace: (id: string, place: Place) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<Place | null>(null);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cols = COLUMNS[grid];
  const colW = width / cols || 1;
  const rowH = (CELL_PX[cell][grid] * width) / DESIGN_WIDTH[grid] || 1;
  const all = tiles.map((tile) => places.get(tile.id)!);
  const rows = Math.min(MAX_ROW, Math.max(6, bottom(all) + 2));

  function start(event: PointerEvent, tile: Tile, mode: Drag["mode"]) {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    onSelect(tile.id);
    setDrag({
      id: tile.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      from: places.get(tile.id)!,
    });
  }

  function move(event: PointerEvent) {
    if (!drag) return;
    const dx = Math.round((event.clientX - drag.startX) / colW);
    const dy = Math.round((event.clientY - drag.startY) / rowH);
    const p = drag.from;
    setDraft(
      clampPlace(
        drag.mode === "move"
          ? { ...p, x: p.x + dx, y: p.y + dy }
          : { ...p, w: p.w + dx, h: p.h + dy },
        grid,
      ),
    );
  }

  function end() {
    if (drag && draft) onPlace(drag.id, draft);
    setDrag(null);
    setDraft(null);
  }

  function keys(event: KeyboardEvent, tile: Tile) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const p = places.get(tile.id)!;
    const [dx, dy] = step;
    onPlace(
      tile.id,
      clampPlace(
        event.shiftKey ? { ...p, w: p.w + dx, h: p.h + dy } : { ...p, x: p.x + dx, y: p.y + dy },
        grid,
      ),
    );
  }

  const lines: CSSProperties = {
    height: rows * rowH,
    backgroundImage:
      "linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)",
    backgroundSize: `${colW}px ${rowH}px`,
  };

  return (
    <div
      ref={box}
      role="group"
      aria-label={t.canvas}
      data-testid="collage-canvas"
      className="relative w-full touch-none rounded-md border border-line-2 bg-bg select-none"
      style={lines}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {[...tiles]
        .sort((a, b) => a.layer - b.layer)
        .map((tile) => {
          const p = drag?.id === tile.id && draft ? draft : places.get(tile.id)!;
          const active = tile.id === selected;
          return (
            <div
              key={tile.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={t.tileLabel
                .replace("{kind}", t.kinds[tile.kind])
                .replace("{x}", String(p.x + 1))
                .replace("{y}", String(p.y + 1))
                .replace("{w}", String(p.w))
                .replace("{h}", String(p.h))}
              data-tile-id={tile.id}
              onPointerDown={(e) => start(e, tile, "move")}
              onKeyDown={(e) => keys(e, tile)}
              onFocus={() => onSelect(tile.id)}
              className={cn(
                "absolute cursor-grab overflow-hidden rounded-sm border bg-raised transition-shadow active:cursor-grabbing",
                active
                  ? "border-accent shadow-[0_0_0_1px_var(--accent)]"
                  : "border-line-2 hover:border-ink-2",
              )}
              style={{
                left: p.x * colW + 1,
                top: p.y * rowH + 1,
                width: p.w * colW - 3,
                height: p.h * rowH - 3,
                zIndex: tile.layer + (active ? 20 : 0),
              }}
            >
              <Thumb tile={tile} />
              {active && (
                <span
                  aria-hidden="true"
                  data-resize=""
                  onPointerDown={(e) => start(e, tile, "resize")}
                  className="absolute right-0 bottom-0 grid size-6 cursor-nwse-resize place-items-center"
                >
                  <span className="size-2.5 rounded-[2px] border-r-2 border-b-2 border-accent" />
                </span>
              )}
            </div>
          );
        })}
    </div>
  );
}

function TileFields({
  tile,
  place,
  grid,
  onChange,
  onPlace,
  onRemove,
}: {
  tile: Tile;
  /** Null while the phone layout is automatic: nothing to place by hand. */
  place: Place | null;
  grid: Grid;
  onChange: (tile: Tile) => void;
  onPlace: (place: Place) => void;
  onRemove: () => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const set = (patch: Partial<Tile>) => onChange({ ...tile, ...patch });
  const media = tile.kind === "image" || tile.kind === "video";
  const textual = tile.kind === "text" || tile.kind === "button";
  const cols = grid === "desktop" ? DESKTOP_COLUMNS : PHONE_COLUMNS;

  return (
    <section
      aria-label={t.tile}
      className="flex flex-col gap-5 rounded-md border border-line bg-bg p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <b className="font-medium">{t.kinds[tile.kind]}</b>
        <span className="flex items-center gap-1 text-sm text-muted">
          {t.layer.replace("{n}", String(tile.layer))}
          <button
            type="button"
            aria-label={t.layerDown}
            disabled={tile.layer <= 0}
            onClick={() => set({ layer: tile.layer - 1 })}
            className="grid size-8 place-items-center rounded-sm hover:text-ink disabled:opacity-30"
          >
            <Icon name="down" size={16} />
          </button>
          <button
            type="button"
            aria-label={t.layerUp}
            disabled={tile.layer >= 10}
            onClick={() => set({ layer: tile.layer + 1 })}
            className="grid size-8 place-items-center rounded-sm hover:text-ink disabled:opacity-30"
          >
            <Icon name="up" size={16} />
          </button>
        </span>
      </div>

      {media && (
        <MediaField
          label={t.kinds[tile.kind]}
          purpose={tile.kind === "video" ? "video" : "image"}
          value={tile.media}
          onChange={(m) => set({ media: m })}
        />
      )}
      {tile.kind === "embed" && (
        <VideoLinkField value={tile.embed} onChange={(embed) => set({ embed })} />
      )}
      {tile.kind === "audio" && (
        <>
          <TextField
            label={t.audioUrl}
            value={tile.audio_url ?? ""}
            max={500}
            placeholder="https://…/track.mp3"
            onChange={(audio_url) => set({ audio_url: audio_url.trim() || null })}
          />
          <TextField
            label={t.audioTitle}
            value={tile.audio_title}
            max={80}
            onChange={(audio_title) => set({ audio_title })}
          />
          <TextField
            label={t.audioArtist}
            value={tile.audio_artist}
            max={80}
            onChange={(audio_artist) => set({ audio_artist })}
          />
          <SelectField
            label={t.audioAnimation}
            value={tile.audio_animation}
            options={(["none", "equalizer", "vinyl"] as const).map((v) => ({
              value: v,
              label: t.audioAnimations[v],
            }))}
            onChange={(audio_animation) => set({ audio_animation })}
          />
          <SelectField
            label={t.audioProgress}
            value={tile.audio_progress}
            options={(["line", "wave", "segments"] as const).map((v) => ({
              value: v,
              label: t.audioProgresses[v],
            }))}
            onChange={(audio_progress) => set({ audio_progress })}
          />
          <ColorPicker
            label={t.audioColor}
            value={tile.audio_color}
            onChange={(audio_color) => set({ audio_color })}
          />
          <ColorPicker
            label={t.audioBackground}
            value={tile.audio_background}
            onChange={(audio_background) => set({ audio_background })}
          />
        </>
      )}
      {tile.kind === "text" && (
        <>
          <TextField
            label={t.text}
            value={tile.text}
            max={1200}
            multiline
            onChange={(text) => set({ text })}
          />
          <SelectField
            label={t.textStyle}
            value={tile.text_style}
            options={(["heading", "body", "quote", "label"] as const).map((v) => ({
              value: v,
              label: t.textStyles[v],
            }))}
            onChange={(text_style) => set({ text_style })}
          />
        </>
      )}
      {tile.kind === "button" && (
        <LinkField label={t.button} value={tile.link} onChange={(link) => set({ link })} />
      )}
      {textual && (
        <>
          <FontPicker
            label={t.font}
            value={tile.text_font ?? ""}
            onChange={(text_font) => set({ text_font: text_font || null })}
            fonts={FONT_IDS}
            inheritLabel={t.fontDefault}
            inheritFont="onest"
          />
          <NumberField
            label={t.fontSize}
            value={tile.text_size}
            min={10}
            fallback={null}
            hint={t.fontSizeHint}
            onChange={(text_size) => set({ text_size })}
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                aria-expanded={colorOpen}
                onClick={() => setColorOpen((open) => !open)}
                className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-md border border-line-2 bg-surface px-3 text-left hover:border-accent"
              >
                <span
                  aria-hidden="true"
                  className="size-6 shrink-0 rounded-full border border-line-2"
                  style={{ backgroundColor: tile.text_color ?? "var(--ink-2)" }}
                />
                <span className="truncate text-[15px] text-ink-2">
                  {tile.text_color ?? t.colorDefault}
                </span>
              </button>
              {tile.text_color && (
                <button
                  type="button"
                  onClick={() => set({ text_color: null })}
                  className="text-sm text-muted hover:text-ink"
                >
                  {t.colorReset}
                </button>
              )}
            </div>
            {colorOpen && (
              <ColorPicker
                label={t.color}
                value={tile.text_color ?? "#ffffff"}
                onChange={(text_color) => set({ text_color })}
              />
            )}
          </div>
        </>
      )}
      {(media || tile.kind === "embed") && (
        <TextField
          label={ru.builder.media.alt}
          value={tile.alt}
          max={80}
          onChange={(alt) => set({ alt })}
        />
      )}
      {media && <LinkField label={t.link} value={tile.link} onChange={(link) => set({ link })} />}
      {media && (
        <Segmented
          label={t.fit}
          value={tile.fit}
          onChange={(fit) => set({ fit })}
          options={(["cover", "contain"] as const).map((v) => ({ value: v, label: t.fits[v] }))}
        />
      )}
      {textual && (
        <>
          <Segmented
            label={t.align}
            value={tile.align}
            onChange={(align) => set({ align })}
            options={(["left", "center", "right"] as const).map((v) => ({
              value: v,
              label: t.aligns[v],
            }))}
          />
          <Segmented
            label={t.fill}
            value={tile.fill}
            onChange={(fill) => set({ fill })}
            options={(["none", "surface", "accent"] as const).map((v) => ({
              value: v,
              label: t.fills[v],
            }))}
          />
        </>
      )}
      <ToggleField
        label={t.rounded}
        checked={tile.rounded}
        onChange={(rounded) => set({ rounded })}
      />

      {place && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">{t.place}</legend>
          <div className="grid grid-cols-4 gap-2">
            <NumberField
              label={t.x}
              value={place.x + 1}
              min={1}
              max={cols}
              fallback={1}
              onChange={(x) => onPlace(clampPlace({ ...place, x: x - 1 }, grid))}
            />
            <NumberField
              label={t.y}
              value={place.y + 1}
              min={1}
              max={MAX_ROW}
              fallback={1}
              onChange={(y) => onPlace(clampPlace({ ...place, y: y - 1 }, grid))}
            />
            <NumberField
              label={t.w}
              value={place.w}
              min={1}
              max={cols}
              fallback={1}
              onChange={(w) => onPlace(clampPlace({ ...place, w }, grid))}
            />
            <NumberField
              label={t.h}
              value={place.h}
              min={1}
              max={MAX_SPAN_ROWS}
              fallback={1}
              onChange={(h) => onPlace(clampPlace({ ...place, h }, grid))}
            />
          </div>
        </fieldset>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-2 self-start text-sm text-muted hover:text-[#ffb3b3]"
      >
        <Icon name="trash" size={16} />
        {t.remove}
      </button>
    </section>
  );
}

export function CollageEditor({
  value: v,
  onChange,
}: {
  value: Settings;
  onChange: (value: Settings) => void;
}) {
  const [grid, setGrid] = useState<Grid>("desktop");
  const [selected, setSelected] = useState<string | null>(v.tiles[0]?.id ?? null);
  const set = (patch: Partial<Settings>) => onChange({ ...v, ...patch });

  const auto = autoPhone(v.tiles, v.cell);
  const placeOf = (tile: Tile): Place =>
    grid === "desktop"
      ? tile.desktop
      : v.phone === "custom"
        ? (tile.phone ?? auto.get(tile.id)!)
        : auto.get(tile.id)!;
  const places = new Map(v.tiles.map((tile) => [tile.id, placeOf(tile)]));
  const editable = grid === "desktop" || v.phone === "custom";
  const tile = v.tiles.find((x) => x.id === selected) ?? null;

  const replace = (next: Tile) => set({ tiles: v.tiles.map((x) => (x.id === next.id ? next : x)) });

  function place(id: string, p: Place) {
    if (!editable) return;
    set({
      tiles: v.tiles.map((x) =>
        x.id !== id ? x : grid === "desktop" ? { ...x, desktop: p } : { ...x, phone: p },
      ),
    });
  }

  function add(kind: TileKind) {
    const size = NEW_SIZE[kind];
    const desktop = clampPlace(
      { x: 0, y: bottom(v.tiles.map((x) => x.desktop)), ...size },
      "desktop",
    );
    const phone =
      v.phone === "custom"
        ? clampPlace(
            {
              x: 0,
              y: bottom([...places.values()]),
              w: PHONE_COLUMNS,
              h: Math.max(1, Math.round(size.h * 0.75)),
            },
            "phone",
          )
        : null;
    const next = blankTile(kind, desktop, phone);
    set({ tiles: [...v.tiles, next] });
    setSelected(next.id);
  }

  return (
    <div className="flex flex-col gap-5">
      <TextField label={f.label} value={v.label} max={80} onChange={(label) => set({ label })} />
      <TextField label={f.title} value={v.title} onChange={(title) => set({ title })} />

      <Segmented
        label={t.grid}
        value={grid}
        onChange={setGrid}
        options={(["desktop", "phone"] as const).map((g) => ({ value: g, label: t.grids[g] }))}
      />

      {grid === "phone" && (
        <div className="flex flex-col gap-3 rounded-md border border-line p-3 text-sm text-ink-2">
          {v.phone === "auto" ? (
            <>
              <p>{t.phoneAuto}</p>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() =>
                  set({
                    phone: "custom",
                    tiles: v.tiles.map((x) => ({ ...x, phone: auto.get(x.id)! })),
                  })
                }
              >
                {t.phoneCustom}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() =>
                set({ phone: "auto", tiles: v.tiles.map((x) => ({ ...x, phone: null })) })
              }
            >
              {t.phoneReset}
            </Button>
          )}
        </div>
      )}

      <div className={cn("flex flex-col gap-2", !editable && "pointer-events-none opacity-70")}>
        <Canvas
          tiles={v.tiles}
          grid={grid}
          places={places}
          cell={v.cell}
          selected={selected}
          onSelect={setSelected}
          onPlace={place}
        />
        <p className="text-[13px] text-muted">{t.canvasHint}</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">{t.add}</legend>
        <div className="flex flex-wrap gap-2">
          {TILE_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="secondary"
              disabled={v.tiles.length >= 24}
              onClick={() => add(kind)}
            >
              <Icon name="plus" size={14} />
              {t.kinds[kind]}
            </Button>
          ))}
        </div>
      </fieldset>

      {tile && (
        <TileFields
          tile={tile}
          place={editable ? places.get(tile.id)! : null}
          grid={grid}
          onChange={replace}
          onPlace={(p) => place(tile.id, p)}
          onRemove={() => {
            set({ tiles: v.tiles.filter((x) => x.id !== tile.id) });
            setSelected(null);
          }}
        />
      )}

      <SelectField
        label={t.cell}
        value={v.cell}
        options={(["s", "m", "l"] as const).map((c) => ({ value: c, label: t.cells[c] }))}
        onChange={(cell) => set({ cell })}
      />
      <SelectField
        label={t.gap}
        value={v.gap}
        options={(["none", "s", "m"] as const).map((g) => ({ value: g, label: t.gaps[g] }))}
        onChange={(gap) => set({ gap })}
      />
      <ToggleField label={t.bleed} checked={v.bleed} onChange={(bleed) => set({ bleed })} />
    </div>
  );
}
