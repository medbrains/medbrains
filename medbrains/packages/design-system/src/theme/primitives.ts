/**
 * MedBrains Design System — Tier 1: Primitive Tokens (Mantine bindings).
 *
 * The raw, framework-agnostic values live in `./tokens` (no Mantine, importable by React Native).
 * This module re-exports them for existing web imports and adds the Mantine `MantineColorsTuple`
 * wrappers the theme factory needs. Never reference these directly in components/SCSS — use the
 * semantic tokens (`semantic.ts`).
 */

import type { MantineColorsTuple } from "@mantine/core";
import { amber, blue, cinnabar, mint, ochre, rose, sky, slate, teal, violet } from "./tokens.js";

export * from "./tokens.js";

// ── Mantine Tuples (the only Mantine-coupled part of tier 1) ────────────

export const blueTuple: MantineColorsTuple = [...blue] as unknown as MantineColorsTuple;
export const cinnabarTuple: MantineColorsTuple = [...cinnabar] as unknown as MantineColorsTuple;
export const mintTuple: MantineColorsTuple = [...mint] as unknown as MantineColorsTuple;
export const amberTuple: MantineColorsTuple = [...amber] as unknown as MantineColorsTuple;
export const roseTuple: MantineColorsTuple = [...rose] as unknown as MantineColorsTuple;
export const skyTuple: MantineColorsTuple = [...sky] as unknown as MantineColorsTuple;
export const violetTuple: MantineColorsTuple = [...violet] as unknown as MantineColorsTuple;
export const ochreTuple: MantineColorsTuple = [...ochre] as unknown as MantineColorsTuple;
export const tealTuple: MantineColorsTuple = [...teal] as unknown as MantineColorsTuple;
export const slateTuple: MantineColorsTuple = [...slate] as unknown as MantineColorsTuple;

/** Legacy alias — anything still importing `emeraldTuple` resolves to mint. */
export const emeraldTuple: MantineColorsTuple = mintTuple;

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
