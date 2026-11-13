"use client";

import type { ReactNode } from "react";

import { ru } from "@/i18n/ru";

import { useCatalog } from "./catalog-context";

import {
  ChipsField,
  LinkField,
  ListField,
  MediaField,
  NumberField,
  PatternField,
  SelectField,
  TextField,
  TitlePicker,
  ToggleField,
} from "./fields";
import {
  CONTACT_KINDS,
  KIND_TITLES,
  SHELF_STYLES,
  STYLE_TITLES,
  TITLE_KINDS,
  type AnyBlock,
  type ContactKind,
  type SettingsOf,
} from "./schemas";

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
      <PatternField
        label={f.cardPattern}
        value={v.pattern}
        onChange={(pattern) => set({ pattern })}
      />
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

// --- personal blocks --------------------------------------------------------------

const cf = ru.catalog.fields;
const pf = ru.builder.personal;
const kindOptions = TITLE_KINDS.map((k) => ({ value: k, label: KIND_TITLES[k] }));

/** Label and title, the first two fields of almost every personal block. */
function Heading<T extends { label: string; title: string }>({
  value: v,
  onChange,
}: {
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <>
      <TextField
        label={f.label}
        value={v.label}
        max={80}
        onChange={(label) => onChange({ ...v, label })}
      />
      <TextField label={f.title} value={v.title} onChange={(title) => onChange({ ...v, title })} />
    </>
  );
}

function ProfileEditor({ value: v, onChange }: EditorProps<"profile">) {
  const set = (patch: Partial<SettingsOf<"profile">>) => onChange({ ...v, ...patch });
  return (
    <Stack>
      <MediaField
        label={pf.cover}
        purpose="image"
        value={v.cover}
        onChange={(cover) => set({ cover })}
      />
      <PatternField
        label={f.coverPattern}
        hint={f.coverPatternHint}
        value={v.pattern}
        onChange={(pattern) => set({ pattern })}
      />
      <MediaField
        label={f.avatar}
        purpose="image"
        value={v.avatar}
        onChange={(avatar) => set({ avatar })}
      />
      <TextField label={f.title} value={v.title} onChange={(title) => set({ title })} />
      <TextField
        label={f.lead}
        value={v.lead}
        max={1200}
        multiline
        onChange={(lead) => set({ lead })}
      />
      <TextField label={pf.mood} value={v.mood} max={80} onChange={(mood) => set({ mood })} />
    </Stack>
  );
}

function NowEditor({ value: v, onChange }: EditorProps<"now">) {
  return (
    <Stack>
      <TextField
        label={f.label}
        value={v.label}
        max={80}
        onChange={(label) => onChange({ ...v, label })}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-2">{pf.shelves}</legend>
        {TITLE_KINDS.map((kind) => (
          <ToggleField
            key={kind}
            label={KIND_TITLES[kind]}
            checked={v.kinds.includes(kind)}
            onChange={(on) =>
              onChange({
                ...v,
                kinds: on ? [...v.kinds, kind] : v.kinds.filter((k) => k !== kind),
              })
            }
          />
        ))}
      </fieldset>
      <NumberField
        label={pf.limit}
        value={v.limit}
        min={1}
        max={6}
        fallback={3}
        onChange={(limit) => onChange({ ...v, limit })}
      />
      <p className="text-sm text-muted">{pf.nowHint}</p>
    </Stack>
  );
}

function ShelfEditor({ value: v, onChange }: EditorProps<"shelf">) {
  const set = (patch: Partial<SettingsOf<"shelf">>) => onChange({ ...v, ...patch });
  return (
    <Stack>
      <SelectField
        label={pf.kind}
        value={v.kind}
        options={kindOptions}
        onChange={(kind) => set({ kind })}
      />
      <SelectField
        label={pf.style}
        value={v.style}
        options={SHELF_STYLES.map((s) => ({ value: s, label: STYLE_TITLES[s] }))}
        onChange={(style) => set({ style })}
      />
      <ToggleField
        label={pf.controls}
        checked={v.controls}
        onChange={(controls) => set({ controls })}
      />
      <Heading value={v} onChange={onChange} />
      <TextField
        label={f.lead}
        value={v.lead}
        max={1200}
        multiline
        onChange={(lead) => set({ lead })}
      />
      <NumberField
        label={pf.limit}
        value={v.limit}
        min={1}
        max={60}
        fallback={12}
        onChange={(limit) => set({ limit })}
      />
      <LinkField label={pf.allLink} value={v.all_link} onChange={(all_link) => set({ all_link })} />
      <p className="text-sm text-muted">{pf.shelfHint}</p>
    </Stack>
  );
}

function CharactersEditor({ value: v, onChange }: EditorProps<"characters">) {
  return (
    <Stack>
      <Heading value={v} onChange={onChange} />
      <p className="text-sm text-muted">{pf.charactersHint}</p>
    </Stack>
  );
}

function TopEditor({ value: v, onChange }: EditorProps<"top">) {
  const index = useCatalog();
  const free = () => index.catalog.titles.find((t) => !v.items.includes(t.id))?.id ?? "";
  return (
    <Stack>
      <Heading value={v} onChange={onChange} />
      <ListField
        label={pf.titles}
        items={v.items}
        max={10}
        min={0}
        make={free}
        title={(id) => index.get(id)?.name ?? "—"}
        onChange={(items) => onChange({ ...v, items: items.filter(Boolean) })}
      >
        {(id, update) => (
          <TitlePicker
            label={pf.title}
            value={id || null}
            allowEmpty={false}
            onChange={(next) => update(next ?? "")}
          />
        )}
      </ListField>
    </Stack>
  );
}

function ChallengeEditor({ value: v, onChange }: EditorProps<"challenge">) {
  const set = (patch: Partial<SettingsOf<"challenge">>) => onChange({ ...v, ...patch });
  return (
    <Stack>
      <TextField label={f.label} value={v.label} max={80} onChange={(label) => set({ label })} />
      <SelectField
        label={pf.kind}
        value={v.kind}
        options={kindOptions}
        onChange={(kind) => set({ kind })}
      />
      <NumberField
        label={pf.year}
        value={v.year}
        min={2000}
        max={2100}
        fallback={new Date().getFullYear()}
        onChange={(year) => set({ year })}
      />
      <NumberField
        label={pf.goal}
        value={v.goal}
        min={1}
        max={1000}
        fallback={1}
        onChange={(goal) => set({ goal })}
      />
      <p className="text-sm text-muted">{pf.challengeHint}</p>
    </Stack>
  );
}

function QuotesEditor({ value: v, onChange }: EditorProps<"quotes">) {
  return (
    <Stack>
      <Heading value={v} onChange={onChange} />
      <ListField
        label={f.items}
        items={v.items}
        max={20}
        make={() => ({ text: "", source: "", title_id: null })}
        title={(q) => q.text.slice(0, 40) || "—"}
        onChange={(items) => onChange({ ...v, items })}
      >
        {(q, update) => (
          <>
            <TextField
              label={pf.quote}
              value={q.text}
              max={1200}
              multiline
              onChange={(text) => update({ ...q, text })}
            />
            <TextField
              label={pf.source}
              value={q.source}
              onChange={(source) => update({ ...q, source })}
            />
            <TitlePicker
              label={pf.title}
              value={q.title_id}
              onChange={(title_id) => update({ ...q, title_id })}
            />
          </>
        )}
      </ListField>
    </Stack>
  );
}

function PlaylistEditor({ value: v, onChange }: EditorProps<"playlist">) {
  return (
    <Stack>
      <Heading value={v} onChange={onChange} />
      <TextField
        label={f.lead}
        value={v.lead}
        max={1200}
        multiline
        onChange={(lead) => onChange({ ...v, lead })}
      />
      <ListField
        label={pf.tracks}
        items={v.items}
        max={30}
        make={() => ({ track: "", artist: "", title_id: null, url: null })}
        title={(t) => t.track || "—"}
        onChange={(items) => onChange({ ...v, items })}
      >
        {(t, update) => (
          <>
            <TextField
              label={cf.track}
              value={t.track}
              max={80}
              onChange={(track) => update({ ...t, track })}
            />
            <TextField
              label={cf.artist}
              value={t.artist}
              max={80}
              onChange={(artist) => update({ ...t, artist })}
            />
            <TitlePicker
              label={pf.title}
              value={t.title_id}
              onChange={(title_id) => update({ ...t, title_id })}
            />
            <TextField
              label={cf.listen}
              value={t.url ?? ""}
              max={500}
              placeholder="https://"
              onChange={(url) => update({ ...t, url: url.trim() || null })}
            />
          </>
        )}
      </ListField>
    </Stack>
  );
}

function PostsEditor({ value: v, onChange }: EditorProps<"posts">) {
  return (
    <Stack>
      <Heading value={v} onChange={onChange} />
      <SelectField
        label={pf.postKind}
        value={v.kind}
        options={[
          { value: "all", label: pf.allPosts },
          { value: "review", label: ru.catalog.postKinds.review },
          { value: "note", label: ru.catalog.postKinds.note },
        ]}
        onChange={(kind) => onChange({ ...v, kind })}
      />
      <NumberField
        label={pf.limit}
        value={v.limit}
        min={1}
        max={24}
        fallback={6}
        onChange={(limit) => onChange({ ...v, limit })}
      />
      <p className="text-sm text-muted">{pf.postsHint}</p>
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
  profile: ProfileEditor,
  now: NowEditor,
  shelf: ShelfEditor,
  characters: CharactersEditor,
  top: TopEditor,
  challenge: ChallengeEditor,
  quotes: QuotesEditor,
  playlist: PlaylistEditor,
  posts: PostsEditor,
};
