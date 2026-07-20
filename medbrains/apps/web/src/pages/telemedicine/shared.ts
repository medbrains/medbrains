// Telemedicine shared helpers — split from telemedicine.tsx (pure move).

import type { BadgeTone } from "@/components/ui";

export function acuityTone(a: string): BadgeTone {
  if (a === "emergent") return "danger";
  if (a === "urgent") return "warning";
  return "success";
}
