/**
 * The radiographer records what an exam gave the patient: CTDIvol and DLP for
 * CT, dose-area product and screening time for fluoroscopy, exposures and
 * technique for radiographs. Only what applies is filled; at least one figure
 * is needed. The server checks the same bounds and has the last word.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { RecordDoseRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, type FieldPath, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, NumberField, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

/** What the number box holds while typing: a number, or text like "14." mid-entry. */
const blankToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : Number(v));

const figure = (max: number, label: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .number({ error: `${label} must be a number` })
      .min(0, `${label} cannot be negative`)
      .max(max, `${label} above ${max} — check the decimal point`)
      .optional(),
  );

const schema = z
  .object({
    ctdi_vol: figure(1000, "CTDIvol"),
    dlp: figure(50_000, "DLP"),
    dap: figure(10_000, "Dose-area product"),
    fluoroscopy_time_seconds: figure(21_600, "Screening time").refine(
      (v) => v === undefined || Number.isInteger(v),
      "Whole seconds",
    ),
    exposure_count: figure(1000, "Exposures").refine(
      (v) => v === undefined || Number.isInteger(v),
      "A whole number",
    ),
    kvp: figure(150, "kVp").refine(
      (v) => v === undefined || v >= 20,
      "kVp below 20 is not an exposure",
    ),
    mas: figure(2000, "mAs"),
  })
  .refine(
    (v) =>
      [v.ctdi_vol, v.dlp, v.dap, v.fluoroscopy_time_seconds, v.exposure_count].some(
        (x) => x !== undefined,
      ),
    { message: "Enter at least one dose figure", path: ["ctdi_vol"] },
  );
type FormInput = z.input<typeof schema>;
type Form = z.output<typeof schema>;

interface FieldSpec {
  name: FieldPath<FormInput>;
  label: string;
  decimals: number;
}

const GROUPS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: "CT",
    fields: [
      { name: "ctdi_vol", label: "CTDIvol (mGy)", decimals: 2 },
      { name: "dlp", label: "DLP (mGy·cm)", decimals: 1 },
    ],
  },
  {
    title: "Fluoroscopy",
    fields: [
      { name: "dap", label: "Dose-area product (Gy·cm²)", decimals: 3 },
      { name: "fluoroscopy_time_seconds", label: "Screening time (seconds)", decimals: 0 },
    ],
  },
  {
    title: "Radiograph",
    fields: [
      { name: "exposure_count", label: "Number of exposures", decimals: 0 },
      { name: "kvp", label: "kVp (optional)", decimals: 1 },
      { name: "mas", label: "mAs (optional)", decimals: 2 },
    ],
  },
];

const EMPTY: FormInput = {};

/** Only the figures that were entered. */
function filled(v: Form): RecordDoseRequest {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));
}

interface DoseEntryFormProps {
  orderId: string;
  patientId: string;
}

export function DoseEntryForm({ orderId, patientId }: DoseEntryFormProps) {
  const qc = useQueryClient();
  const form = useForm<FormInput, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });
  const save = useMutation({
    mutationFn: (v: Form) => radiologyService.recordRadiationDose(orderId, filled(v)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", orderId] });
      void qc.invalidateQueries({ queryKey: ["cumulative-dose", patientId] });
      void qc.invalidateQueries({ queryKey: ["patient-dose-records", patientId] });
      form.reset(EMPTY);
      toast.success("It now counts towards the patient's cumulative dose.", {
        title: "Dose recorded",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Dose not recorded" }),
  });

  return (
    <form
      aria-label="Record radiation dose"
      noValidate
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
    >
      <Stack gap="sm">
        <Text fw={600} size="sm">
          Record dose
        </Text>
        {GROUPS.map((group) => (
          <Stack key={group.title} gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase">
              {group.title}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              {group.fields.map((f) => (
                <Controller
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field, fieldState }) => (
                    <NumberField
                      label={f.label}
                      min={0}
                      decimalScale={f.decimals}
                      allowNegative={false}
                      value={(field.value as number | string | undefined) ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              ))}
            </SimpleGrid>
          </Stack>
        ))}
        <Group justify="flex-end">
          <Button tone="primary" type="submit" loading={save.isPending}>
            Record dose
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
