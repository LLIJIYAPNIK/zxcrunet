"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { DEFAULT_PRESET, derivePalette, paletteCssVars, type Palette } from "@/lib/theme/palette";

import { choiceFromPreset, type PaletteChoice } from "./PalettePicker";

type NeonContextValue = {
  choice: PaletteChoice;
  palette: Palette;
  setChoice: (choice: PaletteChoice) => void;
};

const NeonContext = createContext<NeonContextValue | null>(null);

export function useNeon(): NeonContextValue {
  const ctx = useContext(NeonContext);
  if (!ctx) throw new Error("useNeon must be used inside <NeonProvider>");
  return ctx;
}

type NeonProviderProps = {
  children: ReactNode;
  initial?: PaletteChoice;
  className?: string;
};

/** Holds the live neon choice and repaints everything inside through CSS variables. */
export function NeonProvider({ children, initial, className }: NeonProviderProps) {
  const [choice, setChoice] = useState<PaletteChoice>(initial ?? choiceFromPreset(DEFAULT_PRESET));
  const palette = useMemo(() => derivePalette(choice.accent, choice.second), [choice]);
  const value = useMemo(() => ({ choice, palette, setChoice }), [choice, palette]);

  return (
    <NeonContext.Provider value={value}>
      <div
        className={cn("bg-bg text-ink transition-colors duration-300", className)}
        style={paletteCssVars(palette) as CSSProperties}
      >
        {children}
      </div>
    </NeonContext.Provider>
  );
}
