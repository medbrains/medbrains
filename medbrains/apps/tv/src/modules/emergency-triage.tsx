/**
 * TV → emergency triage board. Live triage levels with code-colour
 * badges (Code Blue, Red, Pink, Black, Yellow, Orange). Restricted
 * to staff-only displays. Deep-link: medbrains://tv/emergency-triage
 */

import type { Module } from "@medbrains/mobile-shell";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";

function EmergencyTriageScreen() {
  return (
    <TvBoard
      eyebrow="EMERGENCY"
      title="Triage board"
      subtitle="ESI-level distribution + active code activations."
      legend="Updates every 5 seconds · medbrains://tv/emergency-triage"
    >
      <TvSummaryRow
        items={[
          { label: "ESI 1", value: "—" },
          { label: "ESI 2", value: "—" },
          { label: "ESI 3", value: "—" },
          { label: "ESI 4-5", value: "—" },
        ]}
      />
    </TvBoard>
  );
}

export const emergencyTriageModule: Module = {
  id: "emergency-triage",
  displayName: "Emergency triage",
  icon: () => null,
  requiredPermissions: [],
  navigator: EmergencyTriageScreen,
};
