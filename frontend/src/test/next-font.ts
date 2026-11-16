/** Stand-in for `next/font/google` under vitest: every font is a CSS variable class. */
type Options = { variable?: string };

function font(options: Options = {}) {
  const name = options.variable ?? "--font";
  return { className: `font${name}`, variable: `var${name}`, style: { fontFamily: name } };
}

export const Caveat = font;
export const Cormorant_Garamond = font;
export const Dela_Gothic_One = font;
export const EB_Garamond = font;
export const Golos_Text = font;
export const IBM_Plex_Mono = font;
export const Inter = font;
export const JetBrains_Mono = font;
export const Lora = font;
export const Manrope = font;
export const Marck_Script = font;
export const Monomakh = font;
export const Old_Standard_TT = font;
export const Onest = font;
export const PT_Serif = font;
export const Pixelify_Sans = font;
export const Playfair_Display = font;
export const Poiret_One = font;
export const Prata = font;
export const Press_Start_2P = font;
export const Rubik_Glitch = font;
export const Rubik_Wet_Paint = font;
export const Ruslan_Display = font;
export const Russo_One = font;
export const Tektur = font;
export const Unbounded = font;
export const Yeseva_One = font;
