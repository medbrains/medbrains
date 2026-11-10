/**
 * FloorMap — a floor of the building as a schematic grid of zones, each
 * shaded by a 0-4 band and labelled with its name, its number and its band
 * word, so colour never carries the meaning alone (WCAG 1.4.1). Queues show as
 * a row of dots at the zone's foot (one per person waiting, ten at most, then
 * "+n"); a zone over its limit gets the alarm edge, an unknown one a dashed
 * edge and "Unknown".
 *
 * Rendered by echarts (allowed where @mantine/charts has no mark: a floor map
 * is not a chart). No animation, so reduced motion needs nothing removed; one
 * canvas, redrawn only when its data changes, disposed on unmount — inside the
 * TV board's memory budget. Colours come only from `--mb-flow-*` theme tokens
 * and are re-read when the colour scheme changes.
 *
 * The canvas is `aria-hidden`; the host is `role="img"` with `summary` as its
 * name. The keyboard surface is the table alternative beside it, never the
 * canvas.
 *
 * ponytail: schematic grid, not an isometric 3D floor or a drawn floor plan;
 * `three` (AnatomyScene pattern) can replace the renderer behind these same
 * props when a pilot asks for the game view.
 */
import { Box, type BoxProps, useComputedColorScheme } from "@mantine/core";
import { CustomChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { type EChartsType, init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { forwardRef, useEffect, useRef } from "react";

use([CustomChart, GridComponent, CanvasRenderer]);

export interface FloorMapZone {
  id: string;
  name: string;
  row: number;
  col: number;
  /** 0 (quiet) to 4 (over limit); `null` is unknown. */
  band: number | null;
  bandLabel: string;
  metric: string;
  queue: number | null;
  staff: number | null;
}

export interface FloorMapProps extends BoxProps {
  zones: FloorMapZone[];
  /** The whole map in one sentence, for screen readers. */
  summary: string;
  selectedId?: string | null;
  onZoneSelect?: (id: string) => void;
  height?: number;
  /** Bigger type for a wall screen read from across a hall. */
  large?: boolean;
}

/** Dots drawn in a queue before it is written as "+n". */
const MAX_QUEUE_DOTS = 10;

interface Palette {
  bands: string[];
  alarm: string;
  queue: string;
  unknown: string;
  text: string;
  border: string;
  focus: string;
}

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim() || css.color;
  return {
    bands: [0, 1, 2, 3, 4].map((i) => v(`--mb-flow-density-${i}`)),
    alarm: v("--mb-flow-alarm"),
    queue: v("--mb-flow-queue"),
    unknown: v("--mb-flow-unknown"),
    text: v("--mb-text-primary"),
    border: v("--mb-border"),
    focus: v("--mb-border-focus"),
  };
}

interface RenderApi {
  value: (dim: number) => number;
  coord: (point: [number, number]) => [number, number];
}

function zoneShapes(
  z: FloorMapZone,
  rect: { x: number; y: number; w: number; h: number },
  ctx: {
    p: Palette;
    selected: boolean;
    font: number;
  },
) {
  const { p, font } = ctx;
  const unknown = z.band === null;
  const edge = ctx.selected ? p.focus : z.band === 4 ? p.alarm : p.border;
  const text = (t: string, y: number, size: number, weight = 400, x = rect.x + 10) => ({
    type: "text",
    style: {
      text: t,
      x,
      y,
      fill: p.text,
      verticalAlign: "top",
      font: `${weight} ${size}px Inter Tight, sans-serif`,
    },
  });
  const queue = Math.min(z.queue ?? 0, MAX_QUEUE_DOTS);
  const dots = Array.from({ length: queue }, (_, i) => ({
    type: "circle",
    shape: { cx: rect.x + 14 + i * (font * 0.9), cy: rect.y + rect.h - 14, r: font * 0.3 },
    style: { fill: p.queue },
  }));
  const more = (z.queue ?? 0) - queue;
  return [
    {
      type: "rect",
      shape: { x: rect.x, y: rect.y, width: rect.w, height: rect.h },
      style: {
        fill: unknown ? p.unknown : p.bands[z.band ?? 0],
        stroke: edge,
        lineWidth: ctx.selected ? 4 : z.band === 4 ? 3 : 1,
        lineDash: unknown ? [6, 4] : undefined,
      },
    },
    text(z.name, rect.y + 8, font + 2, 600),
    text(z.metric, rect.y + 14 + font + 2, font),
    text(z.band === 4 ? `! ${z.bandLabel}` : z.bandLabel, rect.y + 20 + 2 * (font + 2), font, 600),
    ...(z.staff === null ? [] : [text(`Staff ${z.staff}`, rect.y + 26 + 3 * (font + 2), font - 1)]),
    ...dots,
    ...(more > 0
      ? [
          text(
            `+${more}`,
            rect.y + rect.h - 14 - font / 2,
            font - 1,
            600,
            rect.x + 14 + queue * (font * 0.9),
          ),
        ]
      : []),
  ];
}

export const FloorMap = forwardRef<HTMLDivElement, FloorMapProps>(function FloorMap(
  { zones, summary, selectedId = null, onZoneSelect, height = 420, large = false, ...rest },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const select = useRef(onZoneSelect);
  select.current = onZoneSelect;
  const scheme = useComputedColorScheme("dark");

  // External system (a canvas library): the repo's useEffect exception.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `scheme` re-reads the theme tokens when the colour scheme switches.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    chart.current ??= init(el, undefined, { renderer: "canvas" });
    const instance = chart.current;
    const palette = readPalette(el);
    const rows = Math.max(1, ...zones.map((z) => z.row));
    const cols = Math.max(1, ...zones.map((z) => z.col));
    const font = large ? 20 : 13;
    instance.setOption(
      {
        animation: false,
        aria: { enabled: false },
        grid: { left: 4, right: 4, top: 4, bottom: 4 },
        xAxis: { type: "value", min: 0.5, max: cols + 0.5, show: false },
        yAxis: { type: "value", min: 0.5, max: rows + 0.5, inverse: true, show: false },
        series: [
          {
            type: "custom",
            data: zones.map((z, i) => [z.col, z.row, i]),
            renderItem: (_: unknown, chartApi: RenderApi) => {
              const z = zones[chartApi.value(2)];
              if (!z) return null;
              const [x0, y0] = chartApi.coord([z.col - 0.47, z.row - 0.46]);
              const [x1, y1] = chartApi.coord([z.col + 0.47, z.row + 0.46]);
              const rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
              const selected = z.id === selectedId;
              return {
                type: "group",
                children: zoneShapes(z, rect, { p: palette, selected, font }),
              };
            },
          },
        ],
      },
      true,
    );
    instance.off("click");
    instance.on("click", (e) => {
      const z = zones[(e as { dataIndex: number }).dataIndex];
      if (z) select.current?.(z.id);
    });
  }, [zones, selectedId, large, scheme]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  return (
    <Box ref={ref} {...rest} role="img" aria-label={summary}>
      <Box ref={host} h={height} w="100%" aria-hidden="true" />
    </Box>
  );
});
