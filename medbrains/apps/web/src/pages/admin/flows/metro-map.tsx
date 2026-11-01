/**
 * The track drawn as a metro map (RFC §5.1): computed layout, the active
 * route solid, routes not taken dotted, a proposed change's old route as a
 * ghost line, and a list view as the text alternative. Route changes fade in;
 * with reduced motion the map simply redraws (metro-map.module.scss).
 * Call path: switchboard → layoutMetro + metroLines (metro.ts) → React Flow
 * nodes (station-node.tsx) and smoothstep edges.
 */
import { Box, Group, List, Stack, Text, useComputedColorScheme } from "@mantine/core";
import type { FlowStation, FlowSwitches } from "@medbrains/types";
import { Controls, type Edge, type Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui";
import {
  bendAt,
  type LineKind,
  layoutMetro,
  METRO,
  metroLines,
  onRoute,
  type Placement,
} from "./metro";
import styles from "./metro-map.module.scss";
import { StationNode, type StationNodeData } from "./station-node";

const NODE_TYPES = { station: StationNode };

const LINE_STYLE: Record<LineKind, React.CSSProperties> = {
  active: { stroke: "var(--mb-interactive)", strokeWidth: 6, strokeLinecap: "round" },
  idle: {
    stroke: "var(--mb-outline)",
    strokeWidth: 3,
    strokeDasharray: "1 9",
    strokeLinecap: "round",
  },
  // Offset a little so the old route shows beside the new one, not under it.
  ghost: {
    stroke: "var(--mb-text-faint)",
    strokeWidth: 3,
    strokeDasharray: "10 8",
    transform: "translateY(5px)",
  },
};
/** Painted bottom to top: the live route always on top. */
const PAINT_ORDER: Record<LineKind, number> = { ghost: 0, idle: 1, active: 2 };

export interface MetroMapProps {
  stations: FlowStation[];
  switches: FlowSwitches;
  /** The route before a proposed change, drawn as a ghost. */
  ghost: FlowSwitches | null;
  highlight: ReadonlySet<string>;
  /** Text announced politely when the route changes. */
  announcement: string;
  /** Changes when the map's width changes, so it fits again. */
  fitKey?: string;
  /** Patients at each station now, when the control room has been loaded. */
  counts?: ReadonlyMap<string, number>;
  /** The counts could not be loaded — say so, never show an empty line. */
  countsError?: boolean;
}

function RouteList({
  stations,
  switches,
  ghost,
  counts,
}: Omit<MetroMapProps, "highlight" | "announcement">) {
  return (
    <List type="ordered" spacing="xs" aria-label="Route, step by step">
      {stations.map((s) => {
        const now = onRoute(s, switches);
        const was = ghost ? onRoute(s, ghost) : now;
        const change =
          now === was ? "" : now ? " — added by this change" : " — removed by this change";
        return (
          <List.Item key={s.key}>
            <Text size="sm" fw={now ? 600 : 400} c={now ? undefined : "dimmed"}>
              {s.name} ({s.stage}) — {now ? "on the route" : "not on the route"}
              {s.lane ? `, ${s.lane.toLowerCase()} branch` : ""}
              {s.locked ? `, always on: ${s.required_by ?? "required"}` : ""}
              {s.kind.type === "signal" ? `, held by ${s.holder.toLowerCase()}` : ""}
              {counts?.get(s.key) ? `, ${counts.get(s.key)} patients here now` : ""}
              {change}
            </Text>
          </List.Item>
        );
      })}
    </List>
  );
}

export function MetroMap({
  stations,
  switches,
  ghost,
  highlight,
  announcement,
  fitKey,
  counts,
  countsError,
}: MetroMapProps) {
  const [view, setView] = useState<"map" | "list">("map");
  const colorMode = useComputedColorScheme("dark");
  const placed = useMemo(() => layoutMetro(stations), [stations]);
  const nodes: Node[] = useMemo(
    () =>
      placed.map((p, i) => {
        const station = stations[i] as FlowStation;
        const data: StationNodeData = {
          station,
          onRoute: onRoute(station, switches),
          highlighted: highlight.has(p.key),
          width: p.width,
          count: counts?.get(p.key),
        };
        return {
          id: p.key,
          type: "station",
          // The marker's centre sits on (x, y); the node box hangs below it.
          position: { x: p.x - p.width / 2, y: p.y - METRO.marker / 2 },
          data,
          draggable: false,
          selectable: false,
        };
      }),
    [placed, stations, switches, highlight, counts],
  );
  const edges: Edge[] = useMemo(() => {
    const at = new Map(placed.map((p) => [p.key, p]));
    return metroLines(stations, switches, ghost)
      .sort((a, b) => PAINT_ORDER[a.kind] - PAINT_ORDER[b.kind])
      .map((l) => {
        const from = at.get(l.from) as Placement;
        const to = at.get(l.to) as Placement;
        return {
          id: `${l.from}>${l.to}:${l.kind}`,
          source: l.from,
          target: l.to,
          // Straight along a lane; a rounded bend in the gap between labels
          // to change lanes, so a branch runs the length of its own lane.
          type: from.lane === to.lane ? "straight" : "smoothstep",
          pathOptions: { borderRadius: 16, stepPosition: bendAt(from, to) },
          style: LINE_STYLE[l.kind],
        };
      });
  }, [placed, stations, switches, ghost]);
  const lanes = Math.max(0, ...placed.map((p) => p.lane));

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Solid: the route. Dotted: a route not taken.
          {ghost ? " Faint dashes: the route before this change." : ""}
          {countsError ? " Patient counts could not be loaded." : ""}
        </Text>
        <SegmentedControl
          aria-label="Show the track as"
          value={view}
          onChange={(v) => setView(v as "map" | "list")}
          data={[
            { value: "map", label: "Map" },
            { value: "list", label: "List view" },
          ]}
        />
      </Group>
      <Text size="sm" aria-live="polite" role="status">
        {announcement}
      </Text>
      {view === "map" ? (
        <Box
          className={styles.canvas}
          h={METRO.laneHeight * lanes + 190}
          role="group"
          aria-label="Metro map of the flow; use List view for the same route as text"
        >
          <ReactFlow
            key={fitKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            colorMode={colorMode}
            style={{ background: "transparent" }}
            fitView
            fitViewOptions={{ padding: 0.04, maxZoom: 1 }}
            minZoom={0.4}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} position="top-right" />
          </ReactFlow>
        </Box>
      ) : (
        <RouteList stations={stations} switches={switches} ghost={ghost} counts={counts} />
      )}
    </Stack>
  );
}
