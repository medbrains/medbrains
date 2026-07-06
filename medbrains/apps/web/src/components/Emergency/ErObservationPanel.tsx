import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type ErObservationNote, P } from "@medbrains/types";
import { IconActivityHeartbeat, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { Alert, Button, Card, NumberField, TextArea, toast } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";

// ER observation chart — serial vitals + notes while a patient is held
// under observation before disposition. Append-only; the discharge
// summary / admit flow handle the exit. Gated by emergency.visits perms.

const VITALS = [
  { name: "pulse", label: "Pulse" },
  { name: "bp_systolic", label: "BP sys" },
  { name: "bp_diastolic", label: "BP dia" },
  { name: "resp_rate", label: "RR" },
  { name: "spo2", label: "SpO₂ %" },
  { name: "temperature", label: "Temp °C" },
  { name: "gcs", label: "GCS" },
  { name: "pain_score", label: "Pain" },
] as const;

const schema = z.object({
  pulse: z.number().optional(),
  bp_systolic: z.number().optional(),
  bp_diastolic: z.number().optional(),
  resp_rate: z.number().optional(),
  spo2: z.number().optional(),
  temperature: z.number().optional(),
  gcs: z.number().optional(),
  pain_score: z.number().optional(),
  note: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {};

function timeOf(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function vital(n: ErObservationNote): string {
  const bp = n.bp_systolic && n.bp_diastolic ? `${n.bp_systolic}/${n.bp_diastolic}` : "—";
  return [
    n.pulse != null ? `HR ${n.pulse}` : null,
    `BP ${bp}`,
    n.resp_rate != null ? `RR ${n.resp_rate}` : null,
    n.spo2 != null ? `SpO₂ ${n.spo2}%` : null,
    n.temperature != null ? `${n.temperature}°` : null,
    n.gcs != null ? `GCS ${n.gcs}` : null,
    n.pain_score != null ? `Pain ${n.pain_score}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ErObservationPanel({ visitId }: { visitId: string }) {
  const canView = useHasPermission(P.EMERGENCY.VISITS_LIST);
  const canChart = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["er-observation", visitId],
    queryFn: () => emergencyService.listErObservationNotes(visitId),
    enabled: canView,
  });

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const addMutation = useMutation({
    mutationFn: (values: FormValues) => emergencyService.createErObservationNote(visitId, values),
    onSuccess: () => {
      toast.success("Observation recorded.", { title: "Charted" });
      reset(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ["er-observation", visitId] });
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not chart" }),
  });

  if (!canView) return null;

  const submit = handleSubmit((values) => addMutation.mutate(values));

  return (
    <Box id="er-observation">
      <Card withBorder>
        <Stack>
          <Group gap="xs">
            <IconActivityHeartbeat size={18} />
            <Text fw={700}>Observation chart</Text>
          </Group>

          {canChart && (
            <Box component="form" onSubmit={submit}>
              <Stack gap="sm">
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                  {VITALS.map((v) => (
                    <Controller
                      key={v.name}
                      control={control}
                      name={v.name}
                      render={({ field }) => (
                        <NumberField
                          label={v.label}
                          value={field.value ?? ""}
                          onChange={(val) =>
                            field.onChange(typeof val === "number" ? val : undefined)
                          }
                          onBlur={field.onBlur}
                          min={0}
                        />
                      )}
                    />
                  ))}
                </SimpleGrid>
                <Controller
                  control={control}
                  name="note"
                  render={({ field }) => (
                    <TextArea
                      label="Note"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      minRows={2}
                    />
                  )}
                />
                <Group>
                  <Button
                    type="submit"
                    leftSection={<IconPlus size={14} />}
                    loading={addMutation.isPending}
                  >
                    Add observation
                  </Button>
                </Group>
              </Stack>
            </Box>
          )}

          {isLoading ? (
            <Text size="sm" c="dimmed">
              Loading…
            </Text>
          ) : notes.length === 0 ? (
            <Alert tone="info">
              No observations charted yet. Record serial vitals here while the patient is under
              observation.
            </Alert>
          ) : (
            <DataTable
              columns={[
                {
                  key: "time",
                  label: "Time",
                  render: (n: ErObservationNote) => (
                    <Text size="xs" ff="monospace">
                      {timeOf(n.observed_at)}
                    </Text>
                  ),
                },
                {
                  key: "vitals",
                  label: "Vitals",
                  render: (n: ErObservationNote) => <Text size="sm">{vital(n)}</Text>,
                },
                {
                  key: "note",
                  label: "Note",
                  render: (n: ErObservationNote) => <Text size="sm">{n.note ?? "—"}</Text>,
                },
              ]}
              data={notes}
              rowKey={(n) => n.id}
            />
          )}
        </Stack>
      </Card>
    </Box>
  );
}
