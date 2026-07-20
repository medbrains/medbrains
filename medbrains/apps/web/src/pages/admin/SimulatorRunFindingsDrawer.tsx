import { Card, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { SimulatorRunFinding } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, type BadgeTone, Drawer, Panel, Table } from "@/components/ui";

const SEV_TONE: Record<SimulatorRunFinding["severity"], BadgeTone> = {
  info: "neutral",
  low: "info",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

const VERDICT_TONE: Record<SimulatorRunFinding["verdict"], BadgeTone> = {
  confirmed: "danger",
  plausible: "warning",
  unverified: "neutral",
  rejected: "neutral",
};

// Confirmed defects first, rejected (verifier dismissed) last.
const VERDICT_RANK: Record<SimulatorRunFinding["verdict"], number> = {
  confirmed: 0,
  plausible: 1,
  unverified: 2,
  rejected: 3,
};

function cellLabel(cell: Record<string, unknown>): string {
  const role = typeof cell.role === "string" ? cell.role : "";
  const locale = typeof cell.locale === "string" ? cell.locale : "";
  return [role, locale].filter(Boolean).join(" · ");
}

/** Right-side drawer showing an agent run's findings + step trace. */
export function SimulatorRunFindingsDrawer({
  runId,
  onClose,
}: {
  runId: string | null;
  onClose: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["simulator-run", runId],
    queryFn: () => api.getSimulatorRun(runId as string),
    enabled: runId !== null,
  });

  return (
    <Drawer opened={runId !== null} onClose={onClose} title="Run detail" size="lg">
      {data ? (
        <Stack>
          <Panel
            title={`Findings — ${
              data.findings.filter((f) => f.verdict === "confirmed").length
            } confirmed of ${data.findings.length}`}
          >
            {data.findings.length > 0 ? (
              <Stack gap="sm">
                {[...data.findings]
                  .sort((a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict])
                  .map((f) => (
                    <Card key={f.id} withBorder padding="sm">
                      <Group justify="space-between" mb={4} wrap="nowrap">
                        <Group gap="xs">
                          <Badge tone={VERDICT_TONE[f.verdict]} size="sm">
                            {f.verdict}
                          </Badge>
                          <Badge tone={SEV_TONE[f.severity]} size="sm">
                            {f.severity}
                          </Badge>
                          <Badge tone="neutral" size="sm">
                            {f.kind}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {cellLabel(f.cell)}
                        </Text>
                      </Group>
                      <Text size="sm">{f.message}</Text>
                    </Card>
                  ))}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">
                No findings — the agents completed cleanly, or this was a scripted run.
              </Text>
            )}
          </Panel>

          <Panel title={`Steps (${data.steps.length})`}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Action</Table.Th>
                  <Table.Th>Result</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.steps.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      <Text size="sm">{s.step_type}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={s.success ? "success" : "danger"} size="sm">
                        {s.success ? "ok" : "failed"}
                      </Badge>
                      {s.error ? (
                        <Text size="xs" c="dimmed">
                          {s.error}
                        </Text>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Panel>
        </Stack>
      ) : (
        <Text c="dimmed">Loading…</Text>
      )}
    </Drawer>
  );
}
