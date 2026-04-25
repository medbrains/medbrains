import { ActionIcon, Badge, Text, Tooltip } from "@mantine/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconCopy,
  IconGripVertical,
  IconTrash,
} from "@tabler/icons-react";
import type { ZoneNode } from "@medbrains/stores";
import { useScreenBuilderStore } from "@medbrains/stores";
import classes from "./screen-builder.module.scss";

const ZONE_TYPE_COLORS: Record<string, string> = {
  form: "primary",
  data_table: "violet",
  filter_bar: "orange",
  detail_header: "info",
  tabs: "primary",
  stepper: "violet",
  calendar: "teal",
  kanban: "lime",
  widget_grid: "danger",
  info_panel: "slate",
};

export function ZoneCard({ zone, isLocked }: { zone: ZoneNode; isLocked: boolean }) {
  const selectedItemId = useScreenBuilderStore((s) => s.selectedItemId);
  const selectItem = useScreenBuilderStore((s) => s.selectItem);
  const removeZone = useScreenBuilderStore((s) => s.removeZone);
  const duplicateZone = useScreenBuilderStore((s) => s.duplicateZone);
  const isSelected = selectedItemId === zone.clientId;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: zone.clientId,
    data: { type: "zone", zone },
    disabled: isLocked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const color = ZONE_TYPE_COLORS[zone.type] ?? "slate";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${classes.zoneCard} ${isSelected ? classes.zoneCardSelected : ""} ${isDragging ? classes.zoneCardDragging : ""}`}
      onClick={() => selectItem(zone.clientId, "zone")}
    >
      {!isLocked && (
        <div className={classes.zoneDragHandle} {...attributes} {...listeners}>
          <IconGripVertical size={16} />
        </div>
      )}

      <Badge size="xs" color={color} variant="light">
        {zone.type}
      </Badge>

      <div className={classes.zoneCardInfo}>
        <div className={classes.zoneCardLabel}>{zone.label}</div>
        <div className={classes.zoneCardMeta}>
          <Text size="xs" c="dimmed">
            {zone.key}
          </Text>
        </div>
      </div>

      {!isLocked && (
        <div className={classes.zoneCardActions}>
          <Tooltip label="Duplicate">
            <ActionIcon
              variant="subtle"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                duplicateZone(zone.clientId);
              }}
              aria-label="Copy"
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="danger"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                removeZone(zone.clientId);
              }}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
