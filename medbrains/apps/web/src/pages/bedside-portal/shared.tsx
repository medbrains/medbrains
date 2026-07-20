// Bedside-portal shared helpers — split from bedside-portal.tsx (pure move).

import type { BedsideRequestType } from "@medbrains/types";
import {
  IconArrowsMove,
  IconBath,
  IconBed,
  IconBell,
  IconDots,
  IconGlass,
  IconHeartRateMonitor,
} from "@tabler/icons-react";
import type React from "react";

export const REQUEST_TYPE_CONFIG: Record<
  BedsideRequestType,
  { label: string; icon: React.ReactNode; color: string }
> = {
  nurse_call: { label: "Nurse Call", icon: <IconBell size={28} />, color: "red" },
  pain_management: {
    label: "Pain Help",
    icon: <IconHeartRateMonitor size={28} />,
    color: "orange",
  },
  bathroom_assist: { label: "Bathroom", icon: <IconBath size={28} />, color: "blue" },
  water_food: { label: "Water / Food", icon: <IconGlass size={28} />, color: "cyan" },
  blanket_pillow: { label: "Blanket / Pillow", icon: <IconBed size={28} />, color: "violet" },
  position_change: { label: "Reposition", icon: <IconArrowsMove size={28} />, color: "teal" },
  other: { label: "Other", icon: <IconDots size={28} />, color: "gray" },
};

export function compactContextId(value: string) {
  return value ? value.slice(0, 8) : "";
}
