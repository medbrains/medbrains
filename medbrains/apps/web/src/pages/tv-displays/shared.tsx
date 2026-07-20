// TV-Displays shared helpers — split from tv-displays.tsx (pure move).

import type { TokenBoardSurfaceDefinition } from "@medbrains/types";
import { TOKEN_BOARD_SURFACE_LIST } from "@medbrains/types";

export const QUEUE_REFRESH_MS = 5_000;

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

interface DisplayLaunchDefinition {
  appCodes: readonly string[];
  deepLink: string;
  label: string;
  supportsDepartment?: boolean;
}

export interface DisplayLaunchTarget {
  appCodes: readonly string[];
  href: string;
  label: string;
}

function tokenBoardLaunchDefinition(surface: TokenBoardSurfaceDefinition): DisplayLaunchDefinition {
  return {
    appCodes: surface.targets.tvAppCodes,
    deepLink: surface.targets.tvDeepLink,
    label: `${surface.title} board`,
    supportsDepartment: surface.id === "opd",
  };
}

const DISPLAY_LAUNCH_TARGETS: Record<string, DisplayLaunchDefinition> = {
  ...Object.fromEntries(
    TOKEN_BOARD_SURFACE_LIST.map((surface) => [
      surface.targets.tvDisplayType,
      tokenBoardLaunchDefinition(surface),
    ]),
  ),
  bed_status: {
    appCodes: ["TV-Ward"],
    deepLink: "medbrains://tv/bed-status",
    label: "Bed status board",
  },
  digital_signage: {
    appCodes: ["TV-Notice"],
    deepLink: "medbrains://tv/digital-signage",
    label: "Digital signage",
  },
};

export function displayLaunchTarget(
  displayType: string,
  departmentId?: string | null,
): DisplayLaunchTarget | null {
  const target = DISPLAY_LAUNCH_TARGETS[displayType];
  if (!target) return null;

  const departmentQuery =
    target.supportsDepartment && departmentId
      ? `?department=${encodeURIComponent(departmentId)}`
      : "";

  return {
    appCodes: target.appCodes,
    href: `${target.deepLink}${departmentQuery}`,
    label: target.label,
  };
}
