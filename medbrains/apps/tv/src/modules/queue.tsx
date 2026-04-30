/**
 * TV → OPD queue board. Auto-refresh per-department token list,
 * called token blinks, optional doctor name. Per-display deep-link:
 *   medbrains://tv/queue?department=cardiology
 *
 * This scaffold ships the visual shell; live WebSocket wiring lands
 * in the TV-data-feed phase.
 */

import type { Module } from "@medbrains/mobile-shell";
import { TvBoard, TvSummaryRow } from "../components/tv-board.js";

function QueueScreen() {
  return (
    <TvBoard
      eyebrow="OPD"
      title="Queue board"
      subtitle="Live token call — please proceed when your token blinks."
      legend="Updates every 5 seconds · medbrains://tv/queue"
    >
      <TvSummaryRow
        items={[
          { label: "NOW SERVING", value: "—" },
          { label: "WAITING", value: "—" },
          { label: "AVG WAIT", value: "— min" },
        ]}
      />
    </TvBoard>
  );
}

export const queueModule: Module = {
  id: "queue",
  displayName: "Queue board",
  icon: () => null,
  requiredPermissions: [],
  navigator: QueueScreen,
};
