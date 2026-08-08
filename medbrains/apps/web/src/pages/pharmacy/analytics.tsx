// IPD AnalyticsTab — split from pharmacy.tsx (pure move).

import { SegmentedControl, Stack } from "@mantine/core";
import { useState } from "react";
import { AbcVedView } from "./abc-ved-view";
import { ConsumptionView } from "./consumption-view";
import { UtilizationView } from "./utilization-view";

export function AnalyticsTab() {
  const [view, setView] = useState("consumption");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { label: "Consumption", value: "consumption" },
          { label: "ABC-VED", value: "abc-ved" },
          { label: "Drug Utilization", value: "utilization" },
        ]}
      />
      {view === "consumption" && <ConsumptionView />}
      {view === "abc-ved" && <AbcVedView />}
      {view === "utilization" && <UtilizationView />}
    </Stack>
  );
}
