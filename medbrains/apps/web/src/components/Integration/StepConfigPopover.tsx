import {
  ActionIcon,
  Badge,
  Group,
  Popover,
  Stack,
  Text,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import type { MappingOperationConfig, TransformStep } from "@medbrains/types";
import { useState, type ReactNode } from "react";
import { OperationConfig } from "./OperationConfig";
import { getDescriptor } from "./operationRegistry";

interface StepConfigPopoverProps {
  step: TransformStep;
  onUpdate: (config: MappingOperationConfig) => void;
  onDelete: () => void;
  children: ReactNode;
}

const CATEGORY_COLORS: Record<string, string> = {
  string: "primary",
  array: "teal",
  number: "orange",
  date: "violet",
  conversion: "danger",
};

export function StepConfigPopover({
  step,
  onUpdate,
  onDelete,
  children,
}: StepConfigPopoverProps) {
  const [opened, setOpened] = useState(false);
  const descriptor = getDescriptor(step.operation);
  const categoryColor = CATEGORY_COLORS[descriptor?.category ?? ""] ?? "slate";

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={280}
      position="bottom"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <span onClick={() => setOpened((v) => !v)} style={{ cursor: "pointer" }}>
          {children}
        </span>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={600}>
                {descriptor?.label ?? step.operation}
              </Text>
              <Badge size="xs" variant="light" color={categoryColor}>
                {descriptor?.category ?? ""}
              </Badge>
            </Group>
            <ActionIcon
              variant="subtle"
              color="danger"
              size="xs"
              onClick={() => {
                onDelete();
                setOpened(false);
              }}
              aria-label="Delete"
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>

          {descriptor?.description && (
            <Text size="xs" c="dimmed">
              {descriptor.description}
            </Text>
          )}

          {descriptor?.hasConfig && (
            <OperationConfig
              operation={step.operation}
              config={step.config}
              onChange={onUpdate}
            />
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
