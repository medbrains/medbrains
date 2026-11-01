/**
 * One station on the metro map: a round marker sitting on the line (a
 * diamond for a junction), its name in body text, what kind of stop it is in
 * words with a glyph, and — when known — how many patients are there now.
 */
import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import type { FlowStation } from "@medbrains/types";
import {
  IconArrowsSplit,
  IconBolt,
  IconCircleFilled,
  IconFlag,
  IconLock,
  IconPlus,
  IconTrafficLights,
  IconUserCheck,
} from "@tabler/icons-react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Badge, IconButton, ThemeIcon } from "@/components/ui";
import { METRO } from "./metro";
import styles from "./metro-map.module.scss";

/** The builder's controls on a station, when the map is editable. */
export interface StationEdit {
  selected: boolean;
  onSelect: () => void;
  /** Opens the block catalogue to place a block right after this station. */
  onInsertAfter: () => void;
}

export interface StationNodeData {
  station: FlowStation;
  onRoute: boolean;
  highlighted: boolean;
  /** Words on the highlight badge ("Changes", "Check fails", "Here now"). */
  highlightLabel: string;
  width: number;
  /** Patients at this station now, when the control room has been loaded. */
  count?: number;
  edit?: StationEdit;
  [key: string]: unknown;
}

/** What the stop is, in words with its glyph — never colour alone. */
function kindOf(station: FlowStation) {
  if (station.locked) return { Icon: IconLock, text: "Required" };
  switch (station.kind.type) {
    case "switch":
      return { Icon: IconArrowsSplit, text: "Junction" };
    case "task":
      return { Icon: IconUserCheck, text: "Task" };
    case "action":
      return { Icon: IconBolt, text: "Automatic" };
    case "end":
      return { Icon: IconFlag, text: "End of line" };
    default:
      return { Icon: IconTrafficLights, text: "Signal" };
  }
}

// Both handles sit on the marker's centre, so every line meets the station
// exactly where it is drawn, whatever the label below it.
const HANDLE_STYLE = { top: METRO.marker / 2, left: "50%" };

export function StationNode({ data }: NodeProps) {
  const { station, onRoute, highlighted, highlightLabel, width, count, edit } =
    data as StationNodeData;
  const { Icon, text } = kindOf(station);
  const junction = station.kind.type === "switch";
  return (
    <Stack gap={4} align="center" w={width}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        style={HANDLE_STYLE}
      />
      <ThemeIcon
        radius={junction ? 0 : METRO.marker}
        size={METRO.marker}
        variant={onRoute ? "filled" : "default"}
        tone={highlighted ? "accent" : onRoute ? "primary" : "neutral"}
        className={junction ? styles.diamond : undefined}
        aria-hidden
      >
        {!junction && <IconCircleFilled size={8} aria-hidden />}
      </ThemeIcon>
      {edit ? (
        <UnstyledButton
          className={`nodrag ${styles.stationName}`}
          onClick={edit.onSelect}
          aria-pressed={edit.selected}
          aria-label={`${station.name}: edit this station`}
        >
          <Text
            size="sm"
            fw={edit.selected ? 800 : 600}
            ta="center"
            lineClamp={2}
            td={edit.selected ? "underline" : undefined}
          >
            {station.name}
          </Text>
        </UnstyledButton>
      ) : (
        <Text size="sm" fw={600} ta="center" lineClamp={2} c={onRoute ? undefined : "dimmed"}>
          {station.name}
        </Text>
      )}
      <Group gap={4} wrap="nowrap" c="dimmed">
        <Icon size={16} aria-hidden />
        <Text size="xs">{text}</Text>
      </Group>
      {station.lane && (
        <Text size="xs" c="dimmed" ta="center">
          {station.lane} branch
        </Text>
      )}
      {!onRoute && (
        <Text size="xs" c="dimmed">
          Not on route
        </Text>
      )}
      {count !== undefined && count > 0 && <Badge tone="info">{count} here now</Badge>}
      {highlighted && <Badge tone="accent">{highlightLabel}</Badge>}
      {edit && station.kind.type !== "end" && (
        <IconButton
          className={`nodrag ${styles.insert}`}
          size="md"
          tone="primary"
          aria-label={`Add a station after ${station.name}`}
          onClick={edit.onInsertAfter}
        >
          <IconPlus size={16} aria-hidden />
        </IconButton>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        style={HANDLE_STYLE}
      />
    </Stack>
  );
}
