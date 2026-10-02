/**
 * Body regions — how clinicians name a place ("left knee", "right iliac
 * fossa"), which the anatomy model does not hold: it has structures (patella,
 * appendix), not regions. A region is picked by name and side, highlights the
 * model structures that sit in it, and stores words and side only — no FMA
 * code is invented for it (SNOMED body-structure coding comes later).
 *
 * The list lives in `packages/anatomy/body-regions.json`, one file for web and
 * native. Structure names are BodyParts3D's own, checked against the model;
 * `{side}` stands for "Left" / "Right".
 */
import catalogue from "../../../../../packages/anatomy/body-regions.json";
import type { AtlasPart, Laterality } from "./anatomy-atlas";

export interface BodyRegion {
  id: string;
  label: string;
  /** Has a left and a right; the side completes the name ("Left knee"). */
  sided: boolean;
  structures: string[];
}

/** Shared with the iOS and Android body maps, which read its `zone`s. */
export const BODY_REGIONS: ReadonlyArray<BodyRegion> = catalogue.regions;

const SIDE_WORD: Partial<Record<Laterality, string>> = { left: "Left", right: "Right" };

/** The region as a chart reads it: "Left knee", or "Knee" until a side is chosen. */
export function regionLabel(region: BodyRegion, side: Laterality | null): string {
  const word = side ? SIDE_WORD[side] : undefined;
  return region.sided && word ? `${word} ${region.label.toLowerCase()}` : region.label;
}

/**
 * The model parts that sit in the region — both sides until one is chosen,
 * and only names the model actually has.
 */
export function regionParts(
  region: BodyRegion,
  side: Laterality | null,
  partsByName: ReadonlyMap<string, AtlasPart>,
): AtlasPart[] {
  const sides = side === "left" ? ["Left"] : side === "right" ? ["Right"] : ["Left", "Right"];
  const names = region.structures.flatMap((s) =>
    s.includes("{side}") ? sides.map((w) => s.replace("{side}", w)) : [s],
  );
  return names.flatMap((n) => partsByName.get(n) ?? []);
}
