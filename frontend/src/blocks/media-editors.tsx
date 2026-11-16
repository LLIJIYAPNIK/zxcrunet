"use client";

import { useState } from "react";

import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { ru } from "@/i18n/ru";
import { PROVIDER_NAMES, embedPage, parseVideoLink } from "@/lib/embed";

import {
  LinkField,
  ListField,
  MediaField,
  RangeField,
  SelectField,
  TextField,
  ToggleField,
} from "./fields";
import { ASPECTS, isVideo, type SettingsOf } from "./schemas";

const f = ru.builder.fields;
const m = ru.builder.media;

type Props<T extends "video" | "carousel"> = {
  value: SettingsOf<T>;
  onChange: (value: SettingsOf<T>) => void;
};

/** Any link to the video; only the provider and the id it points to are kept. */
export function VideoLinkField({
  value,
  onChange,
}: {
  value: SettingsOf<"video">["embed"];
  onChange: (value: SettingsOf<"video">["embed"]) => void;
}) {
  const [draft, setDraft] = useState(value ? embedPage(value) : "");
  const parsed = draft.trim() ? parseVideoLink(draft) : null;
  const status = !draft.trim()
    ? m.linkHint
    : parsed
      ? m.linkFound.replace("{provider}", PROVIDER_NAMES[parsed.provider])
      : m.linkBad;

  return (
    <Field label={m.link} hint={status}>
      {({ id, describedBy }) => (
        <Input
          id={id}
          type="url"
          inputMode="url"
          value={draft}
          placeholder="https://youtu.be/…"
          aria-describedby={describedBy}
          aria-invalid={Boolean(draft.trim()) && !parsed}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(parseVideoLink(e.target.value));
          }}
        />
      )}
    </Field>
  );
}

export function VideoEditor({ value: v, onChange }: Props<"video">) {
  const set = (patch: Partial<SettingsOf<"video">>) => onChange({ ...v, ...patch });
  return (
    <div className="flex flex-col gap-5">
      <TextField label={f.label} value={v.label} max={80} onChange={(label) => set({ label })} />
      <TextField label={f.title} value={v.title} onChange={(title) => set({ title })} />
      <TextField
        label={f.text}
        value={v.lead}
        max={1200}
        multiline
        onChange={(lead) => set({ lead })}
      />
      <Segmented
        label={m.source}
        value={v.source}
        onChange={(source) => set({ source })}
        options={(["embed", "file"] as const).map((s) => ({ value: s, label: m.sources[s] }))}
      />
      {v.source === "embed" ? (
        <VideoLinkField value={v.embed} onChange={(embed) => set({ embed })} />
      ) : (
        <>
          <MediaField
            label={m.video}
            purpose="video"
            hint={m.videoHint}
            value={v.file}
            onChange={(file) => set({ file: file as SettingsOf<"video">["file"] })}
          />
          <Segmented
            label={m.mode}
            value={v.mode}
            onChange={(mode) => set({ mode })}
            options={(["player", "loop"] as const).map((s) => ({ value: s, label: m.modes[s] }))}
          />
          <MediaField
            label={m.poster}
            purpose="image"
            value={v.poster}
            onChange={(poster) => set({ poster })}
          />
        </>
      )}
      <SelectField
        label={m.aspect}
        value={v.aspect}
        options={ASPECTS.map((a) => ({ value: a, label: a }))}
        onChange={(aspect) => set({ aspect })}
      />
    </div>
  );
}

type Item = SettingsOf<"carousel">["items"][number];

export function CarouselEditor({ value: v, onChange }: Props<"carousel">) {
  const set = (patch: Partial<SettingsOf<"carousel">>) => onChange({ ...v, ...patch });
  return (
    <div className="flex flex-col gap-5">
      <TextField label={f.label} value={v.label} max={80} onChange={(label) => set({ label })} />
      <TextField label={f.title} value={v.title} onChange={(title) => set({ title })} />
      <Segmented
        label={m.carouselMode}
        value={v.mode}
        onChange={(mode) => set({ mode })}
        options={(["slides", "marquee"] as const).map((s) => ({
          value: s,
          label: m.carouselModes[s],
        }))}
      />
      <ListField<Item | Partial<Item>>
        label={m.items}
        items={v.items}
        max={30}
        // A new frame is empty until a file is uploaded; the builder waits for it.
        make={() => ({ alt: "", link: null })}
        title={(item, i) =>
          item.alt ||
          (item.media ? `${i + 1}. ${isVideo(item.media) ? "клип" : "картинка"}` : `${i + 1}. —`)
        }
        onChange={(items) => set({ items: items as Item[] })}
      >
        {(item, update) => (
          <>
            <MediaField
              label={m.itemMedia}
              purpose="visual"
              value={item.media ?? null}
              onChange={(media) => update({ ...item, media: media ?? undefined })}
            />
            <TextField
              label={m.alt}
              value={item.alt ?? ""}
              max={80}
              onChange={(alt) => update({ ...item, alt })}
            />
            <LinkField
              label={m.itemLink}
              value={item.link ?? null}
              onChange={(link) => update({ ...item, link })}
            />
          </>
        )}
      </ListField>
      {v.items.length === 0 && <p className="text-sm text-muted">{m.empty}</p>}
      <SelectField
        label={m.height}
        value={v.height}
        options={(["s", "m", "l"] as const).map((h) => ({ value: h, label: m.heights[h] }))}
        onChange={(height) => set({ height })}
      />
      {v.mode === "slides" ? (
        <>
          <ToggleField
            label={m.autoplay}
            checked={v.autoplay}
            onChange={(autoplay) => set({ autoplay })}
          />
          {v.autoplay && (
            <RangeField
              label={m.interval}
              value={v.interval}
              min={2}
              max={15}
              step={1}
              unit=" с"
              onChange={(interval) => set({ interval })}
            />
          )}
        </>
      ) : (
        <>
          <RangeField
            label={m.speed}
            hint={m.speedHint}
            value={v.speed}
            min={10}
            max={120}
            step={5}
            unit=" с"
            onChange={(speed) => set({ speed })}
          />
          <Segmented
            label={m.direction}
            value={v.direction}
            onChange={(direction) => set({ direction })}
            options={(["left", "right"] as const).map((d) => ({
              value: d,
              label: m.directions[d],
            }))}
          />
        </>
      )}
      <ToggleField
        label={m.pauseOnHover}
        checked={v.pause_on_hover}
        onChange={(pause_on_hover) => set({ pause_on_hover })}
      />
    </div>
  );
}
