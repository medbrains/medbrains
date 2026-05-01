/**
 * TV → pharmacy dispensing queue. Tokens called for prescription
 * pickup; ready-for-collection blinks. Deep-link:
 *   medbrains://tv/pharmacy-queue
 */

import type { Module } from "@medbrains/mobile-shell";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";

function PharmacyQueueScreen() {
  return (
    <TvBoard
      eyebrow="PHARMACY"
      title="Dispensing queue"
      subtitle="Please proceed to the counter when your token shows."
      legend="Updates every 10 seconds · medbrains://tv/pharmacy-queue"
    >
      <TvSummaryRow
        items={[
          { label: "NOW SERVING", value: "—" },
          { label: "READY", value: "—" },
          { label: "WAITING", value: "—" },
        ]}
      />
    </TvBoard>
  );
}

export const pharmacyQueueModule: Module = {
  id: "pharmacy-queue",
  displayName: "Pharmacy queue",
  icon: () => null,
  requiredPermissions: [],
  navigator: PharmacyQueueScreen,
};
