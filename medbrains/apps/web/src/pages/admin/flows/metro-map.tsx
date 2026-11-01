/**
 * The track drawn as a metro map (RFC §5.1): computed layout, the active
 * route solid, routes not taken dotted, a proposed change's old route as a
 * ghost line, and a list view as the text alternative. Route changes fade in;
 * with reduced motion the map simply redraws (metro-map.module.scss).
 */
import { Box, Group, List, Stack, Text } from "@mantine/core";
import type { FlowStation, FlowSwitches } from "@medbrains/types";
import { type Edge, type Node, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui";
import { type LineKind, layoutMetro, metroLines, onRoute } from "./metro";
import styles from "./metro-map.module.scss";
import { StationNode } from "./station-node";

const COLUMN = 130;
const LANE = 110;
const NODE_TYPES = { station: StationNode };

const LINE_STYLE: Record<LineKind, React.CSSProperties> = {
  active: { stroke: "var(--mb-interactive)", strokeWidth: 3 },
  idle: { stroke: "var(--mb-border)", strokeWidth: 2, strokeDasharray: "2 6" },
  ghost: { stroke: "var(--mb-text-faint)", strokeWidth: 2, strokeDasharray: "8 6", opacity: 0.7 },
};

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
}

function RouteList({
  stations,
  switches,
  ghost,
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
}: MetroMapProps) {
  const [view, setView] = useState<"map" | "list">("map");
  const nodes: Node[] = useMemo(
    () =>
      layoutMetro(stations).map((p, i) => {
        const station = stations[i] as FlowStation;
        return {
          id: p.key,
          type: "station",
          position: { x: p.column * COLUMN, y: p.lane * LANE },
          data: { station, onRoute: onRoute(station, switches), highlighted: highlight.has(p.key) },
          draggable: false,
          selectable: false,
        };
      }),
    [stations, switches, highlight],
  );
  const edges: Edge[] = useMemo(() => {
    const lane = new Map(layoutMetro(stations).map((p) => [p.key, p.lane]));
    return metroLines(stations, switches, ghost).map((l) => ({
      id: `${l.from}>${l.to}:${l.kind}`,
      source: l.from,
      target: l.to,
      // Along a lane the line is straight; it bends only to change lanes.
      type: lane.get(l.from) === lane.get(l.to) ? "straight" : "smoothstep",
      style: LINE_STYLE[l.kind],
      zIndex: l.kind === "ghost" ? 0 : 1,
    }));
  }, [stations, switches, ghost]);

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Solid: the route. Dotted: a route not taken.
          {ghost ? " Faint dashes: the route before this change." : ""}
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
          role="img"
          aria-label="Metro map of the flow; use List view for the same route as text"
        >
          <ReactFlow
            key={fitKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            proOptions={{ hideAttribution: true }}
          />
        </Box>
      ) : (
        <RouteList stations={stations} switches={switches} ghost={ghost} />
      )}
    </Stack>
  );
}
