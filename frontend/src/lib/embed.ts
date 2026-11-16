/**
 * Videos hosted elsewhere. The owner pastes any link to the video; we keep only the
 * provider and the id (the backend checks their shape) and build the player URL here,
 * so a typed address never reaches an iframe.
 */
export const EMBED_PROVIDERS = ["youtube", "vk", "rutube"] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];
/** Mirror of backend `shared.application.content.Embed`. */
export type Embed = { provider: EmbedProvider; id: string; hash: string };

/** Hosts the player iframes come from (also the CSP `frame-src` list in next.config.ts). */
export const EMBED_ORIGINS = [
  "https://www.youtube-nocookie.com",
  "https://vk.com",
  "https://vkvideo.ru",
  "https://rutube.ru",
] as const;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VK_ID = /^-?\d{1,20}_\d{1,20}$/;
const RUTUBE_ID = /^[0-9a-f]{32}$/;
const HEX = /^[0-9a-f]{1,40}$/;

function youtube(url: URL): Embed | null {
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    id =
      first === "watch"
        ? url.searchParams.get("v")
        : ["embed", "shorts", "live", "v"].includes(first)
          ? second
          : null;
  }
  return id && YOUTUBE_ID.test(id) ? { provider: "youtube", id, hash: "" } : null;
}

function vk(url: URL): Embed | null {
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  if (!["vk.com", "vk.ru", "vkvideo.ru"].includes(host)) return null;
  const hash = url.searchParams.get("hash") ?? "";
  const safeHash = HEX.test(hash) ? hash : "";
  // Player link: video_ext.php?oid=-1&id=2&hash=…
  const oid = url.searchParams.get("oid");
  const vid = url.searchParams.get("id");
  if (url.pathname.endsWith("video_ext.php") && oid && vid) {
    const id = `${oid}_${vid}`;
    return VK_ID.test(id) ? { provider: "vk", id, hash: safeHash } : null;
  }
  // Page link: /video-1_2, /clip-1_2, or ?z=video-1_2 on a wall.
  const found = `${url.pathname} ${url.searchParams.get("z") ?? ""}`.match(
    /(?:video|clip)(-?\d{1,20}_\d{1,20})/,
  );
  return found ? { provider: "vk", id: found[1], hash: safeHash } : null;
}

function rutube(url: URL): Embed | null {
  if (url.hostname.replace(/^www\./, "") !== "rutube.ru") return null;
  const found = url.pathname.match(/\/(?:video|play\/embed|shorts)\/([0-9a-f]{32})/);
  return found && RUTUBE_ID.test(found[1]) ? { provider: "rutube", id: found[1], hash: "" } : null;
}

/** The video a link points to, or null when it is not a YouTube, VK Video or Rutube video. */
export function parseVideoLink(raw: string): Embed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return youtube(url) ?? vk(url) ?? rutube(url);
}

/** The player address for an iframe. */
export function embedSrc(embed: Embed): string {
  switch (embed.provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${embed.id}?rel=0`;
    case "vk": {
      const [oid, id] = embed.id.split("_");
      const hash = embed.hash ? `&hash=${embed.hash}` : "";
      return `https://vkvideo.ru/video_ext.php?oid=${oid}&id=${id}&hd=2${hash}`;
    }
    case "rutube":
      return `https://rutube.ru/play/embed/${embed.id}`;
  }
}

/** A link back to the video's own page (shown in the editor). */
export function embedPage(embed: Embed): string {
  switch (embed.provider) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${embed.id}`;
    case "vk":
      return `https://vkvideo.ru/video${embed.id}`;
    case "rutube":
      return `https://rutube.ru/video/${embed.id}/`;
  }
}

export const PROVIDER_NAMES: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  vk: "VK Видео",
  rutube: "Rutube",
};
