import { useAuthStore, useHasPermission } from "@medbrains/stores";
import { useCallback } from "react";

interface CancelGate {
  userId: string | undefined;
  /** Holds the route permission the cancel endpoint requires. */
  holdsRoute: boolean;
  /** Holds the department's `*.orders.cancel_any` (true for bypass roles). */
  isTeam: boolean;
}

/**
 * Mirrors `require_order_cancel` on the server: the route permission, and
 * either the order is the caller's own or the caller is the department team.
 */
export function canCancelOrder(gate: CancelGate, orderedBy: string): boolean {
  return gate.holdsRoute && (gate.isTeam || orderedBy === gate.userId);
}

/** Per-row cancel gate from data already on the row — no per-row fetch. */
export function useCanCancelOrder(
  routePermission: string,
  teamPermission: string,
): (orderedBy: string) => boolean {
  const userId = useAuthStore((s) => s.user?.id);
  const holdsRoute = useHasPermission(routePermission);
  const isTeam = useHasPermission(teamPermission);
  return useCallback(
    (orderedBy: string) => canCancelOrder({ userId, holdsRoute, isTeam }, orderedBy),
    [userId, holdsRoute, isTeam],
  );
}
