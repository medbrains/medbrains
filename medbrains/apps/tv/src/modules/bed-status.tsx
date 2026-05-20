/**
 * TV → bed status board. Ward-level occupancy with critical-care
 * highlight. Deep-link: medbrains://tv/bed-status?ward=icu
 */

import type { Module } from "@medbrains/mobile-shell";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";

function BedStatusScreen() {
  return (
    <TvBoard
      eyebrow="WARD"
      title="Bed occupancy"
      subtitle="Real-time bed state across all wards."
      legend="Updates from WebSocket · medbrains://tv/bed-status"
      tags={["TV-Ward", "TV-ICU", "IPD", "beds"]}
    >
      <TvSummaryRow
        items={[
          { label: "OCCUPIED", value: "—" },
          { label: "AVAILABLE", value: "—" },
          { label: "ISOLATION", value: "—" },
          { label: "TURNAROUND", value: "—" },
        ]}
      />
    </TvBoard>
  );
}

export const bedStatusModule: Module = {
  id: "bed-status",
  displayName: "Bed occupancy",
  icon: () => null,
  requiredPermissions: [],
  navigator: BedStatusScreen,
  appCodes: ["TV-Ward", "TV-ICU"],
  tags: ["tv", "ipd", "bed-status", "ward", "icu"],
};
