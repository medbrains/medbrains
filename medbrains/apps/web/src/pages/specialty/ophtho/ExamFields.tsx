/**
 * The eye workup laid out the way it is taken: vision per eye, then the
 * refraction per eye, then what the optician needs, pressures and findings.
 * Read-only once the exam is signed.
 */
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { type Control, Controller, type FieldPath } from "react-hook-form";
import { Input, NumberField, Select, TextArea } from "@/components/ui";
import { type ExamForm, LENS_TYPES } from "./exam-form";

interface ExamFieldsProps {
  control: Control<ExamForm>;
  readOnly: boolean;
}

const EYES = [
  { suffix: "od", label: "Right eye (OD)" },
  { suffix: "os", label: "Left eye (OS)" },
] as const;

interface FieldProps {
  control: Control<ExamForm>;
  name: FieldPath<ExamForm>;
  label: string;
  readOnly: boolean;
}

function TextField({ control, name, label, readOnly }: FieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          label={label}
          readOnly={readOnly}
          value={(field.value as string | null) ?? ""}
          onChange={(e) => field.onChange(e.currentTarget.value)}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

function PowerField({
  control,
  name,
  label,
  readOnly,
  step = 0.25,
  scale = 2,
}: FieldProps & { step?: number; scale?: number }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <NumberField
          label={label}
          readOnly={readOnly}
          step={step}
          decimalScale={scale}
          allowDecimal={scale > 0}
          value={(field.value as number | null) ?? ""}
          onChange={(v) => field.onChange(typeof v === "number" ? v : null)}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

export function ExamFields({ control, readOnly }: ExamFieldsProps) {
  const ro = readOnly;
  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text fw={600}>Vision</Text>
        {EYES.map((e) => (
          <SimpleGrid key={e.suffix} cols={{ base: 1, sm: 3 }} spacing="sm">
            <TextField
              control={control}
              readOnly={ro}
              name={`visual_acuity_${e.suffix}`}
              label={`${e.label} — unaided`}
            />
            <TextField
              control={control}
              readOnly={ro}
              name={`bcva_${e.suffix}`}
              label={`${e.label} — best corrected`}
            />
            <TextField
              control={control}
              readOnly={ro}
              name={`near_va_${e.suffix}`}
              label={`${e.label} — near`}
            />
          </SimpleGrid>
        ))}
      </Stack>

      <Stack gap="xs">
        <Text fw={600}>Refraction</Text>
        {EYES.map((e) => (
          <SimpleGrid key={e.suffix} cols={{ base: 2, sm: 4 }} spacing="sm">
            <PowerField
              control={control}
              readOnly={ro}
              name={`sphere_${e.suffix}`}
              label={`${e.label} — sphere`}
            />
            <PowerField
              control={control}
              readOnly={ro}
              name={`cylinder_${e.suffix}`}
              label={`${e.label} — cylinder`}
            />
            <PowerField
              control={control}
              readOnly={ro}
              name={`axis_${e.suffix}`}
              label={`${e.label} — axis`}
              step={1}
              scale={0}
            />
            <PowerField
              control={control}
              readOnly={ro}
              name={`add_${e.suffix}`}
              label={`${e.label} — near add`}
            />
          </SimpleGrid>
        ))}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <PowerField
            control={control}
            readOnly={ro}
            name="pd_mm"
            label="Pupillary distance (mm)"
            step={0.5}
            scale={1}
          />
          <Controller
            control={control}
            name="lens_type"
            render={({ field, fieldState }) => (
              <Select
                label="Lens type"
                data={[...LENS_TYPES]}
                readOnly={ro}
                clearable={!ro}
                value={field.value}
                onChange={(v) => field.onChange(v)}
                error={fieldState.error?.message}
              />
            )}
          />
          <PowerField
            control={control}
            readOnly={ro}
            name="review_after_months"
            label="Review after (months)"
            step={1}
            scale={0}
          />
        </SimpleGrid>
        <TextField
          control={control}
          readOnly={ro}
          name="lens_advice"
          label="Lens advice (coating, tint, material)"
        />
      </Stack>

      <SimpleGrid cols={2} spacing="sm">
        <PowerField
          control={control}
          readOnly={ro}
          name="iop_od"
          label="IOP right (mmHg)"
          step={1}
          scale={1}
        />
        <PowerField
          control={control}
          readOnly={ro}
          name="iop_os"
          label="IOP left (mmHg)"
          step={1}
          scale={1}
        />
      </SimpleGrid>

      {(["slit_lamp", "fundus", "diagnosis", "plan"] as const).map((name) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field }) => (
            <TextArea
              label={
                {
                  slit_lamp: "Slit-lamp findings",
                  fundus: "Fundus findings",
                  diagnosis: "Diagnosis",
                  plan: "Plan",
                }[name]
              }
              readOnly={ro}
              autosize
              minRows={2}
              value={field.value}
              onChange={(e) => field.onChange(e.currentTarget.value)}
            />
          )}
        />
      ))}
    </Stack>
  );
}
