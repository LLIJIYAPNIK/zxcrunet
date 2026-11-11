"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { EDITORS } from "@/blocks/editors";
import {
  BLOCK_TYPES,
  META,
  defaultSettings,
  validateBlock,
  type AnyBlock,
  type BlockType,
} from "@/blocks/schemas";
import { FormMessage } from "@/components/auth/AuthShell";
import { PublicSite } from "@/components/public/PublicSite";
import { siteErrorText } from "@/components/sites/errors";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import { api, type Site } from "@/lib/api/client";
import { ru } from "@/i18n/ru";

const t = ru.builder;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error" | "invalid";

function newId(): string {
  return crypto.randomUUID();
}

function titleOf(block: AnyBlock): string {
  return META[block.type]?.title ?? block.type;
}

function summaryOf(block: AnyBlock): string {
  const summary = META[block.type]?.summary as ((s: unknown) => string) | undefined;
  try {
    return summary?.(block.settings) ?? "";
  } catch {
    return "";
  }
}

// --- sortable row -----------------------------------------------------------------

type RowProps = {
  block: AnyBlock;
  selected: boolean;
  invalid: boolean;
  onSelect: () => void;
  onToggle: (visible: boolean) => void;
  onRemove: () => void;
};

function BlockRow({ block, selected, invalid, onSelect, onToggle, onRemove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const title = titleOf(block);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-h-16 items-center gap-2 rounded-md border bg-surface py-2.5 pr-2 pl-1.5 transition-colors",
        selected ? "border-accent" : "border-line",
        invalid && "border-[#ff6b6b]/70",
        isDragging && "relative z-10 shadow-[0_12px_32px_rgba(0,0,0,.45)]",
      )}
    >
      <button
        type="button"
        aria-label={`${t.dragHint}: ${title}`}
        className="grid h-11 w-7 shrink-0 cursor-grab touch-none place-items-center text-muted hover:text-ink active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon name="grip" size={18} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 flex-col items-start text-left leading-snug"
      >
        <b className={cn("text-[15px] font-medium", block.hidden && "text-muted")}>{title}</b>
        <span className="w-full truncate text-[13px] text-muted">{summaryOf(block)}</span>
      </button>
      <Switch
        checked={!block.hidden}
        onChange={onToggle}
        label={t.visible.replace("{block}", title)}
      />
      <button
        type="button"
        aria-label={`${t.remove}: ${title}`}
        onClick={onRemove}
        className="grid size-9 shrink-0 place-items-center rounded-sm text-muted hover:text-[#ffb3b3]"
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  );
}

// --- the builder ----------------------------------------------------------------

type BuilderProps = { initial: Site; emailVerified: boolean };

export function Builder({ initial, emailVerified }: BuilderProps) {
  const [site, setSite] = useState(initial);
  const [pageId, setPageId] = useState(initial.pages[0]?.id ?? "");
  const [blocksByPage, setBlocksByPage] = useState<Record<string, AnyBlock[]>>(() =>
    Object.fromEntries(initial.pages.map((p) => [p.id, p.blocks as unknown as AnyBlock[]])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pane, setPane] = useState<"blocks" | "preview">("blocks");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [invalidId, setInvalidId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const library = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef<Set<string>>(new Set());

  const blocks = useMemo(() => blocksByPage[pageId] ?? [], [blocksByPage, pageId]);
  const page = site.pages.find((p) => p.id === pageId) ?? site.pages[0];
  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // --- saving -------------------------------------------------------------------

  // Latest blocks for the debounced save, without re-creating the callback.
  const blocksByPageRef = useRef(blocksByPage);
  useEffect(() => {
    blocksByPageRef.current = blocksByPage;
  }, [blocksByPage]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const pages = [...dirty.current];
    if (!pages.length) return true;
    for (const id of pages) {
      const list = blocksByPageRef.current[id] ?? [];
      const broken = list.find((b) => validateBlock(b));
      if (broken) {
        setInvalidId(broken.id);
        setSaveState("invalid");
        return false;
      }
    }
    setInvalidId(null);
    setSaveState("saving");
    for (const id of pages) {
      const list = blocksByPageRef.current[id] ?? [];
      const result = await api.put("/api/sites/{site_id}/pages/{page_id}/blocks", {
        path: { site_id: site.id, page_id: id },
        body: {
          blocks: list.map((b) => ({
            id: b.id,
            type: b.type,
            version: b.version,
            hidden: b.hidden,
            settings: b.settings as Record<string, unknown>,
          })),
        },
      });
      if (!result.ok) {
        setSaveState("error");
        setNotice(siteErrorText(result.error.code));
        return false;
      }
      dirty.current.delete(id);
    }
    const fresh = await api.get("/api/sites/{site_id}", { path: { site_id: site.id } });
    if (fresh.ok) setSite(fresh.data);
    setSaveState("saved");
    return true;
  }, [site.id]);

  const update = useCallback(
    (next: AnyBlock[]) => {
      setBlocksByPage((all) => ({ ...all, [pageId]: next }));
      dirty.current.add(pageId);
      setSaveState("pending");
      setNotice(null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 800);
    },
    [pageId, flush],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current.size) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // --- actions ------------------------------------------------------------------

  function addBlock(type: BlockType) {
    const block = {
      id: newId(),
      type,
      version: 1,
      hidden: false,
      settings: defaultSettings(type, site.title),
    } as AnyBlock;
    update([...blocks, block]);
    setSelectedId(block.id);
    library.current?.close();
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === active.id);
    const to = blocks.findIndex((b) => b.id === over.id);
    update(arrayMove(blocks, from, to));
  }

  async function publish() {
    if (!(await flush())) return;
    const result = await api.post("/api/sites/{site_id}/publish", { path: { site_id: site.id } });
    if (result.ok) {
      setSite(result.data);
      setNotice(null);
    } else {
      setNotice(siteErrorText(result.error.code));
    }
  }

  // --- preview ------------------------------------------------------------------

  const content = {
    kind: site.kind,
    title: site.title,
    theme: site.theme,
    seo: { title: site.seo_title, description: site.seo_description },
    pages: site.pages.map((p) => ({
      path: p.path,
      title: p.title,
      blocks: (blocksByPage[p.id] ?? []) as unknown as Record<string, unknown>[],
    })),
  };
  const previewPage = content.pages.find((p) => p.path === page?.path) ?? content.pages[0];
  const stopLinks = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) event.preventDefault();
  };

  const live = site.status === "published";
  const changes = site.unpublished_changes;
  const statusText =
    saveState === "saving" || saveState === "pending"
      ? t.saving
      : saveState === "error"
        ? t.saveError
        : saveState === "invalid"
          ? t.invalid.replace(
              "{block}",
              titleOf(blocks.find((b) => b.id === invalidId) ?? blocks[0]),
            )
          : t.saved;
  const SelectedEditor = selected
    ? (EDITORS[selected.type] as (p: {
        value: unknown;
        onChange: (v: unknown) => void;
      }) => React.ReactNode)
    : null;
  const selectedError = selected ? validateBlock(selected) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* top bar */}
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={`/app/sites/${site.id}`} className="w-max text-sm text-ink-2 hover:text-ink">
            ← {t.back}
          </Link>
          <b className="truncate font-display text-lg font-medium">{site.title}</b>
          <span className="label" role="status" aria-live="polite">
            {live ? ru.sites.status.published : t.draft}
            {" · "}
            <b className="font-medium text-ink">
              {changes > 0 && (live || site.published_at)
                ? t.changes.replace("{n}", String(changes))
                : live
                  ? t.noChanges
                  : t.draft.toLowerCase()}
            </b>
            {" · "}
            <span
              className={cn(
                saveState === "invalid" || saveState === "error" ? "text-[#ff6b6b]" : "",
              )}
            >
              {statusText}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {site.pages.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              {t.page}
              <select
                value={pageId}
                onChange={(e) => {
                  void flush();
                  setPageId(e.target.value);
                  setSelectedId(null);
                }}
                className="h-10 rounded-btn border border-line-2 bg-bg px-3 text-[15px] text-ink"
              >
                {site.pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            onClick={publish}
            arrow
            disabled={site.status === "suspended" || saveState === "saving"}
          >
            {t.publish}
          </Button>
        </div>
      </div>

      {(notice || (!emailVerified && !live)) && (
        <FormMessage tone="error">{notice ?? ru.sites.publish.needVerified}</FormMessage>
      )}

      <Segmented
        label={t.title}
        value={pane}
        onChange={setPane}
        className="lg:hidden"
        options={[
          { value: "blocks", label: t.blocks },
          { value: "preview", label: t.preview },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
        {/* blocks + editor */}
        <div className={cn("flex flex-col gap-4", pane === "preview" && "max-lg:hidden")}>
          {blocks.length === 0 && <p className="text-ink-2">{t.empty}</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2" aria-label={t.blocks}>
                {blocks.map((block) => (
                  <BlockRow
                    key={block.id}
                    block={block}
                    selected={block.id === selectedId}
                    invalid={block.id === invalidId}
                    onSelect={() => setSelectedId(block.id === selectedId ? null : block.id)}
                    onToggle={(visible) =>
                      update(
                        blocks.map((b) => (b.id === block.id ? { ...b, hidden: !visible } : b)),
                      )
                    }
                    onRemove={() => {
                      if (!window.confirm(t.removeConfirm.replace("{block}", titleOf(block))))
                        return;
                      update(blocks.filter((b) => b.id !== block.id));
                      if (selectedId === block.id) setSelectedId(null);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={() => library.current?.showModal()}
            className="flex h-13 items-center justify-center gap-2 rounded-md border border-dashed border-line-2 font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
          >
            <Icon name="plus" size={18} />
            {t.addBlock}
          </button>

          {selected && SelectedEditor && (
            <section
              aria-label={titleOf(selected)}
              className="flex flex-col gap-5 rounded-lg border border-line bg-surface p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-h3 font-medium">{titleOf(selected)}</h2>
                <button
                  type="button"
                  aria-label={t.close}
                  onClick={() => setSelectedId(null)}
                  className="grid size-9 place-items-center rounded-sm text-muted hover:text-ink"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              {selectedError && (
                <FormMessage tone="error">
                  {selectedError.issues
                    .slice(0, 3)
                    .map((i) => i.message)
                    .join(" · ")}
                </FormMessage>
              )}
              <SelectedEditor
                value={selected.settings}
                onChange={(settings) =>
                  update(
                    blocks.map((b) =>
                      b.id === selected.id ? ({ ...b, settings } as AnyBlock) : b,
                    ),
                  )
                }
              />
            </section>
          )}
          {!selected && blocks.length > 0 && <p className="text-sm text-muted">{t.selectHint}</p>}
        </div>

        {/* preview */}
        <div className={cn("flex min-w-0 flex-col gap-3", pane === "blocks" && "max-lg:hidden")}>
          <div className="flex items-center justify-between gap-3">
            <span className="label">{t.preview}</span>
            <div
              role="group"
              aria-label={t.preview}
              className="flex gap-1 rounded-md border border-line p-1"
            >
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={device === d}
                  aria-label={d === "desktop" ? t.desktop : t.mobile}
                  onClick={() => setDevice(d)}
                  className={cn(
                    "grid h-9 w-11 place-items-center rounded-[9px] transition-colors",
                    device === d
                      ? "bg-raised text-ink shadow-[inset_0_0_0_1px_var(--line-2)]"
                      : "text-muted hover:text-ink",
                  )}
                >
                  <Icon name={d === "desktop" ? "monitor" : "smartphone"} size={18} />
                </button>
              ))}
            </div>
          </div>
          <div
            onClickCapture={stopLinks}
            data-testid="builder-preview"
            className={cn(
              "overflow-hidden rounded-lg border border-line-2 bg-bg",
              device === "mobile" && "mx-auto w-[390px] max-w-full rounded-[28px]",
            )}
          >
            <div className="max-h-[78vh] overflow-y-auto">
              {previewPage && (
                <PublicSite slug={site.slug} content={content} page={previewPage} preview />
              )}
            </div>
          </div>
        </div>
      </div>

      <dialog
        ref={library}
        aria-labelledby="library-title"
        className="m-auto w-[min(720px,calc(100vw-32px))] rounded-lg border border-line-2 bg-surface p-0 text-ink backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="library-title" className="font-display text-h3 font-medium">
                {t.library}
              </h2>
              <p className="text-sm text-ink-2">{t.libraryLead}</p>
            </div>
            <button
              type="button"
              aria-label={t.close}
              onClick={() => library.current?.close()}
              className="grid size-9 place-items-center rounded-sm text-muted hover:text-ink"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BLOCK_TYPES.filter((type) => META[type].kinds.includes(site.kind)).map((type) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => addBlock(type)}
                  className="flex h-full w-full items-start gap-3 rounded-md border border-line bg-bg p-4 text-left transition-[border-color,transform] duration-200 ease-neon hover:-translate-y-0.5 hover:border-accent"
                >
                  <Icon name={META[type].icon} className="mt-0.5 shrink-0 text-accent" />
                  <span className="flex flex-col gap-1">
                    <b className="font-medium">{META[type].title}</b>
                    <span className="text-sm text-muted">{META[type].description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </div>
  );
}
