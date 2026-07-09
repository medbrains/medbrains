import { Card, Divider, Group, SegmentedControl, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { MedReconciliationItem, MedReconciliationView } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, IconButton, Input, Select } from "@/components/ui";
import { medReconciliationService } from "@/services/medReconciliation.service";

const DECISIONS = ["continue", "modify", "stop", "hold"];
const SOURCES = ["home", "opd", "transfer", "other"];
const TRANSITIONS = ["admission", "transfer", "discharge"];

interface DraftRow {
  drug_name: string;
  dose: string;
  frequency: string;
  source: string;
}

const emptyRow = (): DraftRow => ({ drug_name: "", dose: "", frequency: "", source: "home" });

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Medication reconciliation (IPSG.6). Build the med list at a transition, decide each one, and the
 *  server blocks completion until every medication has a decision. */
export function MedReconciliationPanel({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const key = ["med-reconciliations", patientId];
  const [transition, setTransition] = useState("admission");
  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);

  const { data: recons = [] } = useQuery({
    queryKey: key,
    queryFn: () => medReconciliationService.listMedReconciliations(patientId),
    enabled: !!patientId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const onError = (e: Error) =>
    notifications.show({ title: "Action failed", message: e.message, color: "danger" });

  const create = useMutation({
    mutationFn: () =>
      medReconciliationService.createMedReconciliation({
        patient_id: patientId,
        transition_type: transition,
        items: rows
          .filter((r) => r.drug_name.trim())
          .map((r) => ({
            drug_name: r.drug_name.trim(),
            dose: r.dose.trim() || undefined,
            frequency: r.frequency.trim() || undefined,
            source: r.source,
          })),
      }),
    onSuccess: () => {
      void invalidate();
      setRows([emptyRow()]);
    },
    onError,
  });

  const decide = useMutation({
    mutationFn: (vars: { id: string; decision: string }) =>
      medReconciliationService.decideMedItem(vars.id, { decision: vars.decision }),
    onSuccess: () => void invalidate(),
    onError,
  });

  const complete = useMutation({
    mutationFn: (id: string) => medReconciliationService.completeMedReconciliation(id),
    onSuccess: () => {
      void invalidate();
      notifications.show({ title: "Reconciliation completed", message: "", color: "success" });
    },
    onError,
  });

  const active = recons.find(
    (r: MedReconciliationView) => r.reconciliation.status === "in_progress",
  );
  const hasDraftDrug = rows.some((r) => r.drug_name.trim());

  return (
    <Stack gap="md">
      {!active && (
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={600} size="sm">
              New reconciliation
            </Text>
            <SegmentedControl
              data={TRANSITIONS.map((t) => ({ value: t, label: titleCase(t) }))}
              value={transition}
              onChange={setTransition}
            />
            {rows.map((row, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: draft rows have no stable id
              <Group key={i} align="flex-end" gap="xs">
                <Input
                  label={i === 0 ? "Medication" : undefined}
                  placeholder="Drug name"
                  value={row.drug_name}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((r, j) => (j === i ? { ...r, drug_name: e.currentTarget.value } : r)),
                    )
                  }
                  style={{ flex: 2 }}
                />
                <Input
                  label={i === 0 ? "Dose" : undefined}
                  placeholder="500 mg"
                  value={row.dose}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((r, j) => (j === i ? { ...r, dose: e.currentTarget.value } : r)),
                    )
                  }
                  style={{ flex: 1 }}
                />
                <Input
                  label={i === 0 ? "Frequency" : undefined}
                  placeholder="BD"
                  value={row.frequency}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((r, j) => (j === i ? { ...r, frequency: e.currentTarget.value } : r)),
                    )
                  }
                  style={{ flex: 1 }}
                />
                <Select
                  label={i === 0 ? "Source" : undefined}
                  data={SOURCES}
                  value={row.source}
                  onChange={(v) =>
                    setRows((p) => p.map((r, j) => (j === i ? { ...r, source: v ?? "home" } : r)))
                  }
                  w={110}
                />
                <IconButton
                  aria-label="Remove medication"
                  tone="default"
                  onClick={() => setRows((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))}
                >
                  <IconTrash size={16} />
                </IconButton>
              </Group>
            ))}
            <Group>
              <Button
                tone="tertiary"
                leftSection={<IconPlus size={16} />}
                onClick={() => setRows((p) => [...p, emptyRow()])}
              >
                Add medication
              </Button>
              <Button
                tone="primary"
                loading={create.isPending}
                disabled={!hasDraftDrug}
                onClick={() => create.mutate()}
              >
                Start reconciliation
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {active && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text fw={600}>
                {titleCase(active.reconciliation.transition_type)} reconciliation
              </Text>
              <Badge tone="warning">In progress</Badge>
            </Group>
            <Divider />
            {active.items.map((item: MedReconciliationItem) => (
              <SimpleGrid key={item.id} cols={{ base: 1, sm: 2 }} spacing="xs">
                <Text size="sm">
                  {item.drug_name}
                  {item.dose ? ` · ${item.dose}` : ""}
                  {item.frequency ? ` · ${item.frequency}` : ""}{" "}
                  <Text span size="xs" c="dimmed">
                    ({item.source})
                  </Text>
                </Text>
                <Select
                  aria-label={`Decision for ${item.drug_name}`}
                  data={DECISIONS}
                  placeholder="Decide…"
                  value={item.decision}
                  onChange={(v) => v && decide.mutate({ id: item.id, decision: v })}
                />
              </SimpleGrid>
            ))}
            <Group justify="flex-end">
              <Button
                tone="primary"
                loading={complete.isPending}
                disabled={active.items.some((i: MedReconciliationItem) => !i.decision)}
                onClick={() => complete.mutate(active.reconciliation.id)}
              >
                Complete reconciliation
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {recons.some((r: MedReconciliationView) => r.reconciliation.status === "completed") && (
        <Stack gap={4}>
          <Text fw={600} size="sm">
            Completed
          </Text>
          {recons
            .filter((r: MedReconciliationView) => r.reconciliation.status === "completed")
            .map((r: MedReconciliationView) => (
              <Text key={r.reconciliation.id} size="xs" c="dimmed">
                {r.reconciliation.transition_type} —{" "}
                {r.reconciliation.reconciled_at
                  ? new Date(r.reconciliation.reconciled_at).toLocaleString()
                  : ""}{" "}
                · {r.items.length} medication(s)
              </Text>
            ))}
        </Stack>
      )}
    </Stack>
  );
}
