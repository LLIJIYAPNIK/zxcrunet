/**
 * Font faces for cards, self-hosted by next/font. Each face is exposed as `--ff-<id>`
 * (see `fonts.ts`); `SITE_FONT_VARIABLES` declares them all on a card's root element.
 * Nothing is preloaded: the browser downloads only the faces a card actually uses.
 * Onest and JetBrains Mono come from the root layout (`--font-onest`, `--font-jetbrains-mono`).
 */
import {
  Caveat,
  Cormorant_Garamond,
  Dela_Gothic_One,
  EB_Garamond,
  Golos_Text,
  IBM_Plex_Mono,
  Inter,
  Lora,
  Manrope,
  Marck_Script,
  Monomakh,
  Old_Standard_TT,
  PT_Serif,
  Pixelify_Sans,
  Playfair_Display,
  Poiret_One,
  Prata,
  Press_Start_2P,
  Rubik_Glitch,
  Rubik_Wet_Paint,
  Ruslan_Display,
  Russo_One,
  Tektur,
  Unbounded,
  Yeseva_One,
} from "next/font/google";

const inter = Inter({ variable: "--ff-inter", subsets: ["latin", "cyrillic"], preload: false });
const manrope = Manrope({
  variable: "--ff-manrope",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const golos = Golos_Text({
  variable: "--ff-golos",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const unbounded = Unbounded({
  variable: "--ff-unbounded",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const russo = Russo_One({
  variable: "--ff-russo",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const dela = Dela_Gothic_One({
  variable: "--ff-dela-gothic",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const tektur = Tektur({ variable: "--ff-tektur", subsets: ["latin", "cyrillic"], preload: false });
const cormorant = Cormorant_Garamond({
  variable: "--ff-cormorant",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const playfair = Playfair_Display({
  variable: "--ff-playfair",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const garamond = EB_Garamond({
  variable: "--ff-eb-garamond",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const lora = Lora({ variable: "--ff-lora", subsets: ["latin", "cyrillic"], preload: false });
const ptSerif = PT_Serif({
  variable: "--ff-pt-serif",
  weight: ["400", "700"],
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const oldStandard = Old_Standard_TT({
  variable: "--ff-old-standard",
  weight: ["400", "700"],
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const yeseva = Yeseva_One({
  variable: "--ff-yeseva",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const prata = Prata({
  variable: "--ff-prata",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const ruslan = Ruslan_Display({
  variable: "--ff-ruslan",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const monomakh = Monomakh({
  variable: "--ff-monomakh",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
  // Next has no metrics for this face to build a fallback from.
  adjustFontFallback: false,
});
const glitch = Rubik_Glitch({
  variable: "--ff-rubik-glitch",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const wetPaint = Rubik_Wet_Paint({
  variable: "--ff-rubik-wet-paint",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const caveat = Caveat({ variable: "--ff-caveat", subsets: ["latin", "cyrillic"], preload: false });
const marck = Marck_Script({
  variable: "--ff-marck",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  variable: "--ff-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const pressStart = Press_Start_2P({
  variable: "--ff-press-start",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const pixelify = Pixelify_Sans({
  variable: "--ff-pixelify",
  subsets: ["latin", "cyrillic"],
  preload: false,
});
const poiret = Poiret_One({
  variable: "--ff-poiret",
  weight: "400",
  subsets: ["latin", "cyrillic"],
  preload: false,
});

/** Class names that declare every `--ff-*` variable; put on the card's root element. */
export const SITE_FONT_VARIABLES = [
  inter,
  manrope,
  golos,
  unbounded,
  russo,
  dela,
  tektur,
  cormorant,
  playfair,
  garamond,
  lora,
  ptSerif,
  oldStandard,
  yeseva,
  prata,
  ruslan,
  monomakh,
  glitch,
  wetPaint,
  caveat,
  marck,
  plexMono,
  pressStart,
  pixelify,
  poiret,
]
  .map((font) => font.variable)
  .join(" ");
