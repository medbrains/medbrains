/**
 * The decisions behind the emergency flash, kept out of the component so
 * they can be tested without a device.
 */

import { emergencyCodes } from "@medbrains/design-system/tokens";
import type { CodeBlueEventRow, EmergencyCodeActivation } from "@medbrains/types";

/** Three taps inside this window is an acknowledgement, not a fidget. */
export const TRIPLE_TAP_WINDOW_MS = 700;

export interface OpenCode {
  /** Stable across polls, so a silence sticks to one activation. */
  key: string;
  label: string;
  colour: string;
  ink: string;
  location: string;
  /** Set for the nursing code blue, which can be responded to. */
  codeBlueId: string | null;
}

const CODE_BLUE_STYLE = {
  colour: emergencyCodes.blue,
  label: "CODE BLUE",
  ink: "#FFFFFF",
} as const;

/** Fixed colour and the word beside it, keyed by the server's `code_type`. */
const CODE_STYLE: Readonly<Record<string, { colour: string; label: string; ink: string }>> = {
  code_blue: CODE_BLUE_STYLE,
  code_red: { colour: emergencyCodes.red, label: "CODE RED", ink: "#FFFFFF" },
  code_pink: { colour: emergencyCodes.pink, label: "CODE PINK", ink: "#FFFFFF" },
  code_black: { colour: emergencyCodes.black, label: "CODE BLACK", ink: "#FFFFFF" },
  code_yellow: { colour: emergencyCodes.yellow, label: "CODE YELLOW", ink: "#0A0A0A" },
  code_orange: { colour: emergencyCodes.orange, label: "CODE ORANGE", ink: "#FFFFFF" },
};

export function fromCodeBlue(row: CodeBlueEventRow): OpenCode {
  return {
    key: `cb:${row.id}`,
    label: CODE_BLUE_STYLE.label,
    colour: CODE_BLUE_STYLE.colour,
    ink: CODE_BLUE_STYLE.ink,
    location: row.location,
    codeBlueId: row.id,
  };
}

/** An unknown code is still an alarm; it is labelled by its own name. */
export function fromEmergencyCode(row: EmergencyCodeActivation): OpenCode {
  const s = CODE_STYLE[row.code_type];
  return {
    key: `er:${row.id}`,
    label: s?.label ?? row.code_type.replace(/_/g, " ").toUpperCase(),
    colour: s?.colour ?? emergencyCodes.red,
    ink: s?.ink ?? "#FFFFFF",
    location: row.location ?? "location not recorded",
    codeBlueId: null,
  };
}

/**
 * Everything open that this phone has not silenced. A code blue comes first:
 * it is the one with a heart behind it, and it is the one that can be
 * answered from here.
 */
export function openCodes(
  codeBlues: ReadonlyArray<CodeBlueEventRow>,
  erCodes: ReadonlyArray<EmergencyCodeActivation>,
  silenced: ReadonlySet<string>,
): OpenCode[] {
  const all = [...codeBlues.map(fromCodeBlue), ...erCodes.map(fromEmergencyCode)];
  const live = all.filter((c) => !silenced.has(c.key));
  return [
    ...live.filter((c) => c.codeBlueId !== null),
    ...live.filter((c) => c.codeBlueId === null),
  ];
}

/**
 * Feed one tap; returns the taps still inside the window, and whether that
 * tap completed a triple. Three taps must land inside the window together —
 * two slow taps and a third do not count.
 */
export function registerTap(
  taps: ReadonlyArray<number>,
  now: number,
): { taps: number[]; triple: boolean } {
  const recent = [...taps.filter((t) => now - t < TRIPLE_TAP_WINDOW_MS), now];
  if (recent.length >= 3) return { taps: [], triple: true };
  return { taps: recent, triple: false };
}
