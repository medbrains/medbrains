// Discharge workflow wizard — step-by-step checklist that drives the
// new ipd_discharge_workflows table (migration 0108). Replaces the
// scattered "Discharge / Discharge Summary / Discharge TAT" tabs as
// a single guided flow.
//
// Steps map 1:1 to the DB columns: each click stamps `<step>_at` and
// `<step>_by`. Idempotent on the server — re-clicking is harmless.
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import type { IpdDischargeStep, IpdDischargeWorkflow } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ipdService } from "../../services/ipd.service";

const STEPS: { key: IpdDischargeStep; label: string; description: string }[] = [
  {
    key: "discharge_ordered",
    label: "Discharge ordered",
    description: "Attending physician has formally ordered discharge.",
  },
  {
    key: "bill_closed",
    label: "Final bill closed",
    description: "All charges posted, deposits adjusted, GST invoice issued.",
  },
  {
    key: "rx_dispensed",
    label: "Take-home meds dispensed",
    description: "Pharmacy has issued discharge medications and bagged.",
  },
  {
    key: "counseling_done",
    label: "Patient / family counseled",
    description: "Diet, activity, wound care, danger signs, follow-up reviewed.",
  },
  {
    key: "card_printed",
    label: "Discharge card printed",
    description: "Patient-facing summary handed over (separate from medical summary).",
  },
  {
    key: "bed_released",
    label: "Bed released",
    description: "Housekeeping notified; bed marked vacant_dirty until cleaned.",
  },
  {
    key: "completed",
    label: "Discharge complete",
    description: "All checklist items signed off; admission status flips to 'discharged'.",
  },
];

function stamp(
  workflow: IpdDischargeWorkflow | null | undefined,
  step: IpdDischargeStep,
): string | null {
  if (!workflow) return null;
  const map: Record<IpdDischargeStep, string | null> = {
    discharge_ordered: workflow.discharge_ordered_at,
    bill_closed: workflow.bill_closed_at,
    rx_dispensed: workflow.rx_dispensed_at,
    counseling_done: workflow.counseling_done_at,
    card_printed: workflow.card_printed_at,
    bed_released: workflow.bed_released_at,
    completed: workflow.completed_at,
  };
  return map[step];
}

interface DischargeWorkflowWizardProps {
  admissionId: string;
}

export function DischargeWorkflowWizard({ admissionId }: DischargeWorkflowWizardProps) {
  const queryClient = useQueryClient();
  const { data: workflow } = useQuery({
    queryKey: ["ipd-discharge-workflow", admissionId],
    queryFn: () => ipdService.getIpdDischargeWorkflow(admissionId),
  });

  const stepMutation = useMutation({
    mutationFn: (step: IpdDischargeStep) =>
      ipdService.updateIpdDischargeStep(admissionId, { step }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-workflow", admissionId] });
    },
  });

  return (
    <Stack gap="sm">
      <Text fw={700}>Discharge workflow</Text>
      <Text size="xs" c="dimmed">
        Each step records the time and the staff member who completed it. Steps are idempotent —
        re-clicking a completed step is a no-op.
      </Text>
      {STEPS.map((step) => {
        const at = stamp(workflow, step.key);
        const done = !!at;
        return (
          <Card key={step.key} withBorder padding="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Group gap="xs">
                  <Text fw={600} size="sm">
                    {step.label}
                  </Text>
                  {done && (
                    <Badge color="success" variant="light" size="sm">
                      Done
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {step.description}
                </Text>
                {at && (
                  <Text size="xs" c="dimmed" ff="monospace">
                    Completed: {new Date(at).toLocaleString()}
                  </Text>
                )}
              </Stack>
              {!done && (
                <Button
                  size="xs"
                  variant="light"
                  loading={stepMutation.isPending && stepMutation.variables === step.key}
                  onClick={() => stepMutation.mutate(step.key)}
                >
                  Mark complete
                </Button>
              )}
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}
