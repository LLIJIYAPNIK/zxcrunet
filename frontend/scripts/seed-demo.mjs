/**
 * Fills an existing account with two ready cards built from the showcase samples:
 * a business card (/ui/sample) and a personal card with shelves, the Dark Souls series
 * and posts (/ui/sample/personal). Goes through the public API like the cabinet does.
 *
 *   node scripts/seed-demo.mjs --email test@zxc.local --password test-password-123
 *
 * Options: --api http://localhost:8000, --origin http://localhost:3000,
 * --business anna, --personal sasha (slugs). Re-running recreates both demo sites;
 * catalog titles and posts are matched by name and not duplicated.
 * Needs Node 22.18+ (imports the TypeScript samples with type stripping).
 */
import { parseArgs } from "node:util";

import { SAMPLE_BUSINESS_BLOCKS } from "../src/blocks/sample.ts";
import {
  SAMPLE_CATALOG,
  SAMPLE_GAMES_BLOCKS,
  SAMPLE_PERSONAL_BLOCKS,
} from "../src/blocks/sample-personal.ts";

const { values: opts } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    api: { type: "string", default: "http://localhost:8000" },
    origin: { type: "string", default: "http://localhost:3000" },
    business: { type: "string", default: "anna" },
    personal: { type: "string", default: "sasha" },
  },
});

if (!opts.email || !opts.password) {
  console.error("Usage: node scripts/seed-demo.mjs --email <email> --password <password>");
  process.exit(2);
}

let cookie = "";

async function call(method, path, body) {
  const response = await fetch(`${opts.api}${path}`, {
    method,
    headers: {
      Origin: opts.origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = data?.error ?? data;
    throw new Error(`${method} ${path} → ${response.status}: ${JSON.stringify(error)}`);
  }
  return data;
}

/** Copies `value` without the given top-level keys. */
function omit(value, ...keys) {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Replaces sample title ids (in blocks, entries, posts) with the ids the API gave. */
function remap(blocks, ids) {
  let json = JSON.stringify(blocks);
  for (const [from, to] of ids) json = json.replaceAll(from, to);
  return JSON.parse(json);
}

async function recreateSite(kind, slug, title) {
  const { sites } = await call("GET", "/api/sites");
  const old = sites.find((s) => s.slug === slug);
  if (old) {
    await call("DELETE", `/api/sites/${old.id}`);
    console.log(`  removed old ${slug}`);
  }
  return call("POST", "/api/sites", { kind, slug, title });
}

async function seedCatalog() {
  const existing = await call("GET", "/api/catalog");
  const byName = new Map(existing.titles.map((t) => [`${t.kind}:${t.name}`, t.id]));
  const ids = new Map();

  // Series first, so their parts can point at them.
  const titles = [...SAMPLE_CATALOG.titles].sort(
    (a, b) => Number(b.is_series) - Number(a.is_series),
  );
  const bodyOf = (t) => remap(omit(t, "id", "updated_at"), ids);
  let created = 0;
  const withLinks = [];
  for (const t of titles) {
    const found = byName.get(`${t.kind}:${t.name}`);
    if (found) {
      ids.set(t.id, found);
      continue;
    }
    // «Related» links may point at titles that do not exist yet: add them in a second pass.
    const body = bodyOf(t);
    const related = body.entry?.details?.related ?? [];
    if (related.length) {
      body.entry.details.related = [];
      withLinks.push(t);
    }
    const saved = await call("POST", "/api/catalog/titles", body);
    ids.set(t.id, saved.id);
    created += 1;
  }
  for (const t of withLinks) {
    await call("PUT", `/api/catalog/titles/${ids.get(t.id)}`, bodyOf(t));
  }

  const headings = new Set(existing.posts.map((p) => p.heading));
  for (const post of SAMPLE_CATALOG.posts) {
    if (headings.has(post.heading)) continue;
    await call("POST", "/api/catalog/posts", remap(omit(post, "id"), ids));
  }
  console.log(`  catalog: ${created} new titles, ${titles.length - created} already there`);
  return ids;
}

async function main() {
  await call("POST", "/api/auth/login", { email: opts.email, password: opts.password });
  console.log(`Signed in as ${opts.email}`);

  console.log("Business card");
  const business = await recreateSite("business", opts.business, "Анна Волкова");
  const blocks = SAMPLE_BUSINESS_BLOCKS.map((b) =>
    b.type === "hero" ? { ...b, settings: { ...b.settings, pattern: "circuit" } } : b,
  );
  await call("PUT", `/api/sites/${business.id}/pages/${business.pages[0].id}/blocks`, { blocks });
  await call("PATCH", `/api/sites/${business.id}`, {
    accent: "#5ab9fc",
    second: "#ffb545",
    seo_title: "Анна Волкова — продуктовый дизайнер",
  });
  await call("POST", `/api/sites/${business.id}/publish`);
  console.log(`  published: ${business.host}`);

  console.log("Personal card");
  const ids = await seedCatalog();
  const personal = await recreateSite("personal", opts.personal, "Саша Орлов");
  await call("PUT", `/api/sites/${personal.id}/pages/${personal.pages[0].id}/blocks`, {
    blocks: remap(SAMPLE_PERSONAL_BLOCKS, ids),
  });
  const games = await call("POST", `/api/sites/${personal.id}/pages`, {
    path: "games",
    title: "Игры",
  });
  await call("PUT", `/api/sites/${personal.id}/pages/${games.id}/blocks`, {
    blocks: remap(SAMPLE_GAMES_BLOCKS, ids),
  });
  await call("PATCH", `/api/sites/${personal.id}`, { accent: "#b6ff2e", second: "#ff4f8b" });
  await call("POST", `/api/sites/${personal.id}/publish`);
  console.log(`  published: ${personal.host}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
