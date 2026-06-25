import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import { type ErDischargeSummary, P } from "@medbrains/types";
import { IconCircleCheck, IconFileText } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DocumentActions } from "@/components/DocumentActions";
import { Alert, Badge, Button, Card, TextArea, toast } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";

// ER discharge summary — structured, printable hand-out the patient
// leaves with (NABH/JCI). Draft → finalized; once finalized it's
// read-only and printable. Fields are free text (ER isn't diagnosis-
// backed). Gated by emergency.visits.update for edit/finalize.

const schema = z.object({
  final_diagnosis: z.string().trim().optional(),
  condition_at_discharge: z.string().trim().optional(),
  clinical_course: z.string().trim().optional(),
  treatment_given: z.string().trim().optional(),
  medications_on_discharge: z.string().trim().optional(),
  follow_up_instructions: z.string().trim().optional(),
  follow_up_date: z.date().nullable().optional(),
  warning_signs: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

function toForm(summary: ErDischargeSummary | null): FormValues {
  return {
    final_diagnosis: summary?.final_diagnosis ?? "",
    condition_at_discharge: summary?.condition_at_discharge ?? "",
    clinical_course: summary?.clinical_course ?? "",
    treatment_given: summary?.treatment_given ?? "",
    medications_on_discharge: summary?.medications_on_discharge ?? "",
    follow_up_instructions: summary?.follow_up_instructions ?? "",
    follow_up_date: summary?.follow_up_date ? new Date(summary.follow_up_date) : null,
    warning_signs: summary?.warning_signs ?? "",
  };
}

function toRequest(values: FormValues) {
  return {
    ...values,
    follow_up_date: values.follow_up_date
      ? values.follow_up_date.toISOString().slice(0, 10)
      : undefined,
  };
}

export function ErDischargeSummaryPanel({ visitId }: { visitId: string }) {
  const canView = useHasPermission(P.EMERGENCY.VISITS_LIST);
  const canEdit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["er-discharge-summary", visitId],
    queryFn: () => emergencyService.getErDischargeSummary(visitId),
    enabled: canView,
  });

  const finalized = summary?.status === "finalized";
  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: toForm(summary ?? null),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["er-discharge-summary", visitId] });

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      summary
        ? emergencyService.updateErDischargeSummary(visitId, toRequest(values))
        : emergencyService.createErDischargeSummary(visitId, toRequest(values)),
    onSuccess: () => {
      toast.success("Discharge summary saved.", { title: "Saved" });
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not save" }),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => emergencyService.finalizeErDischargeSummary(visitId),
    onSuccess: (s) => {
      reset(toForm(s));
      toast.success("Discharge summary finalized.", { title: "Finalized" });
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not finalize" }),
  });

  if (!canView) return null;

  const submit = handleSubmit((values) => saveMutation.mutate(values));

  const field = (name: keyof FormValues, label: string, opts?: { minRows?: number }) => (
    <Controller
      control={control}
      name={name}
      render={({ field: f }) => (
        <TextArea
          label={label}
          value={(f.value as string) ?? ""}
          onChange={f.onChange}
          onBlur={f.onBlur}
          minRows={opts?.minRows ?? 2}
          disabled={finalized || !canEdit}
        />
      )}
    />
  );

  return (
    <Box id="er-discharge">
      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Group gap="xs">
              <IconFileText size={18} />
              <Text fw={700}>Discharge summary</Text>
              {summary && (
                <Badge tone={finalized ? "success" : "warning"}>
                  {finalized ? "Finalized" : "Draft"}
                </Badge>
              )}
            </Group>
            {summary && (
              <DocumentActions
                templateCode="er_discharge_summary"
                sourceId={visitId}
                size="sm"
                disabled={!finalized}
              />
            )}
          </Group>

          {isLoading ? (
            <Text size="sm" c="dimmed">
              Loading…
            </Text>
          ) : (
            <Box component="form" onSubmit={submit}>
              <Stack>
                {finalized && (
                  <Alert tone="info">
                    This discharge summary is finalized and read-only. Use the PDF action to print
                    or hand it to the patient.
                  </Alert>
                )}
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  {field("final_diagnosis", "Diagnosis")}
                  {field("condition_at_discharge", "Condition at discharge")}
                  {field("clinical_course", "Clinical course")}
                  {field("treatment_given", "Treatment given")}
                  {field("medications_on_discharge", "Medications to continue", { minRows: 3 })}
                  {field("follow_up_instructions", "Follow-up instructions")}
                </SimpleGrid>
                <Controller
                  control={control}
                  name="follow_up_date"
                  render={({ field: f }) => (
                    <DatePickerInput
                      label="Follow-up by"
                      value={f.value ?? null}
                      onChange={f.onChange}
                      disabled={finalized || !canEdit}
                      clearable
                      maw={240}
                    />
                  )}
                />
                {field("warning_signs", "Return-immediately warning signs", { minRows: 2 })}

                {canEdit && !finalized && (
                  <Group>
                    <Button type="submit" loading={saveMutation.isPending}>
                      Save draft
                    </Button>
                    {summary && (
                      <Button
                        tone="secondary"
                        leftSection={<IconCircleCheck size={16} />}
                        loading={finalizeMutation.isPending}
                        onClick={() => finalizeMutation.mutate()}
                      >
                        Finalize
                      </Button>
                    )}
                  </Group>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
