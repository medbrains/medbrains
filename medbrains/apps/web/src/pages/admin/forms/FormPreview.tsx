import { Stack, Text } from "@mantine/core";
import type { FormDefinition } from "@medbrains/types";
import { useMemo } from "react";
import { type Control, useWatch } from "react-hook-form";
import { DynamicFields, useDynamicForm } from "@/components/DynamicForm";
import { Card } from "@/components/ui";
import type { DraftForm } from "./FormEditorDrawer";

/** The draft as staff will see it once published. Questions without a key are left out until they have one. */
export function FormPreview({ control }: { control: Control<DraftForm> }) {
  const draft = useWatch({ control, name: "draft" });
  const definition = useMemo<FormDefinition>(
    () => ({
      sections: draft.sections.map((s) => ({
        ...s,
        fields: s.fields.filter((f) => f.key && f.label),
      })),
    }),
    [draft],
  );
  const preview = useDynamicForm(definition);
  return (
    <Card withBorder padding="md" aria-label="Preview">
      <Stack gap="sm">
        <Text fw={600}>Preview</Text>
        <DynamicFields
          definition={definition}
          control={preview.control}
          errors={preview.formState.errors}
        />
      </Stack>
    </Card>
  );
}
