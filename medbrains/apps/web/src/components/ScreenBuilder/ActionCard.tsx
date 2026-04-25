import { ActionIcon, Badge, Text, Tooltip } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { ActionNode } from "@medbrains/stores";
import { useScreenBuilderStore } from "@medbrains/stores";
import classes from "./screen-builder.module.scss";

export function ActionCard({ action, isLocked }: { action: ActionNode; isLocked: boolean }) {
  const selectedItemId = useScreenBuilderStore((s) => s.selectedItemId);
  const selectItem = useScreenBuilderStore((s) => s.selectItem);
  const removeAction = useScreenBuilderStore((s) => s.removeAction);
  const isSelected = selectedItemId === action.clientId;

  return (
    <div
      className={`${classes.actionCard} ${isSelected ? classes.actionCardSelected : ""}`}
      onClick={() => selectItem(action.clientId, "action")}
    >
      <Badge size="xs" variant="light" color="violet">
        {action.action_type}
      </Badge>

      <div className={classes.actionCardInfo}>
        <Text size="sm" fw={500} truncate>
          {action.label}
        </Text>
        {action.permission && (
          <Text size="xs" c="dimmed" truncate>
            {action.permission}
          </Text>
        )}
      </div>

      {!isLocked && (
        <div className={classes.actionCardActions}>
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="danger"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                removeAction(action.clientId);
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
