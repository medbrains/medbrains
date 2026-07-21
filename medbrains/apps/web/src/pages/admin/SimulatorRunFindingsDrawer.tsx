import { Card, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { SimulatorRunFinding, SimulatorRunSummary } from "@medbrains/types";
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

/** One graded-outcome tile: a big count + a semantic tone label. */
function StatTile({ value, label, tone }: { value: number; label: string; tone: BadgeTone }) {
  return (
    <Card withBorder padding="sm">
      <Stack gap={4} align="center">
        <Text fz={28} fw={700}>
          {value}
        </Text>
        <Badge tone={tone} size="sm">
          {label}
        </Badge>
      </Stack>
    </Card>
  );
}

/**
 * Confidence header: a run is legibly healthy when `server_errors` is 0 — those
 * are real defects, unlike `rejected` (4xx) where the API correctly refused.
 */
function ConfidenceScore({ summary }: { summary: SimulatorRunSummary }) {
  const passed = summary.passed ?? 0;
  const rejected = summary.rejected ?? 0;
  const serverErrors = summary.server_errors ?? 0;
  const total = passed + rejected + serverErrors;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const activityRows: Array<[string, number]> = [
    ["Encounters", (summary.opd_count ?? 0) + (summary.er_count ?? 0)],
    ["Vitals", summary.vitals_count ?? 0],
    ["Diagnoses", summary.diagnoses_count ?? 0],
    ["Prescriptions", summary.prescription_count ?? 0],
    ["Labs", summary.lab_count ?? 0],
    ["Radiology", summary.radiology_count ?? 0],
    ["Pharmacy", summary.pharmacy_count ?? 0],
    ["IPD admits", summary.ipd_admission_count ?? 0],
    ["Triage", summary.triage_count ?? 0],
    ["ER admits", summary.er_admit_count ?? 0],
  ];
  const activity = activityRows.filter(([, v]) => v > 0);

  return (
    <Panel title="Confidence">
      <Group gap="xl" align="center" wrap="nowrap">
        <Stack gap={0}>
          <Text fz={40} fw={700} lh={1}>
            {passRate}%
          </Text>
          <Text size="xs" c="dimmed">
            pass rate · {total} call{total === 1 ? "" : "s"}
          </Text>
        </Stack>
        <Group gap="sm">
          <StatTile value={passed} label="passed" tone="success" />
          <StatTile value={rejected} label="rejected 4xx" tone="neutral" />
          <StatTile value={serverErrors} label="server errors" tone="danger" />
        </Group>
      </Group>
      <Text size="sm" c="dimmed" mt="sm">
        {serverErrors > 0
          ? `${serverErrors} server error${serverErrors === 1 ? "" : "s"} — real defects to investigate.`
          : total > 0
            ? "No server errors — the API handled every call (4xx = correctly refused, not a defect)."
            : "No graded tool calls in this run."}
      </Text>
      {activity.length > 0 ? (
        <Group gap="md" mt="md">
          {activity.map(([label, v]) => (
            <Text key={label} size="xs" c="dimmed">
              {label}: {v}
            </Text>
          ))}
        </Group>
      ) : null}
    </Panel>
  );
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
    // Stream in steps/findings/score while the agent run is still executing.
    refetchInterval: (query) => (query.state.data?.run.status === "running" ? 2000 : false),
  });

  return (
    <Drawer opened={runId !== null} onClose={onClose} title="Run detail" size="lg">
      {data ? (
        <Stack>
          <ConfidenceScore summary={data.run.summary} />
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
