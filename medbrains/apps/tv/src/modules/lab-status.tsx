/**
 * TV → lab status board. Tests in progress, ETAs, ready for
 * collection. Deep-link: medbrains://tv/lab-status
 */

import type { Module } from "@medbrains/mobile-shell";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";

function LabStatusScreen() {
  return (
    <TvBoard
      eyebrow="LABORATORY"
      title="Test progress"
      subtitle="Reports ready for collection blink amber."
      legend="Updates every 30 seconds · medbrains://tv/lab-status"
    >
      <TvSummaryRow
        items={[
          { label: "IN PROGRESS", value: "—" },
          { label: "READY", value: "—" },
          { label: "STAT", value: "—" },
          { label: "AVG TAT", value: "— min" },
        ]}
      />
    </TvBoard>
  );
}

export const labStatusModule: Module = {
  id: "lab-status",
  displayName: "Lab status",
  icon: () => null,
  requiredPermissions: [],
  navigator: LabStatusScreen,
};
