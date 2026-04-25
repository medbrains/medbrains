import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ActionIcon,
  Badge,
  Button,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useFormBuilderStore } from "@medbrains/stores";
import {
  IconCheck,
  IconGripVertical,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";
import { SortableField } from "./SortableField";
import classes from "./form-builder.module.scss";

// ── Sortable Section Wrapper ────────────────────────────

interface SortableSectionProps {
  sectionId: string;
  children: React.ReactNode;
  isLocked?: boolean;
}

function SortableSection({ sectionId, children, isLocked = false }: SortableSectionProps) {
  const section = useFormBuilderStore((s) => s.sections[sectionId]);
  const selectedNodeId = useFormBuilderStore((s) => s.selectedNodeId);
  const selectNode = useFormBuilderStore((s) => s.selectNode);
  const removeSection = useFormBuilderStore((s) => s.removeSection);
  const updateSection = useFormBuilderStore((s) => s.updateSection);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: sectionId,
    data: { type: "section" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const startEditing = useCallback(() => {
    if (!section) return;
    setEditName(section.name);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [section]);

  const commitName = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== section?.name) {
      updateSection(sectionId, { name: trimmed });
    }
    setIsEditing(false);
  }, [editName, section?.name, sectionId, updateSection]);

  if (!section) return null;

  const isSelected = selectedNodeId === sectionId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${classes.section} ${isSelected ? classes.sectionSelected : ""}`}
      {...attributes}
    >
      <div
        className={classes.sectionHeader}
        onClick={(e) => {
          e.stopPropagation();
          selectNode(sectionId);
        }}
      >
        {!isLocked && (
          <div className={classes.sectionDragHandle} {...listeners}>
            <IconGripVertical size={14} />
          </div>
        )}

        {isEditing && !isLocked ? (
          <TextInput
            ref={inputRef}
            size="xs"
            variant="unstyled"
            value={editName}
            onChange={(e) => setEditName(e.currentTarget.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            classNames={{ input: classes.sectionNameInput }}
            autoFocus
            rightSection={
              <ActionIcon size="xs" variant="subtle" color="primary" onClick={commitName} aria-label="Confirm">
                <IconCheck size={12} />
              </ActionIcon>
            }
          />
        ) : (
          <Text
            className={classes.sectionName}
            onDoubleClick={isLocked ? undefined : (e) => {
              e.stopPropagation();
              startEditing();
            }}
            title={isLocked ? section.name : "Double-click to rename"}
          >
            {section.name}
          </Text>
        )}

        <Badge size="xs" variant="light" color="slate">
          {section.layout}
        </Badge>
        {!isLocked && (
          <div className={classes.sectionActions}>
            <Tooltip label="Delete section">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSection(sectionId);
                }}
                aria-label="Delete"
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Tooltip>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Section Fields Grid ─────────────────────────────────

function SectionFieldsGrid({ sectionId }: { sectionId: string }) {
  const fieldIds = useFormBuilderStore(
    (s) => s.fieldOrder[sectionId] ?? [],
  );
  const fields = useFormBuilderStore((s) => s.fields);
  const dragState = useFormBuilderStore((s) => s.dragState);

  const isDragOver = dragState?.targetSectionId === sectionId;

  return (
    <SortableContext items={fieldIds} strategy={rectSortingStrategy}>
      <div
        className={`${classes.fieldGrid} ${isDragOver ? classes.fieldGridDragOver : ""} ${dragState ? "dragging" : ""}`}
      >
        {fieldIds.length === 0 ? (
          <div className={classes.fieldGridEmpty}>
            Drop fields here
          </div>
        ) : (
          fieldIds.map((fieldId) => {
            const field = fields[fieldId];
            if (!field) return null;
            return (
              <SortableField
                key={fieldId}
                field={field}
                sectionId={sectionId}
              />
            );
          })
        )}
      </div>
    </SortableContext>
  );
}

// ── Add Section with Name Prompt ────────────────────────

function AddSectionButton({ variant }: { variant: "empty" | "bottom" }) {
  const addSection = useFormBuilderStore((s) => s.addSection);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    setName("");
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleCommit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed) {
      addSection(trimmed);
    }
    setName("");
    setIsAdding(false);
  }, [name, addSection]);

  const handleCancel = useCallback(() => {
    setName("");
    setIsAdding(false);
  }, []);

  if (isAdding) {
    return (
      <div
        className={classes.addSectionInput}
        onClick={(e) => e.stopPropagation()}
      >
        <TextInput
          ref={inputRef}
          size="sm"
          placeholder="Enter section name..."
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommit();
            if (e.key === "Escape") handleCancel();
          }}
          onBlur={handleCancel}
          rightSection={
            <ActionIcon
              size="sm"
              variant="filled"
              color="primary"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur before click
                handleCommit();
              }}
              aria-label="Confirm"
            >
              <IconCheck size={14} />
            </ActionIcon>
          }
        />
      </div>
    );
  }

  if (variant === "empty") {
    return (
      <Button
        variant="light"
        leftSection={<IconPlus size={14} />}
        onClick={(e) => {
          e.stopPropagation();
          handleAdd();
        }}
      >
        Add Section
      </Button>
    );
  }

  return (
    <Button
      variant="subtle"
      color="slate"
      leftSection={<IconPlus size={14} />}
      onClick={(e) => {
        e.stopPropagation();
        handleAdd();
      }}
      fullWidth
      mt="sm"
    >
      Add Section
    </Button>
  );
}

// ── Main Canvas Component (pure rendering, no DndContext) ──

export function Canvas() {
  const sectionOrder = useFormBuilderStore((s) => s.sectionOrder);
  const selectNode = useFormBuilderStore((s) => s.selectNode);
  const formStatus = useFormBuilderStore((s) => s.form.status);
  const isLocked = formStatus === "active";

  return (
    <div className={classes.canvas} onClick={() => selectNode(null)}>
      {sectionOrder.length === 0 ? (
        <div className={classes.canvasEmpty}>
          <Text size="lg" c="dimmed">
            No sections yet
          </Text>
          <Text size="sm" c="dimmed">
            Add a section to start building your form
          </Text>
          {!isLocked && <AddSectionButton variant="empty" />}
        </div>
      ) : (
        <SortableContext
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          {sectionOrder.map((sectionId) => (
            <SortableSection key={sectionId} sectionId={sectionId} isLocked={isLocked}>
              <SectionFieldsGrid sectionId={sectionId} />
            </SortableSection>
          ))}
        </SortableContext>
      )}

      {sectionOrder.length > 0 && !isLocked && <AddSectionButton variant="bottom" />}
    </div>
  );
}
