/** One station on the metro map: a round marker, its name, and its signal post. */
import { Stack, Text } from "@mantine/core";
import type { FlowStation } from "@medbrains/types";
import {
  IconArrowsSplit,
  IconCircleFilled,
  IconFlag,
  IconLock,
  IconPlayerPlay,
  IconTrafficLights,
  IconUserCheck,
} from "@tabler/icons-react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Badge, ThemeIcon } from "@/components/ui";
import styles from "./metro-map.module.scss";

export interface StationNodeData {
  station: FlowStation;
  onRoute: boolean;
  highlighted: boolean;
  [key: string]: unknown;
}

function StationIcon({ station }: { station: FlowStation }) {
  if (station.locked) return <IconLock size={16} aria-hidden />;
  switch (station.kind.type) {
    case "signal":
      return <IconTrafficLights size={16} aria-hidden />;
    case "switch":
      return <IconArrowsSplit size={16} aria-hidden />;
    case "task":
      return <IconUserCheck size={16} aria-hidden />;
    case "action":
      return <IconPlayerPlay size={16} aria-hidden />;
    case "end":
      return <IconFlag size={16} aria-hidden />;
  }
  return <IconCircleFilled size={16} aria-hidden />;
}

/** What the marker means, in words — never colour alone. */
function caption(station: FlowStation, onRoute: boolean): string {
  if (station.locked) return "Required";
  if (!onRoute) return "Not on route";
  if (station.kind.type === "signal") return "Signal";
  if (station.kind.type === "switch") return "Junction";
  return station.lane ? `${station.lane} only` : "";
}

export function StationNode({ data }: NodeProps) {
  const { station, onRoute, highlighted } = data as StationNodeData;
  return (
    <Stack gap={4} align="center" className={styles.node}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <ThemeIcon
        radius="xl"
        size={32}
        variant={onRoute ? "filled" : "light"}
        tone={highlighted ? "accent" : station.locked ? "primary" : onRoute ? "primary" : "neutral"}
      >
        <StationIcon station={station} />
      </ThemeIcon>
      <Text size="xs" fw={600} className={styles.name} lineClamp={2}>
        {station.name}
      </Text>
      {caption(station, onRoute) && (
        <Text size="xs" c="dimmed" className={styles.name}>
          {caption(station, onRoute)}
        </Text>
      )}
      {highlighted && (
        <Badge tone="accent" size="xs">
          Changes
        </Badge>
      )}
      <Handle type="source" position={Position.Right} className={styles.handle} />
    </Stack>
  );
}
