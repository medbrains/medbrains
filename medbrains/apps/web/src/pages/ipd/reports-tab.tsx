// IPD ReportsTab — split from ipd.tsx (pure move).

import { AnesthesiaComplicationsReport } from "./anesthesia-complications";
import { AlosReport, CensusReport, DischargeStatsReport, OccupancyReport, SurgeonCaseloadReport } from "./reports";
import { Group, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";

export function ReportsTab() {
  const [reportType, setReportType] = useState("census");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  return (
    <Stack>
      <Group>
        <Select
          label="Report"
          data={[
            { value: "census", label: "Current Census" },
            { value: "occupancy", label: "Occupancy Rate" },
            { value: "alos", label: "Average Length of Stay" },
            { value: "discharge-stats", label: "Discharge Statistics" },
            { value: "surgeon-caseload", label: "Surgeon Caseload (OT)" },
            { value: "anesthesia-complications", label: "Anesthesia Complications (OT)" },
          ]}
          value={reportType}
          onChange={(v) => setReportType(v ?? "census")}
          w={250}
        />
        {reportType !== "census" && (
          <>
            <TextInput
              label="From"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.currentTarget.value)}
            />
            <TextInput
              label="To"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.currentTarget.value)}
            />
          </>
        )}
      </Group>

      {reportType === "census" && <CensusReport />}
      {reportType === "occupancy" && <OccupancyReport from={fromDate} to={toDate} />}
      {reportType === "alos" && <AlosReport from={fromDate} to={toDate} />}
      {reportType === "discharge-stats" && <DischargeStatsReport from={fromDate} to={toDate} />}
      {reportType === "surgeon-caseload" && <SurgeonCaseloadReport from={fromDate} to={toDate} />}
      {reportType === "anesthesia-complications" && (
        <AnesthesiaComplicationsReport from={fromDate} to={toDate} />
      )}
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  IPD Phase 2b — Clinical Docs
// ══════════════════════════════════════════════════════════
