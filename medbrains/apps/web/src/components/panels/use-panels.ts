import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import { BRICK_MANIFESTS } from "@medbrains/types";
import { useMemo } from "react";
import { PANEL_COMPONENTS, type PanelSlot } from "./registry";

/** A panel a slot shows: its manifest id and the brick that owns it. */
export interface SlotPanel {
  id: string;
  brick: string;
}

/**
 * The panels `slot` shows this user, in brick order: the brick is on in this hospital and the
 * user holds the panel's permission. Both answers come from the server (`/auth/me` loads the
 * permissions and `disabled_modules`); this only reflects them. A panel that fails either is left
 * out, never greyed, and its chunk is never downloaded.
 */
export function usePanels(slot: PanelSlot): SlotPanel[] {
  const disabled = useModuleStore((s) => s.disabledModules);
  const permissions = usePermissionStore((s) => s.userPermissions);
  const role = usePermissionStore((s) => s.userRole);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `hasPermission` reads `permissions` and `role` through getState, so they must re-run it.
  return useMemo(() => {
    const { hasPermission } = usePermissionStore.getState();
    return Object.values(BRICK_MANIFESTS).flatMap((brick) =>
      disabled.has(brick.id)
        ? []
        : brick.panels
            .filter((p) => p.slot === slot && p.id in PANEL_COMPONENTS[slot])
            .filter((p) => hasPermission(p.permission))
            .map((p) => ({ id: p.id, brick: brick.id })),
    );
  }, [disabled, permissions, role, slot]);
}
