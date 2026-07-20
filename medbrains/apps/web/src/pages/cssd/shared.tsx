// CSSD shared helpers — split from cssd.tsx (pure move).

import type { SterilizationMethod } from "@medbrains/types";

export const methodLabels: Record<SterilizationMethod, string> = {
  steam: "Steam (Autoclave)",
  eto: "ETO (Ethylene Oxide)",
  plasma: "Plasma",
  dry_heat: "Dry Heat",
  flash: "Flash",
};
