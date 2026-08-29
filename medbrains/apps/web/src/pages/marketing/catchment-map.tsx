import { Box, Stack, Text } from "@mantine/core";
import type { MarketingDistributionResult } from "@medbrains/types";
import { ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { type EChartsType, init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useMemo, useRef } from "react";

use([ScatterChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

/**
 * The catchment, drawn.
 *
 * Localities are plotted at their own coordinates, sized by the enquiries a
 * run produced and coloured by how many of those became patients. Two runs of
 * equal size in different wards look identical in a table and obviously
 * different here, which is the whole reason to draw it.
 *
 * A plain coordinate plot rather than a tile map: echarts is already a
 * dependency, a basemap is not, and street detail answers no question the
 * hospital is asking. What matters is which localities respond and which do
 * not, and relative position carries that. A real basemap can be layered later
 * without changing this data shape.
 *
 * Runs with no coordinates are excluded and counted beneath, rather than being
 * silently dropped or stacked at the origin — a locality plotted at (0, 0) is
 * in the Gulf of Guinea.
 */
export function CatchmentMap({ runs }: { runs: MarketingDistributionResult[] }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);

  // Memoised: a fresh array every render would re-fire the effect below on
  // every parent update, redrawing a chart whose data has not changed.
  const plotted = useMemo(
    () => runs.filter((r) => r.latitude !== null && r.longitude !== null),
    [runs],
  );
  const missing = runs.length - plotted.length;

  // External system, so an effect is correct here — this is the exception the
  // repo's useEffect policy names, not an escape from it.
  useEffect(() => {
    if (!container.current) return;
    chart.current ??= init(container.current);
    const instance = chart.current;

    const points = plotted.map((r) => ({
      value: [
        Number(r.longitude),
        Number(r.latitude),
        r.enquiries,
        r.enquiries > 0 ? (r.converted / r.enquiries) * 100 : 0,
      ],
      name: r.area_name,
      run: r,
    }));

    instance.setOption(
      {
        tooltip: {
          trigger: "item",
          formatter: (p: { data: { name: string; run: MarketingDistributionResult } }) => {
            const r = p.data.run;
            const net = r.enquiries - r.baseline_enquiries;
            return [
              `<strong>${p.data.name}</strong>`,
              `${r.quantity.toLocaleString("en-IN")} ${r.channel}`,
              `${r.enquiries} enquiries · ${r.converted} became patients`,
              `Baseline ${r.baseline_enquiries} — net ${net >= 0 ? "+" : ""}${net}`,
            ].join("<br/>");
          },
        },
        grid: { left: 48, right: 24, top: 24, bottom: 40 },
        xAxis: { name: "Longitude", scale: true, nameLocation: "middle", nameGap: 26 },
        yAxis: { name: "Latitude", scale: true, nameLocation: "middle", nameGap: 40 },
        visualMap: {
          min: 0,
          max: 100,
          dimension: 3,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          text: ["High conversion", "Low"],
          // Sequential, colour-blind-safe, and the legend is labelled — the
          // dataviz rules forbid meaning carried by colour alone.
          inRange: { color: ["#d0e2ff", "#4589ff", "#0043ce"] },
        },
        series: [
          {
            type: "scatter",
            data: points,
            symbolSize: (v: number[]) => Math.max(12, Math.sqrt(v[2] ?? 0) * 6),
            emphasis: { focus: "series" },
          },
        ],
      },
      true,
    );

    const resize = () => instance.resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [plotted]);

  // Disposed separately from the option effect so a data change does not tear
  // the chart down and rebuild it.
  useEffect(
    () => () => {
      chart.current?.dispose();
      chart.current = null;
    },
    [],
  );

  if (plotted.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No locality on these runs has coordinates yet. Add a latitude and longitude to a locality
        and its runs appear on the map.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      <Box ref={container} w="100%" h={360} />
      {missing > 0 && (
        <Text size="xs" c="dimmed">
          {missing} {missing === 1 ? "run is" : "runs are"} not shown — their locality has no
          coordinates.
        </Text>
      )}
    </Stack>
  );
}
