import { SAMPLE_GAMES_BLOCKS, SAMPLE_PERSONAL_BLOCKS } from "@/blocks/sample-personal";

const home = SAMPLE_PERSONAL_BLOCKS as unknown as Record<string, unknown>[];
const games = SAMPLE_GAMES_BLOCKS as unknown as Record<string, unknown>[];

export const SAMPLE_PERSONAL_CONTENT = {
  kind: "personal" as const,
  title: "Саша Орлов",
  theme: { accent: "#b6ff2e", second: "#ff4f8b" },
  seo: { title: "", description: "" },
  pages: [
    { path: "", title: "Саша Орлов", blocks: home },
    { path: "games", title: "Игры", blocks: games },
  ],
};
