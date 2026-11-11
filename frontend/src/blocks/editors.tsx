"use client";

import type { ReactNode } from "react";

import { ru } from "@/i18n/ru";

import { ChipsField, LinkField, ListField, MediaField, TextField, ToggleField } from "./fields";
import { CONTACT_KINDS, type AnyBlock, type ContactKind, type SettingsOf } from "./schemas";

const f = ru.builder.fields;

type EditorProps<T extends AnyBlock["type"]> = {
  value: SettingsOf<T>;
  onChange: (value: SettingsOf<T>) => void;
};

function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

function HeroEditor({ value: v, onChange }: EditorProps<"hero">) {
  const set = (patch: Partial<SettingsOf<"hero">>) => onChange({ ...v, ...patch });
  return (
    <Stack>
      <TextField label={f.label} value={v.label} max={80} onChange={(label) => set({ label })} />
      <TextField label={f.title} value={v.title} onChange={(title) => set({ title })} />
      <TextField
        label={f.lead}
        value={v.lead}
        max={1200}
        multiline
        onChange={(lead) => set({ lead })}
      />
      <LinkField label={f.primary} value={v.primary} onChange={(primary) => set({ primary })} />
      <LinkField
        label={f.secondary}
        value={v.secondary}
        onChange={(secondary) => set({ secondary })}
      />
      <MediaField
        label={f.avatar}
        purpose="image"
        value={v.avatar}
        onChange={(avatar) => set({ avatar })}
      />
      <TextField
        label={f.cardName}
        value={v.card_name}
        max={80}
        onChange={(card_name) => set({ card_name })}
      />
      <TextField
        label={f.cardRole}
        value={v.card_role}
        max={80}
        onChange={(card_role) => set({ card_role })}
      />
      <ChipsField label={f.chips} value={v.chips} max={6} onChange={(chips) => set({ chips })} />
    </Stack>
  );
}

function FactsEditor({ value: v, onChange }: EditorProps<"facts">) {
  return (
    <ListField
      label={f.items}
      items={v.items}
      max={4}
      make={() => ({ value: "1", label: "" })}
      title={(item) => item.value || "—"}
      onChange={(items) => onChange({ ...v, items })}
    >
      {(item, update) => (
        <>
          <TextField
            label={f.value}
            value={item.value}
            max={16}
            onChange={(value) => update({ ...item, value })}
          />
          <TextField
            label={f.text}
            value={item.label}
            onChange={(label) => update({ ...item, label })}
          />
        </>
      )}
    </ListField>
  );
}

function ExperienceEditor({ value: v, onChange }: EditorProps<"experience">) {
  return (
    <Stack>
      <TextField
        label={f.label}
        value={v.label}
        max={80}
        onChange={(label) => onChange({ ...v, label })}
      />
      <TextField label={f.title} value={v.title} onChange={(title) => onChange({ ...v, title })} />
      <ListField
        label={f.items}
        items={v.items}
        max={20}
        make={() => ({ title: "", text: "", current: false })}
        title={(item) => item.title || "—"}
        onChange={(items) => onChange({ ...v, items })}
      >
        {(item, update) => (
          <>
            <TextField
              label={f.title}
              value={item.title}
              max={80}
              onChange={(title) => update({ ...item, title })}
            />
            <TextField
              label={f.text}
              value={item.text}
              max={1200}
              multiline
              onChange={(text) => update({ ...item, text })}
            />
            <ToggleField
              label={f.current}
              checked={item.current}
              onChange={(current) => update({ ...item, current })}
            />
          </>
        )}
      </ListField>
    </Stack>
  );
}

function ProjectsEditor({ value: v, onChange }: EditorProps<"projects">) {
  return (
    <Stack>
      <TextField
        label={f.label}
        value={v.label}
        max={80}
        onChange={(label) => onChange({ ...v, label })}
      />
      <TextField label={f.title} value={v.title} onChange={(title) => onChange({ ...v, title })} />
      <LinkField
        label={f.allLink}
        value={v.all_link}
        onChange={(all_link) => onChange({ ...v, all_link })}
      />
      <ListField
        label={f.items}
        items={v.items}
        max={12}
        make={() => ({ label: "", title: "", text: "", tags: [], link: null })}
        title={(item) => item.title || "—"}
        onChange={(items) => onChange({ ...v, items })}
      >
        {(item, update) => (
          <>
            <TextField
              label={f.label}
              value={item.label}
              max={80}
              onChange={(label) => update({ ...item, label })}
            />
            <TextField
              label={f.title}
              value={item.title}
              max={80}
              onChange={(title) => update({ ...item, title })}
            />
            <TextField
              label={f.text}
              value={item.text}
              max={1200}
              multiline
              onChange={(text) => update({ ...item, text })}
            />
            <ChipsField
              label={f.tags}
              value={item.tags}
              onChange={(tags) => update({ ...item, tags })}
            />
            <LinkField
              label={f.projectLink}
              value={item.link}
              onChange={(link) => update({ ...item, link })}
            />
          </>
        )}
      </ListField>
    </Stack>
  );
}

function InterestsEditor({ value: v, onChange }: EditorProps<"interests">) {
  return (
    <Stack>
      <TextField
        label={f.label}
        value={v.label}
        max={80}
        onChange={(label) => onChange({ ...v, label })}
      />
      <ChipsField
        label={f.chips}
        value={v.items}
        max={24}
        onChange={(items) => onChange({ ...v, items })}
      />
    </Stack>
  );
}

const URL_HINT: Record<ContactKind, (value: string) => string> = {
  telegram: (v) => `https://t.me/${v.replace(/^@/, "")}`,
  github: (v) => `https://github.com/${v.replace(/^@/, "")}`,
  email: (v) => `mailto:${v}`,
  phone: (v) => `tel:${v.replace(/[^\d+]/g, "")}`,
  vk: (v) => `https://vk.com/${v.replace(/^@/, "")}`,
  linkedin: (v) => `https://www.linkedin.com/in/${v.replace(/^@/, "")}`,
  website: (v) => (/^https?:\/\//.test(v) ? v : `https://${v}`),
};

function ContactsEditor({ value: v, onChange }: EditorProps<"contacts">) {
  const kinds = ru.builder.contactKinds;
  return (
    <Stack>
      <TextField label={f.title} value={v.title} onChange={(title) => onChange({ ...v, title })} />
      <TextField
        label={f.titleMuted}
        value={v.title_muted}
        max={80}
        onChange={(title_muted) => onChange({ ...v, title_muted })}
      />
      <ListField
        label={f.items}
        items={v.items}
        max={8}
        make={() => ({ kind: "email" as ContactKind, label: kinds.email, value: "", url: "" })}
        title={(item) => item.label || kinds[item.kind]}
        onChange={(items) => onChange({ ...v, items })}
      >
        {(item, update) => (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">
              {f.kind}
              <select
                value={item.kind}
                onChange={(e) => {
                  const kind = e.target.value as ContactKind;
                  update({
                    ...item,
                    kind,
                    label: kinds[kind],
                    url: item.value ? URL_HINT[kind](item.value) : item.url,
                  });
                }}
                className="h-12 rounded-md border border-line-2 bg-surface px-3 text-base text-ink"
              >
                {CONTACT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kinds[kind]}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label={f.value}
              value={item.value}
              max={80}
              onChange={(value) => update({ ...item, value, url: URL_HINT[item.kind](value) })}
            />
            <TextField
              label={f.linkUrl}
              value={item.url}
              max={500}
              onChange={(url) => update({ ...item, url: url.trim() })}
            />
          </>
        )}
      </ListField>
    </Stack>
  );
}

function ResumeEditor({ value: v, onChange }: EditorProps<"resume">) {
  return (
    <Stack>
      <TextField
        label={f.linkLabel}
        value={v.label}
        max={80}
        onChange={(label) => onChange({ ...v, label })}
      />
      <MediaField
        label={f.file}
        purpose="resume"
        value={v.file}
        onChange={(file) => onChange({ ...v, file })}
      />
    </Stack>
  );
}

export const EDITORS: { [T in AnyBlock["type"]]: (props: EditorProps<T>) => ReactNode } = {
  hero: HeroEditor,
  facts: FactsEditor,
  experience: ExperienceEditor,
  projects: ProjectsEditor,
  interests: InterestsEditor,
  contacts: ContactsEditor,
  resume: ResumeEditor,
};
