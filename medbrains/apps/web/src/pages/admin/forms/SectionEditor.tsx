import { Group, Stack } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { type Control, Controller, useFieldArray } from "react-hook-form";
import { Button, Card, IconButton, Input } from "@/components/ui";
import { FieldEditor } from "./FieldEditor";
import type { DraftForm } from "./FormEditorDrawer";

interface SectionEditorProps {
  control: Control<DraftForm>;
  index: number;
  readOnly: boolean;
  onRemove: () => void;
}

/** A section's title and its questions, in order. */
export function SectionEditor({ control, index, readOnly, onRemove }: SectionEditorProps) {
  const fields = useFieldArray({ control, name: `draft.sections.${index}.fields` });
  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group align="flex-end" wrap="nowrap">
          <Controller
            control={control}
            name={`draft.sections.${index}.title`}
            render={({ field }) => (
              <Input
                label={`Section ${index + 1} title`}
                readOnly={readOnly}
                {...field}
                style={{ flex: 1 }}
              />
            )}
          />
          {!readOnly && (
            <IconButton tone="danger" aria-label={`Remove section ${index + 1}`} onClick={onRemove}>
              <IconTrash size={16} />
            </IconButton>
          )}
        </Group>
        {fields.fields.map((item, fieldIndex) => (
          <FieldEditor
            key={item.id}
            control={control}
            path={`draft.sections.${index}.fields.${fieldIndex}`}
            position={fieldIndex}
            count={fields.fields.length}
            readOnly={readOnly}
            onMove={(to) => fields.move(fieldIndex, to)}
            onRemove={() => fields.remove(fieldIndex)}
          />
        ))}
        {!readOnly && (
          <Button
            tone="ghost"
            size="xs"
            onClick={() =>
              fields.append({
                key: "",
                label: "",
                kind: "text",
                required: false,
                options: [],
                help: null,
              })
            }
          >
            Add question
          </Button>
        )}
      </Stack>
    </Card>
  );
}
