// TV-Displays shared helpers — split from tv-displays.tsx (pure move).

import type { TokenBoardSurfaceDefinition } from "@medbrains/types";
import { TOKEN_BOARD_SURFACE_LIST } from "@medbrains/types";

/**
 * Safety net, not the update path. Queue transitions push a live board signal
 * (`opd.queue.changed`) and the board refreshes on that, so this only has to
 * catch the case where the socket dropped and its reconnect missed a frame.
 *
 * It was 5s: five queries at that cadence is ~3,600 requests an hour per screen,
 * on the surface DEVICE-CONSTRAINED-RULES is strictest about. A board must never
 * go stale, so the poll stays — just at a rate that reflects being a backstop.
 */
export const QUEUE_REFRESH_MS = 60_000;

/**
 * Registered displays change when an administrator adds one, not while a clinic
 * runs. No signal needed — this just should not have been on the queue cadence.
 */
export const DISPLAY_LIST_REFRESH_MS = 300_000;

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
