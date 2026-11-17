import plexMonoSemibold from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url";
import sansLatin from "@medbrains/design-system/assets/fonts/MedBrainsSans-latin.woff2?url";

/** A print window's document: its stylesheet (with its own `@page`) and body. */
export interface PrintPage {
  css: string;
  body: string;
}

/** Escape for interpolation into the print window's HTML; null prints as a dash. */
export function esc(value: unknown): string {
  if (value == null) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The fonts a drawn print uses, declared inside the print window. The popup is
 * a fresh document, so the app's own @font-face rules do not reach it, and
 * without these the UHID printed in Courier and the name in whatever the
 * printer's machine had. MedBrains Sans is IBM Plex Sans with easy-read
 * letterforms; IBM Plex Mono draws UHIDs and token numbers.
 */
export const PRINT_FONT_FACES = `
  @font-face { font-family: "MedBrains Sans"; font-weight: 400 700; src: url("${sansLatin}") format("woff2"); }
  @font-face { font-family: "IBM Plex Mono"; font-weight: 600; src: url("${plexMonoSemibold}") format("woff2"); }
`;
