import { ActionIcon, Group, Text, TextInput, Tooltip } from "@mantine/core";
import {
  IconGripVertical,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import classes from "./screen-builder.module.scss";

export interface ColumnDef {
  key: string;
  label: string;
}

export function ColumnEditor({
  columns,
  onChange,
  keyPlaceholder = "key",
  labelPlaceholder = "Label",
  addLabel = "Add column",
}: {
  columns: ColumnDef[];
  onChange: (columns: ColumnDef[]) => void;
  keyPlaceholder?: string;
  labelPlaceholder?: string;
  addLabel?: string;
}) {
  const handleUpdate = (index: number, field: "key" | "label", value: string) => {
    const updated = columns.map((c, i) =>
      i === index ? { ...c, [field]: value } : c,
    );
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([...columns, { key: "", label: "" }]);
  };

  const handleRemove = (index: number) => {
    onChange(columns.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...columns];
    const temp = updated[index - 1]!;
    updated[index - 1] = updated[index]!;
    updated[index] = temp;
    onChange(updated);
  };

  return (
    <div>
      {columns.length === 0 && (
        <Text size="xs" c="dimmed" fs="italic" mb="xs">
          No columns defined
        </Text>
      )}

      {columns.map((col, i) => (
        <div key={i} className={classes.columnRow}>
          <div
            className={classes.columnRowHandle}
            onClick={() => handleMoveUp(i)}
            title="Move up"
          >
            <IconGripVertical size={14} />
          </div>
          <TextInput
            size="xs"
            placeholder={keyPlaceholder}
            value={col.key}
            onChange={(e) => handleUpdate(i, "key", e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <TextInput
            size="xs"
            placeholder={labelPlaceholder}
            value={col.label}
            onChange={(e) => handleUpdate(i, "label", e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Tooltip label="Remove">
            <ActionIcon variant="subtle" color="danger" size="xs" onClick={() => handleRemove(i)} aria-label="Delete">
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </div>
      ))}

      <Group mt="xs">
        <ActionIcon variant="light" size="sm" onClick={handleAdd} aria-label="Add">
          <IconPlus size={14} />
        </ActionIcon>
        <Text size="xs" c="dimmed">
          {addLabel}
        </Text>
      </Group>
    </div>
  );
}
