import { useModuleStore } from "@medbrains/stores";
import type { ClinicalJourneyActionId } from "@medbrains/types";

/** Action prefixes whose brick is not the prefix itself. */
const ACTION_BRICK: Record<string, string> = {
  "orders.medication": "opd",
  "orders.lab": "lab",
  "orders.radiology": "radiology",
  imaging: "radiology",
};

/**
 * The brick an action belongs to, by its id (`billing.collect_payment` →
 * `billing`), so an action whose brick is switched off is not offered.
 * Patient, consent and MRD actions belong to every install.
 */
export function journeyActionBrick(actionId: ClinicalJourneyActionId): string | null {
  const prefix = actionId.split(".")[0] ?? "";
  const brick = ACTION_BRICK[actionId] ?? ACTION_BRICK[prefix] ?? prefix;
  return ["patient", "consent", "mrd"].includes(brick) ? null : brick;
}

/**
 * Whether an action is left off this surface: the caller hid it, or its brick
 * is switched off for the hospital (hidden, never greyed).
 */
export function useIsActionHidden(hiddenActionIds: readonly ClinicalJourneyActionId[]) {
  const disabledModules = useModuleStore((state) => state.disabledModules);
  const hidden = new Set(hiddenActionIds);
  return (actionId: ClinicalJourneyActionId) =>
    hidden.has(actionId) || disabledModules.has(journeyActionBrick(actionId) ?? "");
}
