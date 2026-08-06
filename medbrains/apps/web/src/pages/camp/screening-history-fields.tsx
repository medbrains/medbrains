// Camp screening — medical history and point-of-care tests.
//
// Kept out of screenings-tab.tsx, which is already past the 450-line rule.
//
// Every history question is three-state on purpose. The paper form is a tick
// box, and in all 1,125 audited records a tick means yes while blank means the
// question was never reached — not that the patient denied it. Recording an
// unasked question as a negative finding would overstate how healthy a camp
// population is, which is the one thing a screening camp must not do.

import { Group, SegmentedControl, SimpleGrid, Stack, Text, Textarea } from "@mantine/core";
import type { CampScreeningFormInput } from "@medbrains/schemas";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { NumberField } from "@/components/ui";

const HISTORY_QUESTIONS = [
  { name: "mh_diabetes", label: "Diabetes" },
  { name: "mh_hypertension", label: "Hypertension" },
  { name: "mh_asthma", label: "Asthma" },
  { name: "mh_heart_disease", label: "Heart disease" },
  { name: "mh_thyroid_disorder", label: "Thyroid disorder" },
  { name: "mh_previous_surgeries", label: "Previous surgeries" },
  { name: "mh_allergies", label: "Allergies" },
  { name: "mh_smoking_history", label: "Smoking history" },
  { name: "mh_alcohol_use", label: "Alcohol use" },
  { name: "mh_family_history", label: "Family history" },
  { name: "mh_others", label: "Other conditions" },
] as const satisfies ReadonlyArray<{
  name: keyof CampScreeningFormInput;
  label: string;
}>;

const ANSWER_OPTIONS = [
  { value: "", label: "Not asked" },
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

interface CampScreeningHistoryFieldsProps {
  control: Control<CampScreeningFormInput>;
}

export function CampScreeningHistoryFields({ control }: CampScreeningHistoryFieldsProps) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Medical history
      </Text>
      <Text size="xs" c="dimmed">
        Leave as “Not asked” when the question was not reached — it is not the same as a no.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {HISTORY_QUESTIONS.map((question) => (
          <Stack key={question.name} gap={0}>
            <Controller
              control={control}
              name={question.name}
              render={({ field }) => (
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Text size="sm" id={`${question.name}-label`}>
                    {question.label}
                  </Text>
                  <SegmentedControl
                    size="xs"
                    data={ANSWER_OPTIONS}
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={field.onChange}
                    aria-labelledby={`${question.name}-label`}
                  />
                </Group>
              )}
            />
          </Stack>
        ))}
      </SimpleGrid>

      <Controller
        control={control}
        name="medical_history_notes"
        render={({ field }) => (
          <Textarea
            label="Medical history notes"
            placeholder="Current medication, duration, anything the tick boxes miss"
            autosize
            minRows={2}
            {...field}
            value={typeof field.value === "string" ? field.value : ""}
          />
        )}
      />
    </Stack>
  );
}

export function CampScreeningTestFields({ control }: CampScreeningHistoryFieldsProps) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Point-of-care tests
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
        <Stack gap={0}>
          <Controller
            control={control}
            name="test_hba1c"
            render={({ field }) => (
              <NumberField
                label="HbA1c (%)"
                min={2}
                max={20}
                step={0.1}
                decimalScale={2}
                value={field.value as number | string}
                onChange={field.onChange}
              />
            )}
          />
        </Stack>
        <Stack gap={0}>
          <Controller
            control={control}
            name="test_haemoglobin"
            render={({ field }) => (
              <NumberField
                label="Haemoglobin (g/dl)"
                min={1}
                max={25}
                step={0.1}
                decimalScale={2}
                value={field.value as number | string}
                onChange={field.onChange}
              />
            )}
          />
        </Stack>
        <Stack gap={0}>
          <Controller
            control={control}
            name="test_thyroid"
            render={({ field }) => (
              <NumberField
                label="TSH"
                min={0}
                step={0.01}
                decimalScale={3}
                value={field.value as number | string}
                onChange={field.onChange}
              />
            )}
          />
        </Stack>
      </SimpleGrid>

      {/* Handwritten impressions on the paper form — free text, because coding
          them would invent precision the original never had. */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {(
          [
            { name: "test_ecg", label: "ECG", placeholder: "Impression" },
            { name: "test_xray", label: "X-ray", placeholder: "Impression" },
            { name: "test_bmd", label: "BMD", placeholder: "T-score / impression" },
            { name: "test_biothesiometry", label: "Biothesiometry", placeholder: "Reading" },
          ] as const
        ).map((test) => (
          <Stack key={test.name} gap={0}>
            <Controller
              control={control}
              name={test.name}
              render={({ field }) => (
                <Textarea
                  label={test.label}
                  placeholder={test.placeholder}
                  autosize
                  minRows={1}
                  {...field}
                  value={typeof field.value === "string" ? field.value : ""}
                />
              )}
            />
          </Stack>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
