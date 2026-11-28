import { Suspense } from "react";
import { PANEL_COMPONENTS } from "./registry";
import type { SlotPanel } from "./use-panels";

interface EncounterPanelsProps {
  /** `usePanels("opd.encounter")`: the panels this user may open here. */
  panels: SlotPanel[];
  /** The one open, or null; only it is mounted, so a chunk loads on first open. */
  openPanel: string | null;
  patientId: string;
  encounterId: string;
  onClose: () => void;
}

/** The OPD encounter's `opd.encounter` slot: the open brick panel's modal, or nothing. */
export function EncounterPanels({ panels, openPanel, onClose, ...ids }: EncounterPanelsProps) {
  const Panel = panels.some((p) => p.id === openPanel)
    ? PANEL_COMPONENTS["opd.encounter"][openPanel ?? ""]
    : undefined;
  if (!Panel) return null;
  return (
    <Suspense fallback={null}>
      <Panel {...ids} opened onClose={onClose} />
    </Suspense>
  );
}
