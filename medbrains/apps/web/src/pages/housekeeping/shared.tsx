// Housekeeping shared helpers — split from housekeeping.tsx (pure move).

import type { CleaningAreaType } from "@medbrains/types";

export const LINEN_TYPES = ["bedsheet", "pillowcover", "blanket", "towel", "gown", "curtain"];

export const AREA_TYPES: CleaningAreaType[] = [
  "icu",
  "ward",
  "ot",
  "er",
  "lab",
  "pharmacy",
  "corridor",
  "lobby",
  "washroom",
  "kitchen",
  "general",
];
