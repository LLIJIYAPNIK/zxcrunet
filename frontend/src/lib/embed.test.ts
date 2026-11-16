import { describe, expect, it } from "vitest";

import { embedSchema } from "@/blocks/schemas";

import { embedPage, embedSrc, parseVideoLink } from "./embed";

describe("video links", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "youtube", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "youtube", "dQw4w9WgXcQ"],
    ["https://youtube.com/shorts/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/embed/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://vk.com/video-22822305_456241864", "vk", "-22822305_456241864"],
    ["https://vkvideo.ru/video-22822305_456241864", "vk", "-22822305_456241864"],
    ["https://vk.com/wall-1_2?z=video-22822305_456241864%2Fpl_wall", "vk", "-22822305_456241864"],
    [
      "https://rutube.ru/video/c6cc4d620b1d4338901770a44b3e82f4/",
      "rutube",
      "c6cc4d620b1d4338901770a44b3e82f4",
    ],
    [
      "https://rutube.ru/play/embed/c6cc4d620b1d4338901770a44b3e82f4",
      "rutube",
      "c6cc4d620b1d4338901770a44b3e82f4",
    ],
  ])("%s", (link, provider, id) => {
    const embed = parseVideoLink(link);
    expect(embed).toMatchObject({ provider, id });
    expect(embedSchema.safeParse(embed).success).toBe(true);
  });

  it("keeps the hash of a VK player link", () => {
    const embed = parseVideoLink(
      "https://vk.com/video_ext.php?oid=-22822305&id=456241864&hash=a1b2c3d4e5f6&hd=2",
    );
    expect(embed).toEqual({ provider: "vk", id: "-22822305_456241864", hash: "a1b2c3d4e5f6" });
    expect(embedSrc(embed!)).toBe(
      "https://vkvideo.ru/video_ext.php?oid=-22822305&id=456241864&hd=2&hash=a1b2c3d4e5f6",
    );
  });

  it.each([
    "",
    "dQw4w9WgXcQ",
    "javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ",
    "https://evil.example/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://vimeo.com/123456",
    "https://rutube.ru/video/not-an-id/",
  ])("rejects %s", (link) => {
    expect(parseVideoLink(link)).toBeNull();
  });

  it("builds player and page addresses from the id only", () => {
    const yt = { provider: "youtube" as const, id: "dQw4w9WgXcQ", hash: "" };
    expect(embedSrc(yt)).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(embedPage(yt)).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(embedSrc({ provider: "rutube", id: "c6cc4d620b1d4338901770a44b3e82f4", hash: "" })).toBe(
      "https://rutube.ru/play/embed/c6cc4d620b1d4338901770a44b3e82f4",
    );
  });
});
