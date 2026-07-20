import { Card, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { P, type SimulatorProfile, type SimulatorRun } from "@medbrains/types";
import { IconFlask, IconListDetails, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  NumberField,
  Table,
} from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { SimulatorAgentRunner } from "./SimulatorAgentRunner";
import { SimulatorRunFindingsDrawer } from "./SimulatorRunFindingsDrawer";

/** A realistic OPD-heavy demo profile — all output is flagged is_dummy. */
function demoProfile(patients: number): SimulatorProfile {
  return {
    patients,
    opd_pct: 0.9,
    er_pct: 0.1,
    branches: {
      lab_pct: 0.25,
      rad_pct: 0.15,
      ipd_escalation_pct: 0.1,
      rx_pct: 0.7,
      dispense_pct: 0.8,
    },
    er: { mlc_pct: 0.15, admit_pct: 0.3, triage_mix: { red: 0.1, yellow: 0.35, green: 0.55 } },
    approval_mode: "auto",
  };
}

const STATUS_TONE: Record<SimulatorRun["status"], BadgeTone> = {
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};

function runTotals(run: SimulatorRun): number {
  const s = run.summary;
  return (s.opd_count ?? 0) + (s.er_count ?? 0);
}

export function SimulatorPage() {
  useRequirePermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [count, setCount] = useState<number | string>(10);
  const [detailRunId, setDetailRunId] = useState<string | null>(null);

  const { data: runs = [] } = useQuery({
    queryKey: ["simulator-runs"],
    queryFn: () => api.listSimulatorRuns({ limit: 10 }),
    // Keep the list fresh while a run is in progress (it's async).
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.status === "running") ? 2000 : false,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const schedule = await api.createSimulatorSchedule({
        name: "Sample data",
        description: "One-off demo data generation",
        profile: demoProfile(Number(count) || 1),
      });
      return api.runSimulatorNow(schedule.id);
    },
    onSuccess: () => {
      toast.success("Generating sample data…", {
        title: "Started",
      });
      void queryClient.invalidateQueries({ queryKey: ["simulator-runs"] });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Could not generate sample data" }),
  });

  const purge = useMutation({
    mutationFn: (id: string) => api.rejectSimulatorRun(id),
    onSuccess: (res) => {
      toast.success(`Removed ${res.deleted_rows} demo records`, { title: "Purged" });
      void queryClient.invalidateQueries({ queryKey: ["simulator-runs"] });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Purge failed" }),
  });

  return (
    <Stack>
      <PageHeader
        title="Sample / Demo Data"
        subtitle="Populate the app with realistic demo activity so you can explore it before going live."
      />

      <Alert tone="info" title="How it works">
        Demo data is generated around your existing patients — register at least one real patient
        first. Everything created is flagged as demo (is_dummy), so it's hidden from live worklists
        and regulator reports, and you can purge any run with one click.
      </Alert>

      <Card withBorder padding="lg">
        <Group align="flex-end" gap="md">
          <NumberField
            label="Patients to simulate"
            description="A day of OPD/ER activity, labs, prescriptions and vitals around this many patients."
            value={count}
            onChange={setCount}
            min={1}
            max={500}
            w={240}
          />
          <Button
            tone="primary"
            leftSection={<IconFlask size={16} />}
            onClick={() => generate.mutate()}
            loading={generate.isPending}
          >
            Generate sample data
          </Button>
        </Group>
      </Card>

      <SimulatorAgentRunner />

      <Card withBorder padding="lg">
        <Text fw={600} mb="sm">
          Recent runs
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Started</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Encounters</Table.Th>
              <Table.Th>Labs</Table.Th>
              <Table.Th>Rx</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {runs.length > 0 ? (
              runs.map((run) => (
                <Table.Tr key={run.id}>
                  <Table.Td>
                    <Text size="sm">{new Date(run.started_at).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={STATUS_TONE[run.status]} size="sm">
                      {run.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{runTotals(run)}</Table.Td>
                  <Table.Td>{run.summary.lab_count ?? 0}</Table.Td>
                  <Table.Td>{run.summary.prescription_count ?? 0}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" justify="flex-end">
                      <IconButton
                        tone="default"
                        aria-label="View this run's findings and steps"
                        onClick={() => setDetailRunId(run.id)}
                      >
                        <IconListDetails size={16} />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        aria-label="Purge this run's demo data"
                        onClick={() => purge.mutate(run.id)}
                        loading={purge.isPending}
                        disabled={run.status === "running"}
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="lg">
                    No sample data generated yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <SimulatorRunFindingsDrawer runId={detailRunId} onClose={() => setDetailRunId(null)} />
    </Stack>
  );
}
