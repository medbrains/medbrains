import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, SimpleGrid, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { BloodPressureField } from "@/components/Clinical/BloodPressureField";
import { Alert, Button, Modal, NumberField, Select, TextArea, toast } from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import {
  type AncVisitFormValues,
  ancVisitSchema,
  hasProteinuria,
  isPreEclampsiaRangeBp,
  OEDEMA,
  toCreateAncVisitRequest,
  URINE_DIPSTICK,
} from "./anc-visit-form";

interface AncVisitDrawerProps {
  registrationId: string;
  nextVisitNumber: number;
  opened: boolean;
  onClose: () => void;
}

type NumberKey =
  | "gestational_weeks"
  | "weight_kg"
  | "fundal_height_cm"
  | "fetal_heart_rate"
  | "hemoglobin";

const NUMBERS: { name: NumberKey; label: string; decimals: number; required?: boolean }[] = [
  { name: "gestational_weeks", label: "Gestational age (weeks)", decimals: 1, required: true },
  { name: "weight_kg", label: "Weight (kg)", decimals: 1 },
  { name: "fundal_height_cm", label: "Fundal height (cm)", decimals: 1 },
  { name: "fetal_heart_rate", label: "Fetal heart rate (bpm)", decimals: 0 },
  { name: "hemoglobin", label: "Haemoglobin (g/dL)", decimals: 1 },
];

const dipstick = URINE_DIPSTICK.map((v) => ({ value: v, label: v }));
const oedema = OEDEMA.map((v) => ({ value: v, label: v[0]?.toUpperCase() + v.slice(1) }));

/** Record one antenatal visit; raises the pre-eclampsia flag as the BP is typed. */
export function AncVisitDrawer({
  registrationId,
  nextVisitNumber,
  opened,
  onClose,
}: AncVisitDrawerProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset } = useForm<AncVisitFormValues>({
    resolver: zodResolver(ancVisitSchema),
    values: { visit_number: nextVisitNumber } as AncVisitFormValues,
  });
  const [systolic, diastolic, protein] = useWatch({
    control,
    name: ["bp_systolic", "bp_diastolic", "urine_protein"],
  });
  const raisedBp = isPreEclampsiaRangeBp(systolic, diastolic);

  const save = useMutation({
    mutationFn: (values: Parameters<typeof toCreateAncVisitRequest>[0]) =>
      specialtyService.createAncVisit(registrationId, toCreateAncVisitRequest(values)),
    onSuccess: () => {
      toast.success("ANC visit recorded.", { title: "Maternity" });
      void queryClient.invalidateQueries({ queryKey: ["anc-visits", registrationId] });
      reset();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "ANC visit not saved" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title={`ANC visit ${nextVisitNumber}`} fullScreen>
      <Box
        component="form"
        aria-label="ANC visit"
        onSubmit={handleSubmit((values) => save.mutate(ancVisitSchema.parse(values)))}
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {NUMBERS.map((n) => (
              <Controller
                key={n.name}
                control={control}
                name={n.name}
                render={({ field, fieldState }) => (
                  <NumberField
                    label={n.label}
                    required={n.required}
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                    decimalScale={n.decimals}
                    allowDecimal={n.decimals > 0}
                    error={fieldState.error?.message}
                  />
                )}
              />
            ))}
          </SimpleGrid>
          <BloodPressureField
            control={control}
            systolicName="bp_systolic"
            diastolicName="bp_diastolic"
            emptyValue={undefined}
          />
          {raisedBp && (
            <Alert tone="danger" title="Pre-eclampsia risk: BP ≥ 140/90">
              {hasProteinuria(protein)
                ? "Raised BP with proteinuria — manage as pre-eclampsia; refer to the obstetrician today."
                : "Raised BP in pregnancy — check urine protein and repeat the BP; refer if it stays raised."}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <Controller
              control={control}
              name="urine_protein"
              render={({ field }) => (
                <Select
                  label="Urine albumin"
                  data={dipstick}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  clearable
                />
              )}
            />
            <Controller
              control={control}
              name="urine_sugar"
              render={({ field }) => (
                <Select
                  label="Urine sugar"
                  data={dipstick}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  clearable
                />
              )}
            />
            <Controller
              control={control}
              name="oedema"
              render={({ field }) => (
                <Select
                  label="Oedema"
                  data={oedema}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? undefined)}
                  clearable
                />
              )}
            />
          </SimpleGrid>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <TextArea label="Notes" value={field.value ?? ""} onChange={field.onChange} />
            )}
          />
          <Group>
            <Button type="submit" loading={save.isPending}>
              Save ANC visit
            </Button>
          </Group>
        </Stack>
      </Box>
    </Modal>
  );
}
