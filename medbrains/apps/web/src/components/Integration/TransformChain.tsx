import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconGitMerge, IconGripVertical, IconLink, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  MappingOperationConfig,
  MappingOperationType,
  TransformStep,
} from "@medbrains/types";
import { useCallback, useMemo } from "react";
import { OperationPicker } from "./OperationPicker";
import { StepConfigPopover } from "./StepConfigPopover";
import { getConfigSummary, getDescriptor } from "./operationRegistry";

let _chainSeq = 0;
function newStepId(): string {
  _chainSeq += 1;
  return `step_${Date.now()}_${_chainSeq}`;
}

interface TransformChainProps {
  chain: TransformStep[];
  onChange: (chain: TransformStep[]) => void;
  compact?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  string: "primary",
  array: "teal",
  number: "orange",
  date: "violet",
  conversion: "danger",
  merge: "primary",
};

export function TransformChain({
  chain,
  onChange,
  compact,
}: TransformChainProps) {
  const handleAddStep = useCallback(
    (type: MappingOperationType) => {
      const step: TransformStep = {
        id: newStepId(),
        operation: type,
        config: {},
      };
      onChange([...chain, step]);
    },
    [chain, onChange],
  );

  const handleUpdateConfig = useCallback(
    (stepId: string, config: MappingOperationConfig) => {
      onChange(
        chain.map((s) => (s.id === stepId ? { ...s, config } : s)),
      );
    },
    [chain, onChange],
  );

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      onChange(chain.filter((s) => s.id !== stepId));
    },
    [chain, onChange],
  );

  // ── Compact mode: horizontal badges ──
  if (compact) {
    const maxVisible = 3;
    const visible = chain.slice(0, maxVisible);
    const overflow = chain.length - maxVisible;

    return (
      <Group gap={4} wrap="nowrap">
        {visible.map((step) => {
          const desc = getDescriptor(step.operation);
          const color = CATEGORY_COLORS[desc?.category ?? ""] ?? "slate";
          const summary = getConfigSummary(
            step.operation,
            step.config as Record<string, unknown>,
          );

          return (
            <StepConfigPopover
              key={step.id}
              step={step}
              onUpdate={(cfg) => handleUpdateConfig(step.id, cfg)}
              onDelete={() => handleDeleteStep(step.id)}
            >
              <Tooltip label={desc?.description ?? step.operation} withArrow>
                <Badge
                  size="xs"
                  variant="light"
                  color={color}
                  style={{ cursor: "pointer" }}
                >
                  {desc?.label ?? step.operation}
                  {summary ? ` (${summary})` : ""}
                </Badge>
              </Tooltip>
            </StepConfigPopover>
          );
        })}
        {overflow > 0 && (
          <Badge size="xs" variant="light" color="slate">
            +{overflow}
          </Badge>
        )}
        <OperationPicker onSelect={handleAddStep}>
          <ActionIcon variant="subtle" color="primary" size="xs" aria-label="Add">
            <IconPlus size={12} />
          </ActionIcon>
        </OperationPicker>
        {chain.length === 0 && (
          <Text size="xs" c="dimmed">
            No transforms
          </Text>
        )}
      </Group>
    );
  }

  const handleInsertBefore = useCallback(
    (stepId: string, type: MappingOperationType) => {
      const idx = chain.findIndex((s) => s.id === stepId);
      if (idx === -1) return;
      const step: TransformStep = { id: newStepId(), operation: type, config: {} };
      const next = [...chain];
      next.splice(idx, 0, step);
      onChange(next);
    },
    [chain, onChange],
  );

  const handleInsertAfter = useCallback(
    (stepId: string, type: MappingOperationType) => {
      const idx = chain.findIndex((s) => s.id === stepId);
      if (idx === -1) return;
      const step: TransformStep = { id: newStepId(), operation: type, config: {} };
      const next = [...chain];
      next.splice(idx + 1, 0, step);
      onChange(next);
    },
    [chain, onChange],
  );

  const stepIds = useMemo(() => chain.map((s) => s.id), [chain]);

  const sortSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleSortEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = chain.findIndex((s) => s.id === active.id);
      const newIdx = chain.findIndex((s) => s.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        onChange(arrayMove(chain, oldIdx, newIdx));
      }
    },
    [chain, onChange],
  );

  // ── Full mode: vertical chain with drag-sort ──
  return (
    <DndContext sensors={sortSensors} collisionDetection={closestCenter} onDragEnd={handleSortEnd}>
      <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
        <Stack gap={0}>
          {chain.map((step, idx) => (
            <SortableStep
              key={step.id}
              step={step}
              index={idx}
              onUpdateConfig={handleUpdateConfig}
              onDelete={handleDeleteStep}
              onInsertBefore={handleInsertBefore}
              onInsertAfter={handleInsertAfter}
            />
          ))}

          {/* Connector to add-step */}
          {chain.length > 0 && (
            <Box
              style={{
                height: 16,
                width: 2,
                borderLeft: "2px dashed var(--mantine-color-gray-3)",
                marginLeft: 12,
              }}
            />
          )}

          <OperationPicker onSelect={handleAddStep}>
            <Badge
              size="sm"
              variant="light"
              color="primary"
              leftSection={<IconPlus size={10} />}
              style={{ cursor: "pointer" }}
            >
              Add Step
            </Badge>
          </OperationPicker>
        </Stack>
      </SortableContext>
    </DndContext>
  );
}

// ── Sortable Step ────────────────────────────────────────

function SortableStep({
  step,
  index,
  onUpdateConfig,
  onDelete,
  onInsertBefore,
  onInsertAfter,
}: {
  step: TransformStep;
  index: number;
  onUpdateConfig: (stepId: string, config: MappingOperationConfig) => void;
  onDelete: (stepId: string) => void;
  onInsertBefore: (stepId: string, type: MappingOperationType) => void;
  onInsertAfter: (stepId: string, type: MappingOperationType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const desc = getDescriptor(step.operation);
  const color = CATEGORY_COLORS[desc?.category ?? ""] ?? "slate";
  const summary = getConfigSummary(
    step.operation,
    step.config as Record<string, unknown>,
  );

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {/* Dashed connector (except first) */}
      {index > 0 && (
        <Box
          style={{
            height: 12,
            width: 2,
            borderLeft: "2px dashed var(--mantine-color-gray-3)",
            marginLeft: 12,
            position: "relative",
          }}
        >
          {/* Insert-before dot */}
          <OperationPicker onSelect={(type) => onInsertBefore(step.id, type)}>
            <Tooltip label="Insert step before" withArrow position="right">
              <ActionIcon
                variant="subtle"
                color="primary"
                size={14}
                style={{
                  position: "absolute",
                  left: -7,
                  top: 0,
                  opacity: 0.4,
                  transition: "opacity 150ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.4"; }}
                aria-label="Add"
              >
                <IconPlus size={10} />
              </ActionIcon>
            </Tooltip>
          </OperationPicker>
        </Box>
      )}
      <Paper
        p={6}
        withBorder
        style={{
          borderColor: `var(--mantine-color-${color}-3)`,
          background: `var(--mantine-color-${color}-0)`,
        }}
      >
        <Group gap="xs" wrap="nowrap" justify="space-between">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <Box {...attributes} {...listeners} style={{ cursor: "grab", display: "flex" }}>
              <IconGripVertical size={14} color="var(--mantine-color-gray-5)" />
            </Box>
            <Badge size="xs" variant="light" color={color}>
              {index + 1}
            </Badge>
            {step.operation === "merge_field" ? (
              <IconGitMerge size={14} color={`var(--mantine-color-${color}-6)`} />
            ) : (
              <IconLink size={14} color={`var(--mantine-color-${color}-6)`} />
            )}
            <Badge size="xs" variant="light" color={color}>
              {desc?.label ?? step.operation}
            </Badge>
            {step.operation === "merge_field" && step.config.mergeFieldPath && (
              <Badge size="xs" variant="dot" color="primary">
                {step.config.mergeFieldPath.split(".").pop() ?? step.config.mergeFieldPath}
              </Badge>
            )}
            {summary && step.operation !== "merge_field" && (
              <Text size="xs" c="dimmed" truncate>
                {summary}
              </Text>
            )}
          </Group>
          <Group gap={2} wrap="nowrap">
            <OperationPicker onSelect={(type) => onInsertAfter(step.id, type)}>
              <Tooltip label="Insert step after" withArrow>
                <ActionIcon variant="subtle" color="primary" size="xs" aria-label="Add">
                  <IconPlus size={12} />
                </ActionIcon>
              </Tooltip>
            </OperationPicker>
            <StepConfigPopover
              step={step}
              onUpdate={(cfg) => onUpdateConfig(step.id, cfg)}
              onDelete={() => onDelete(step.id)}
            >
              <ActionIcon variant="subtle" color="slate" size="xs" aria-label="Edit">
                <IconPencil size={12} />
              </ActionIcon>
            </StepConfigPopover>
            <ActionIcon
              variant="subtle"
              color="danger"
              size="xs"
              onClick={() => onDelete(step.id)}
              aria-label="Delete"
            >
              <IconTrash size={10} />
            </ActionIcon>
          </Group>
        </Group>
      </Paper>
    </Box>
  );
}
