import { Group, Stack, TagsInput } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconTrash } from "@tabler/icons-react";
import { type Control, Controller, useController, useWatch } from "react-hook-form";
import { Card, IconButton, Input, Select, Switch } from "@/components/ui";
import type { DraftForm } from "./FormEditorDrawer";
import { CHOICE_KINDS, FIELD_KINDS, toKey } from "./form-keys";

type FieldPath = `draft.sections.${number}.fields.${number}`;

interface FieldEditorProps {
  control: Control<DraftForm>;
  path: FieldPath;
  position: number;
  count: number;
  readOnly: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
}

/** One question: what it asks, how it is answered, and whether it must be. */
export function FieldEditor({
  control,
  path,
  position,
  count,
  readOnly,
  onMove,
  onRemove,
}: FieldEditorProps) {
  const kind = useWatch({ control, name: `${path}.kind` });
  const key = useController({ control, name: `${path}.key` });
  const label = useWatch({ control, name: `${path}.label` });
  const name = label || `Question ${position + 1}`;
  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Group align="flex-end" wrap="nowrap" gap="xs">
          <Controller
            control={control}
            name={`${path}.label`}
            render={({ field }) => (
              <Input
                label="Question"
                readOnly={readOnly}
                {...field}
                onBlur={() => {
                  field.onBlur();
                  // A new question takes its key from its label.
                  if (!key.field.value) key.field.onChange(toKey(field.value));
                }}
                style={{ flex: 2 }}
              />
            )}
          />
          <Controller
            control={control}
            name={`${path}.kind`}
            render={({ field }) => (
              <Select
                label="Answer type"
                data={FIELD_KINDS}
                readOnly={readOnly}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                style={{ flex: 1 }}
              />
            )}
          />
        </Group>
        <Group align="flex-end" wrap="nowrap" gap="xs">
          <Input
            label="Key"
            description="Stored with each answer; don't change it once records exist."
            readOnly={readOnly}
            value={key.field.value}
            onChange={(e) => key.field.onChange(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Controller
            control={control}
            name={`${path}.help`}
            render={({ field }) => (
              <Input
                label="Help text"
                readOnly={readOnly}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.currentTarget.value || null)}
                style={{ flex: 1 }}
              />
            )}
          />
        </Group>
        {CHOICE_KINDS.has(kind) && (
          <Controller
            control={control}
            name={`${path}.options`}
            render={({ field }) => (
              <TagsInput
                label="Choices"
                description="Press Enter after each choice."
                readOnly={readOnly}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        )}
        <Group justify="space-between">
          <Controller
            control={control}
            name={`${path}.required`}
            render={({ field }) => (
              <Switch
                label="Required"
                disabled={readOnly}
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          {!readOnly && (
            <Group gap={4}>
              <IconButton
                aria-label={`Move ${name} up`}
                disabled={position === 0}
                onClick={() => onMove(position - 1)}
              >
                <IconArrowUp size={16} />
              </IconButton>
              <IconButton
                aria-label={`Move ${name} down`}
                disabled={position === count - 1}
                onClick={() => onMove(position + 1)}
              >
                <IconArrowDown size={16} />
              </IconButton>
              <IconButton tone="danger" aria-label={`Remove ${name}`} onClick={onRemove}>
                <IconTrash size={16} />
              </IconButton>
            </Group>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
