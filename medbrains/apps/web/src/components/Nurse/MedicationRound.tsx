import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { MarDueRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconPill } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, toast } from "@/components/ui";
import { NumberField } from "@/components/ui/Input";
import { nurseActivitiesService } from "@/services/nurseActivities.service";
import { AdministerModal } from "./AdministerModal";

interface Props {
  /** Restrict the round to a single patient (e.g. opened from a patient card). */
  patientId?: string;
}

/**
 * The nurse's medication round — scheduled doses due now (canonical
 * `ipd_medication_administration`), each given through the 5-Rights
 * AdministerModal with batch traceability and high-alert witness.
 */
export function MedicationRound({ patientId }: Props) {
  const qc = useQueryClient();
  const canAdminister = useHasPermission(P.NURSE.MAR_ADMINISTER);
  const [windowMin, setWindowMin] = useState(60);
  const [active, setActive] = useState<MarDueRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["mar-due-now", windowMin, patientId],
    queryFn: () =>
      nurseActivitiesService.listMarDueNow({
        window_min: windowMin,
        patient_id: patientId || undefined,
      }),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Parameters<typeof nurseActivitiesService.updateMarRound>[1]) =>
      nurseActivitiesService.updateMarRound(id, input),
    onSuccess: () => {
      setActive(null);
      qc.invalidateQueries({ queryKey: ["mar-due-now"] });
      toast.success("Dose recorded", { title: "eMAR" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record dose" }),
  });

  return (
    <Stack>
      <Group>
        <NumberField
          label="Look-ahead (minutes)"
          value={windowMin}
          onChange={(v) => setWindowMin(typeof v === "number" ? v : 60)}
          min={15}
          max={1440}
          step={15}
          w={200}
        />
        {patientId && (
          <Badge tone="neutral" mt={24}>
            This patient
          </Badge>
        )}
      </Group>

      {isLoading && <Text c="dimmed">Loading…</Text>}
      {!isLoading && data.length === 0 && (
        <Text c="dimmed">No medications due in this window.</Text>
      )}

      <Stack gap="xs">
        {data.map((row) => (
          <Card key={row.id} padding="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Group gap="xs">
                  <IconPill size={16} />
                  <Text fw={600}>
                    {row.drug_name} · {row.dose}
                  </Text>
                  {row.is_high_alert && (
                    <Badge tone="danger" size="sm" leftSection={<IconAlertTriangle size={11} />}>
                      High alert
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  {row.patient_name} · {row.route} · due{" "}
                  {new Date(row.scheduled_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                {row.batch_number && (
                  <Text size="xs" c="dimmed">
                    Batch {row.batch_number}
                    {row.batch_expiry ? ` · exp ${row.batch_expiry}` : ""}
                  </Text>
                )}
              </Stack>
              {canAdminister ? (
                <Button size="xs" tone="primary" onClick={() => setActive(row)}>
                  Administer
                </Button>
              ) : (
                <Text size="xs" c="dimmed">
                  View only
                </Text>
              )}
            </Group>
          </Card>
        ))}
      </Stack>

      {active && (
        <AdministerModal
          opened={active !== null}
          onClose={() => setActive(null)}
          dose={active}
          isSubmitting={update.isPending}
          onSubmit={(input) => update.mutate({ id: active.id, ...input })}
        />
      )}
    </Stack>
  );
}
