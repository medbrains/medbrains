import { Stack, Text } from "@mantine/core";
import type { FormDefinition } from "@medbrains/types";
import { type Control, Controller, type FieldErrors } from "react-hook-form";
import { FieldControl } from "./FieldControl";
import type { DraftAnswers } from "./schema";

interface DynamicFieldsProps {
  definition: FormDefinition;
  control: Control<DraftAnswers>;
  errors?: FieldErrors<DraftAnswers>;
  readOnly?: boolean;
}

/**
 * Renders a hospital-built form's questions, section by section. The caller
 * owns the React Hook Form instance (see `useDynamicForm`), so the questions
 * can sit inside a larger form such as a consent.
 */
export function DynamicFields({ definition, control, errors, readOnly }: DynamicFieldsProps) {
  return (
    <Stack gap="lg">
      {definition.sections.map((section) => (
        <Stack key={section.title} gap="sm" role="group" aria-label={section.title}>
          <Text fw={600} size="sm">
            {section.title}
          </Text>
          {section.fields.map((spec) => (
            <Controller
              key={spec.key}
              control={control}
              name={spec.key}
              render={({ field }) => (
                <FieldControl
                  field={spec}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors?.[spec.key]?.message as string | undefined}
                  readOnly={readOnly}
                />
              )}
            />
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
