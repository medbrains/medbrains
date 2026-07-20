// Insurance shared helpers — split from insurance.tsx (pure move).

import type { FieldAccessLevel } from "@medbrains/types";

export function canViewSensitiveField(access: FieldAccessLevel) {
  return access !== "hidden";
}
