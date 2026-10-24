/**
 * MedBrains Design System — Tier 1: Primitive Tokens (Mantine bindings).
 *
 * The raw, framework-agnostic values live in `./tokens` (no Mantine, importable by React Native).
 * This module re-exports them for existing web imports and adds the Mantine `MantineColorsTuple`
 * wrappers the theme factory needs. Never reference these directly in components/SCSS — use the
 * semantic tokens (`semantic.ts`).
 */

import type { MantineColorsTuple } from "@mantine/core";
import { ramps } from "./colors.generated.js";
import { ochre, slate } from "./tokens.js";

export * from "./tokens.js";

// ── Mantine Tuples (the only Mantine-coupled part of tier 1) ────────────
//
// Mantine wants ten shades, lightest first; the M3 ramps give tones 95 → 10.
// Shade 5 is tone 50, which pins to brand blue #0F62FE on the Blue ramp.
// Filled / light / outline colours are overridden per scheme from the roles
// in `cssVariableResolver`, so the shades only matter for `color="x.6"` calls.

const TONES = ["95", "90", "80", "70", "60", "50", "40", "30", "20", "10"] as const;
const toneTuple = (ramp: Record<(typeof TONES)[number], string>) =>
  TONES.map((t) => ramp[t]) as unknown as MantineColorsTuple;

export const blueTuple = toneTuple(ramps.Blue);
export const purpleTuple = toneTuple(ramps.Purple);
export const greenTuple = toneTuple(ramps.Green);
export const amberTuple = toneTuple(ramps.Amber);
export const redTuple = toneTuple(ramps.Red);
export const neutralTuple = toneTuple(ramps.Neutral);
/** Mantine's `dark` scale (dark[7] = body, dark[0] = text) from the website's night tokens. */
export const darkTuple = [
  ramps.Site.nightText,
  ramps.Site.nightMuted,
  ramps.Site.nightOutline,
  ramps.Site.nightOutline,
  ramps.Site.nightLine,
  ramps.Site.nightLine,
  // dark[6] fills disabled buttons; one step above the card so they stay visible.
  ramps.Site.nightStep,
  ramps.Site.night,
  ramps.Site.nightDeep,
  ramps.Neutral["0"],
] as unknown as MantineColorsTuple;
// Outside the M3 roles: orange / slate stay for legacy `color="…"` call sites
// (`teal` and `violet` resolve to the brand purple accent in mantine.ts).
export const ochreTuple: MantineColorsTuple = [...ochre] as unknown as MantineColorsTuple;
export const slateTuple: MantineColorsTuple = [...slate] as unknown as MantineColorsTuple;

/**
 * Tissue colours for the 3D body-site model (BodyParts3D via human-atlas).
 * Anatomical, not status colour: the same in both themes, since the model
 * sits on its own lit stage. `selected` marks the picked structure.
 */
export const ANATOMY_PALETTE = {
  skeletal: "#e2d9ba",
  muscular: "#a85b50",
  cardiac: "#b96760",
  sensory: "#b0c8ce",
  arterial: "#c05245",
  venous: "#527c9f",
  nervous: "#d8b565",
  respiratory: "#b98991",
  digestive: "#b8916b",
  urinary: "#b47961",
  lymphatic: "#879f7c",
  endocrine: "#c5a09a",
  reproductive: "#bda098",
  integumentary: "#ba9b7d",
  connective: "#aec3bb",
  selected: "#2fb5a0",
} as const;
