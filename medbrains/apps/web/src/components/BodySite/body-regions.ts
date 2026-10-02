/**
 * Body regions — how clinicians name a place ("left knee", "right iliac
 * fossa"), which the anatomy model does not hold: it has structures (patella,
 * appendix), not regions. A region is picked by name and side, highlights the
 * model structures that sit in it, and stores words and side only — no FMA
 * code is invented for it (SNOMED body-structure coding comes later).
 *
 * Structure names are BodyParts3D's own, checked against the model; `{side}`
 * stands for "Left" / "Right".
 */
import type { AtlasPart, Laterality } from "./anatomy-atlas";

export interface BodyRegion {
  id: string;
  label: string;
  /** Has a left and a right; the side completes the name ("Left knee"). */
  sided: boolean;
  structures: string[];
}

export const BODY_REGIONS: ReadonlyArray<BodyRegion> = [
  { id: "head", label: "Head", sided: false, structures: ["Frontal bone", "Occipital bone"] },
  { id: "face", label: "Face", sided: false, structures: ["Mandible"] },
  { id: "neck", label: "Neck", sided: false, structures: ["Seventh cervical vertebra"] },
  {
    id: "chest",
    label: "Chest",
    sided: false,
    structures: ["Body of sternum", "Left fifth rib", "Right fifth rib"],
  },
  {
    id: "epigastrium",
    label: "Epigastrium",
    sided: false,
    structures: ["Stomach", "Xiphoid process"],
  },
  {
    id: "right-hypochondrium",
    label: "Right hypochondrium",
    sided: false,
    structures: ["Gallbladder"],
  },
  { id: "left-hypochondrium", label: "Left hypochondrium", sided: false, structures: ["Spleen"] },
  { id: "umbilical", label: "Umbilical region", sided: false, structures: ["Transverse colon"] },
  { id: "right-iliac-fossa", label: "Right iliac fossa", sided: false, structures: ["Appendix"] },
  {
    id: "left-iliac-fossa",
    label: "Left iliac fossa",
    sided: false,
    structures: ["Descending colon"],
  },
  { id: "suprapubic", label: "Suprapubic region", sided: false, structures: ["Urinary bladder"] },
  { id: "loin", label: "Loin", sided: true, structures: ["{side} kidney"] },
  {
    id: "lower-back",
    label: "Lower back",
    sided: false,
    structures: ["First lumbar vertebra", "Fifth lumbar vertebra"],
  },
  { id: "sacral", label: "Sacral region", sided: false, structures: ["Sacrum"] },
  {
    id: "shoulder",
    label: "Shoulder",
    sided: true,
    structures: ["{side} clavicle", "{side} scapula"],
  },
  { id: "upper-arm", label: "Upper arm", sided: true, structures: ["{side} humerus"] },
  { id: "forearm", label: "Forearm", sided: true, structures: ["{side} radius", "{side} ulna"] },
  { id: "wrist", label: "Wrist", sided: true, structures: ["{side} scaphoid"] },
  { id: "hand", label: "Hand", sided: true, structures: ["{side} first metacarpal bone"] },
  { id: "hip", label: "Hip", sided: true, structures: ["{side} hip bone"] },
  { id: "buttock", label: "Buttock", sided: true, structures: ["{side} gluteus maximus"] },
  { id: "thigh", label: "Thigh", sided: true, structures: ["{side} femur"] },
  { id: "knee", label: "Knee", sided: true, structures: ["{side} patella"] },
  { id: "leg", label: "Leg (shin)", sided: true, structures: ["{side} tibia", "{side} fibula"] },
  { id: "ankle", label: "Ankle", sided: true, structures: ["{side} talus"] },
  { id: "heel", label: "Heel", sided: true, structures: ["{side} calcaneus"] },
  { id: "foot", label: "Foot", sided: true, structures: ["{side} first metatarsal bone"] },
];

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
