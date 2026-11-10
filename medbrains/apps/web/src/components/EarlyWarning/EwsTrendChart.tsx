// The score over time, read against the tool's urgent and emergency lines —
// a NEWS2 of 4 means one thing rising from 1 and another falling from 8.

import { LineChart } from "@mantine/charts";
import { Stack, Text } from "@mantine/core";
import type { EwsTool, ScoredVital } from "@medbrains/types";
import { useMemo } from "react";
import { EWS_TOOL_LABEL, ewsReferenceLines, ewsTotalText } from "./ews-display";

export function EwsTrendChart({ vitals }: { vitals: ScoredVital[] }) {
  const { points, tool } = useMemo(() => {
    const scored = vitals
      .filter((v) => v.ews_total != null && v.ews_tool != null)
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .slice(-24);
    return {
      tool: (scored.at(-1)?.ews_tool ?? null) as EwsTool | null,
      points: scored.map((v) => ({
        time: new Date(v.recorded_at).toLocaleString([], {
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        score: v.ews_total ?? 0,
        label: ewsTotalText(v.ews_total ?? 0, Boolean(v.ews_incomplete)),
      })),
    };
  }, [vitals]);
  if (!tool || points.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No scored readings yet.
      </Text>
    );
  }
  const summary = points.map((p) => `${p.time}: ${p.label}`).join("; ");
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        {EWS_TOOL_LABEL[tool]} trend
      </Text>
      <LineChart
        h={180}
        data={points}
        dataKey="time"
        series={[{ name: "score", label: EWS_TOOL_LABEL[tool], color: "primary.6" }]}
        yAxisProps={{ domain: [0, "auto"], allowDecimals: false }}
        referenceLines={ewsReferenceLines(tool).map((l) => ({
          y: l.y,
          label: l.label,
          color: "gray.6",
          strokeDasharray: "4 4",
        }))}
        curveType="linear"
        aria-label={`${EWS_TOOL_LABEL[tool]} scores over time`}
      />
      <Text size="xs" c="dimmed">
        {summary}
      </Text>
    </Stack>
  );
}
