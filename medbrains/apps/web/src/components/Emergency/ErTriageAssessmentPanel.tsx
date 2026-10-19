import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { ErTriageAssessment } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { BloodPressureField } from "@/components/Clinical/BloodPressureField";
import { Alert, Badge, Button, Input, NumberField, Select, TextArea, toast } from "@/components/ui";
import { triageInfo } from "@/pages/emergency/shared";
import { emergencyService } from "@/services/emergency.service";
import {
  type ErTriageFormValues,
  erTriageSchema,
  TRIAGE_LEVELS,
  toCreateTriageRequest,
} from "./er-triage-form";

interface ErTriageAssessmentPanelProps {
  visitId: string;
  canView: boolean;
  canCreate: boolean;
}

const LEVEL_OPTIONS = TRIAGE_LEVELS.map((level) => ({
  value: level,
  label: triageInfo(level).label,
}));

const NUMBERS = [
  { name: "pulse_rate", label: "Pulse (bpm)", max: 300 },
  { name: "respiratory_rate", label: "Resp. rate (/min)", max: 80 },
  { name: "spo2", label: "SpO₂ %", max: 100 },
  { name: "gcs_score", label: "GCS (3–15)", max: 15 },
  { name: "pain_score", label: "Pain (0–10)", max: 10 },
] as const;

function summary(a: ErTriageAssessment): string {
  return [
    a.blood_pressure_systolic != null && a.blood_pressure_diastolic != null
      ? `BP ${a.blood_pressure_systolic}/${a.blood_pressure_diastolic} mmHg`
      : null,
    a.pulse_rate != null ? `HR ${a.pulse_rate}` : null,
    a.respiratory_rate != null ? `RR ${a.respiratory_rate}` : null,
    a.spo2 != null ? `SpO₂ ${a.spo2}%` : null,
    a.gcs_score != null ? `GCS ${a.gcs_score}` : null,
    a.pain_score != null ? `Pain ${a.pain_score}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** ESI triage assessment: level + the vitals it rests on. Sets the visit's triage level. */
export function ErTriageAssessmentPanel({
  visitId,
  canView,
  canCreate,
}: ErTriageAssessmentPanelProps) {
  const queryClient = useQueryClient();
  const {
    data: assessments = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["er-triage-assessments", visitId],
    queryFn: () => emergencyService.listTriageAssessments(visitId),
    enabled: canView,
  });
  const { control, handleSubmit, reset, formState } = useForm<ErTriageFormValues>({
    resolver: zodResolver(erTriageSchema),
    defaultValues: {},
  });
  const save = useMutation({
    mutationFn: (values: Parameters<typeof toCreateTriageRequest>[0]) =>
      emergencyService.createTriageAssessment(visitId, toCreateTriageRequest(values)),
    onSuccess: () => {
      toast.success("Triage recorded.", { title: "Triage" });
      reset({});
      void queryClient.invalidateQueries({ queryKey: ["er-triage-assessments", visitId] });
      void queryClient.invalidateQueries({ queryKey: ["er-visit", visitId] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Triage not saved" }),
  });

  return (
    <Stack gap="sm">
      {canCreate && (
        <Box
          component="form"
          onSubmit={handleSubmit((values) => save.mutate(erTriageSchema.parse(values)))}
          aria-label="Triage assessment"
        >
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Controller
                control={control}
                name="triage_level"
                render={({ field }) => (
                  <Select
                    label="Triage level (ESI)"
                    data={LEVEL_OPTIONS}
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? undefined)}
                    error={formState.errors.triage_level?.message}
                    required
                  />
                )}
              />
              <Controller
                control={control}
                name="chief_complaint"
                render={({ field }) => (
                  <Input
                    label="Chief complaint"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.currentTarget.value)}
                  />
                )}
              />
            </SimpleGrid>
            <BloodPressureField
              control={control}
              systolicName="blood_pressure_systolic"
              diastolicName="blood_pressure_diastolic"
              emptyValue={undefined}
            />
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              {NUMBERS.map((n) => (
                <Controller
                  key={n.name}
                  control={control}
                  name={n.name}
                  render={({ field, fieldState }) => (
                    <NumberField
                      label={n.label}
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                      min={0}
                      max={n.max}
                      allowDecimal={false}
                      error={fieldState.error?.message}
                    />
                  )}
                />
              ))}
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
                Record triage
              </Button>
            </Group>
          </Stack>
        </Box>
      )}
      {canView &&
        (isError ? (
          <Alert tone="danger">Triage history could not be loaded.</Alert>
        ) : isLoading ? (
          <Text size="sm" c="dimmed">
            Loading triage history…
          </Text>
        ) : assessments.length === 0 ? (
          <Text size="sm" c="dimmed">
            No triage assessment recorded yet.
          </Text>
        ) : (
          assessments.map((a) => (
            <Group key={a.id} gap="xs" wrap="nowrap" align="flex-start">
              <Badge tone="neutral">{triageInfo(a.triage_level).label}</Badge>
              <Stack gap={0}>
                <Text size="sm">{a.chief_complaint ?? "—"}</Text>
                <Text size="xs" c="dimmed">
                  {summary(a)} · {new Date(a.assessed_at).toLocaleString()}
                </Text>
              </Stack>
            </Group>
          ))
        ))}
    </Stack>
  );
}
