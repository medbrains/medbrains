import { ActionIcon, Badge, Group, Text, Tooltip } from "@mantine/core";
import { useFormBuilderStore, colSpanToPercent } from "@medbrains/stores";
import type { FormBuilderFieldNode } from "@medbrains/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconGripVertical,
  IconCalendar,
  IconHash,
  IconInfoCircle,
  IconLetterCase,
  IconMail,
  IconPhone,
  IconSelect,
  IconToggleLeft,
  IconUpload,
  IconCode,
  IconListCheck,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import classes from "./form-builder.module.scss";

const DATA_TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <IconLetterCase size={14} />,
  email: <IconMail size={14} />,
  phone: <IconPhone size={14} />,
  date: <IconCalendar size={14} />,
  datetime: <IconCalendar size={14} />,
  time: <IconCalendar size={14} />,
  number: <IconHash size={14} />,
  decimal: <IconHash size={14} />,
  select: <IconSelect size={14} />,
  multiselect: <IconListCheck size={14} />,
  radio: <IconSelect size={14} />,
  checkbox: <IconToggleLeft size={14} />,
  boolean: <IconToggleLeft size={14} />,
  textarea: <IconLetterCase size={14} />,
  file: <IconUpload size={14} />,
  computed: <IconCode size={14} />,
  hidden: <IconCode size={14} />,
  uuid_fk: <IconCode size={14} />,
  json: <IconCode size={14} />,
};

const REQUIREMENT_COLORS: Record<string, string> = {
  mandatory: "danger",
  conditional: "warning",
  recommended: "primary",
  optional: "slate",
};

interface SortableFieldProps {
  field: FormBuilderFieldNode;
  sectionId: string;
}

export function SortableField({ field, sectionId }: SortableFieldProps) {
  const selectedNodeId = useFormBuilderStore((s) => s.selectedNodeId);
  const selectNode = useFormBuilderStore((s) => s.selectNode);
  const resizeField = useFormBuilderStore((s) => s.resizeField);
  const removeField = useFormBuilderStore((s) => s.removeField);

  const isSelected = selectedNodeId === field.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: { type: "field", sectionId, field },
  });

  // ── Resize Logic ──────────────────────────────────────

  const [isResizing, setIsResizing] = useState(false);
  const [previewPercent, setPreviewPercent] = useState<number | null>(null);
  const resizeRef = useRef<{
    startX: number;
    containerWidth: number;
    startPercent: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const fieldCard = (e.target as HTMLElement).closest(
        `.${classes.fieldCard}`,
      );
      const container = fieldCard?.parentElement;
      if (!container) return;

      const startPercent = colSpanToPercent(field.colSpan);
      resizeRef.current = {
        startX: e.clientX,
        containerWidth: container.clientWidth,
        startPercent,
      };
      setIsResizing(true);
      setPreviewPercent(startPercent);

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        if (!resizeRef.current) return;
        const deltaX = moveEvent.clientX - resizeRef.current.startX;
        const deltaPercent =
          (deltaX / resizeRef.current.containerWidth) * 100;
        const newPercent = Math.max(
          (1 / 12) * 100,
          Math.min(100, resizeRef.current.startPercent + deltaPercent),
        );
        setPreviewPercent(newPercent);
      };

      const handleMouseUp = (upEvent: globalThis.MouseEvent) => {
        if (!resizeRef.current) return;

        const deltaX = upEvent.clientX - resizeRef.current.startX;
        const deltaPercent =
          (deltaX / resizeRef.current.containerWidth) * 100;
        const newPercent = resizeRef.current.startPercent + deltaPercent;

        resizeField(field.id, newPercent);
        resizeRef.current = null;
        setIsResizing(false);
        setPreviewPercent(null);

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [field.id, field.colSpan, resizeField],
  );

  const requirementColor = REQUIREMENT_COLORS[field.requirementLevel] ?? "slate";

  // Build hint text for (i) icon tooltip
  const hintParts: string[] = [];
  if (field.helpText) hintParts.push(field.helpText);
  if (field.condition) hintParts.push("Conditional visibility");
  if (field.computedExpr) hintParts.push("Computed");
  if (field.regulatoryClauses.length > 0) {
    hintParts.push(field.regulatoryClauses.map((c) => c.body_code).join(", "));
  }
  if (field.dataSource && field.dataSource.type !== "static") {
    hintParts.push(`Source: ${field.dataSource.type}`);
  }
  if (field.actions.length > 0) {
    hintParts.push(`${field.actions.length} action(s)`);
  }
  const hasHint = hintParts.length > 0;

  // Compute width: use live preview during resize, otherwise use colSpan
  const widthPercent = isResizing && previewPercent !== null
    ? previewPercent
    : colSpanToPercent(field.colSpan);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isResizing
      ? transition
      : [transition, "width 200ms ease"].filter(Boolean).join(", "),
    width: `calc(${widthPercent}% - 8px)`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${classes.fieldCard} ${
        isSelected ? classes.fieldCardSelected : ""
      } ${isDragging ? classes.fieldCardDragging : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        selectNode(field.id);
      }}
      {...attributes}
    >
      {/* Drag handle */}
      <div className={classes.fieldDragHandle} {...listeners}>
        <IconGripVertical size={14} />
      </div>

      {/* Field icon */}
      {DATA_TYPE_ICONS[field.dataType] ?? <IconLetterCase size={14} />}

      {/* Field info */}
      <div className={classes.fieldInfo}>
        <Group gap={4} wrap="nowrap">
          <Text className={classes.fieldLabel}>{field.label}</Text>
          {hasHint && (
            <Tooltip
              label={hintParts.join(" \u2022 ")}
              multiline
              w={220}
              withArrow
              position="top"
              events={{ hover: true, focus: true, touch: true }}
            >
              <ActionIcon variant="transparent" size={14} color="dimmed" aria-label="Info">
                <IconInfoCircle size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        <div className={classes.fieldMeta}>
          <Badge size="xs" variant="light" color="slate">
            {field.dataType}
          </Badge>
          <Badge size="xs" variant="dot" color={requirementColor}>
            {field.requirementLevel}
          </Badge>
          <Badge size="xs" variant="outline" color="slate">
            {field.colSpan}/12
          </Badge>
        </div>
      </div>

      {/* Delete button */}
      <div className={classes.fieldActions}>
        <Tooltip label="Delete field">
          <ActionIcon
            size="xs"
            variant="subtle"
            color="danger"
            onClick={(e) => {
              e.stopPropagation();
              removeField(field.id);
            }}
            aria-label="Delete"
          >
            <IconTrash size={12} />
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Resize handle */}
      <div
        className={`${classes.resizeHandle} ${isResizing ? classes.resizeHandleActive : ""}`}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
