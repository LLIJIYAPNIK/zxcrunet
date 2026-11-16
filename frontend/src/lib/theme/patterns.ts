/** Background patterns of the profile card and the personal cover (mirror of the backend). */
export const PATTERNS = [
  "rings",
  "glow",
  "dots",
  "grid",
  "diagonal",
  "plus",
  "waves",
  "circuit",
  "topo",
  "lattice",
  "arches",
  "crosses",
  "stars",
  "none",
] as const;

export type PatternId = (typeof PATTERNS)[number];
