// IPD BatchExpiryTab — split from pharmacy.tsx (pure move).

import { BatchLedgerView } from "./batch-ledger-view";
import { DeadStockView } from "./dead-stock-view";
import { NearExpiryView } from "./near-expiry-view";
import { SegmentedControl, Stack } from "@mantine/core";
import { useState } from "react";

export function BatchExpiryTab() {
  const [view, setView] = useState("batches");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Batch Ledger", value: "batches" },
          { label: "Near Expiry", value: "near-expiry" },
          { label: "Dead Stock", value: "dead-stock" },
        ]}
      />
      {view === "batches" && <BatchLedgerView />}
      {view === "near-expiry" && <NearExpiryView />}
      {view === "dead-stock" && <DeadStockView />}
    </Stack>
  );
}

// Surfaces the earliest-expiry batches for the drugs in this order so
// dispensers can apply FEFO at a glance. Filters the global near-expiry
// report by drug_name (NearExpiryRow doesn't carry catalog_item_id).
