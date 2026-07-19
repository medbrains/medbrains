// IPD StewardshipTab — split from infection-control.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { AntibioticRequestStatusType, AntibioticStewardshipRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, Table } from "@/components/ui";
import { infectionControlService } from "@/services/infectionControl.service";

const requestStatusColors: Record<string, BadgeTone> = {
  pending: "warning",
  approved: "success",
  denied: "danger",
  expired: "neutral",
};

export function StewardshipTab() {
  const canCreate = useHasPermission(P.INFECTION_CONTROL.STEWARDSHIP_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [subView, setSubView] = useState<string>("requests");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["ic-stewardship", statusFilter],
    queryFn: () =>
      infectionControlService.listStewardshipRequests({
        request_status: statusFilter ?? undefined,
      }),
  });

  // Feature 4: Antibiogram display
  const { data: cultures = [] } = useQuery({
    queryKey: ["ic-cultures"],
    queryFn: () => infectionControlService.listCultureSurveillance(),
  });

  // Build antibiogram matrix
  const antibiogramData = useMemo(() => {
    const matrix: Record<
      string,
      Record<string, { total: number; resistant: number; intermediate: number; sensitive: number }>
    > = {};
    cultures.forEach((c) => {
      if (!c.organism || !c.result) return;
      const org = c.organism;
      if (!matrix[org]) matrix[org] = {};
      // Parse result as "drug:susceptibility" pattern
      const parts = c.result.split(":");
      if (parts.length === 2) {
        const drug = parts[0];
        const susceptibility = parts[1];
        if (drug && susceptibility) {
          if (!matrix[org][drug])
            matrix[org][drug] = { total: 0, resistant: 0, intermediate: 0, sensitive: 0 };
          matrix[org][drug].total++;
          if (susceptibility.toLowerCase().includes("resist")) matrix[org][drug].resistant++;
          else if (susceptibility.toLowerCase().includes("inter")) matrix[org][drug].intermediate++;
          else if (susceptibility.toLowerCase().includes("sens")) matrix[org][drug].sensitive++;
        }
      }
    });
    return matrix;
  }, [cultures]);

  const [form, setForm] = useState({
    patient_id: "",
    antibiotic_name: "",
    dose: "",
    route: "",
    indication: "",
    culture_sent: false,
    duration_days: undefined as number | undefined,
  });

  const createMut = useMutation({
    mutationFn: () =>
      infectionControlService.createStewardshipRequest({
        patient_id: form.patient_id,
        antibiotic_name: form.antibiotic_name,
        dose: form.dose || undefined,
        route: form.route || undefined,
        indication: form.indication,
        culture_sent: form.culture_sent,
        duration_days: form.duration_days,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-stewardship"] });
      notifications.show({ title: "Request created", message: "", color: "success" });
      close();
    },
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      infectionControlService.reviewStewardshipRequest(id, {
        request_status: status as AntibioticRequestStatusType,
        review_notes: undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-stewardship"] });
      notifications.show({ title: "Request reviewed", message: "", color: "success" });
    },
  });

  const [timeoutId, setTimeoutId] = useState<string | null>(null);
  const [timeoutDecision, setTimeoutDecision] = useState<string | null>("continue");
  const [timeoutNotes, setTimeoutNotes] = useState("");
  const timeoutMut = useMutation({
    mutationFn: (id: string) =>
      infectionControlService.timeoutReviewStewardship(id, {
        decision: timeoutDecision ?? "continue",
        notes: timeoutNotes.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ic-stewardship"] });
      notifications.show({ title: "Time-out review recorded", message: "", color: "success" });
      setTimeoutId(null);
      setTimeoutNotes("");
      setTimeoutDecision("continue");
    },
    onError: (e: Error) =>
      notifications.show({ title: "Failed", message: e.message, color: "danger" }),
  });

  // 48-72h antibiotic time-out is due once an approved antibiotic has run > 72h with no decision yet.
  const timeoutDue = (r: AntibioticStewardshipRequest) =>
    r.request_status === "approved" &&
    !r.timeout_decision &&
    Date.now() - new Date(r.requested_at).getTime() > 72 * 3600 * 1000;

  const columns = [
    {
      key: "antibiotic_name" as const,
      label: "Antibiotic",
      render: (r: AntibioticStewardshipRequest) => <Text fw={500}>{r.antibiotic_name}</Text>,
    },
    {
      key: "indication" as const,
      label: "Indication",
      render: (r: AntibioticStewardshipRequest) => r.indication,
    },
    {
      key: "dose" as const,
      label: "Dose",
      render: (r: AntibioticStewardshipRequest) => r.dose ?? "---",
    },
    {
      key: "request_status" as const,
      label: "Status",
      render: (r: AntibioticStewardshipRequest) => (
        <Badge tone={requestStatusColors[r.request_status] ?? "neutral"}>{r.request_status}</Badge>
      ),
    },
    {
      key: "culture_sent" as const,
      label: "Culture",
      render: (r: AntibioticStewardshipRequest) =>
        r.culture_sent ? (
          <Badge tone="success" size="sm">
            Sent
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            No
          </Badge>
        ),
    },
    {
      key: "requested_at" as const,
      label: "Requested",
      render: (r: AntibioticStewardshipRequest) => new Date(r.requested_at).toLocaleDateString(),
    },
    {
      key: "timeout" as const,
      label: "48-72h review",
      render: (r: AntibioticStewardshipRequest) =>
        r.timeout_decision ? (
          <Badge tone="success" size="sm">
            {r.timeout_decision.replace(/_/g, " ")}
          </Badge>
        ) : timeoutDue(r) ? (
          <Badge tone="danger" size="sm">
            Overdue
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      render: (r: AntibioticStewardshipRequest) =>
        canCreate ? (
          <Group gap="xs">
            {r.request_status === "pending" && (
              <>
                <Button
                  tone="secondary"
                  size="compact-xs"
                  onClick={() => reviewMut.mutate({ id: r.id, status: "approved" })}
                >
                  Approve
                </Button>
                <Button
                  tone="subtle-danger"
                  size="compact-xs"
                  onClick={() => reviewMut.mutate({ id: r.id, status: "denied" })}
                >
                  Deny
                </Button>
              </>
            )}
            {r.request_status === "approved" && !r.timeout_decision && (
              <Button
                tone={timeoutDue(r) ? "danger" : "tertiary"}
                size="compact-xs"
                onClick={() => setTimeoutId(r.id)}
              >
                Time-out review
              </Button>
            )}
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <SegmentedControl
            value={subView}
            onChange={setSubView}
            data={[
              { value: "requests", label: "Requests" },
              { value: "antibiogram", label: "Antibiogram" },
            ]}
          />
          {subView === "requests" && (
            <Select
              placeholder="Status"
              data={["pending", "approved", "denied", "expired"]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              w={160}
            />
          )}
          {subView === "requests" && (
            <Text c="dimmed" size="sm">
              {requests.length} request(s)
            </Text>
          )}
        </Group>
        {canCreate && subView === "requests" && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Request
          </Button>
        )}
      </Group>

      {subView === "requests" ? (
        <DataTable
          columns={columns}
          data={requests}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No stewardship requests"
        />
      ) : (
        <Paper p="md" withBorder>
          <Title order={5} mb="md">
            Antibiogram Matrix
          </Title>
          {Object.keys(antibiogramData).length === 0 ? (
            <Text c="dimmed">No culture surveillance data available</Text>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Organism</Table.Th>
                    {Array.from(
                      new Set(Object.values(antibiogramData).flatMap((org) => Object.keys(org))),
                    ).map((drug) => (
                      <Table.Th key={drug}>{drug}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(antibiogramData).map(([organism, drugs]) => (
                    <Table.Tr key={organism}>
                      <Table.Td fw={500}>{organism}</Table.Td>
                      {Array.from(
                        new Set(Object.values(antibiogramData).flatMap((org) => Object.keys(org))),
                      ).map((drug) => {
                        const data = drugs[drug];
                        if (!data || data.total === 0) return <Table.Td key={drug}>---</Table.Td>;
                        const sensPercent = Math.round((data.sensitive / data.total) * 100);
                        const interPercent = Math.round((data.intermediate / data.total) * 100);
                        const resPercent = Math.round((data.resistant / data.total) * 100);
                        let color: BadgeTone = "neutral";
                        if (sensPercent >= 70) color = "success";
                        else if (sensPercent >= 40) color = "warning";
                        else color = "danger";
                        return (
                          <Table.Td key={drug}>
                            <Badge
                              tone={color}
                              size="sm"
                              style={{ cursor: "help" }}
                              title={`S:${sensPercent}% I:${interPercent}% R:${resPercent}% (n=${data.total})`}
                            >
                              {sensPercent}%
                            </Badge>
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Paper>
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="Antibiotic Stewardship Request"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            required
          />
          <TextInput
            label="Antibiotic Name"
            required
            value={form.antibiotic_name}
            onChange={(e) => setForm({ ...form, antibiotic_name: e.currentTarget.value })}
          />
          <TextInput
            label="Dose"
            value={form.dose}
            onChange={(e) => setForm({ ...form, dose: e.currentTarget.value })}
          />
          <TextInput
            label="Route"
            value={form.route}
            onChange={(e) => setForm({ ...form, route: e.currentTarget.value })}
          />
          <TextInput
            label="Indication"
            required
            value={form.indication}
            onChange={(e) => setForm({ ...form, indication: e.currentTarget.value })}
          />
          <NumberInput
            label="Duration (days)"
            value={form.duration_days ?? ""}
            onChange={(v) => setForm({ ...form, duration_days: v === "" ? undefined : Number(v) })}
          />
          <Switch
            label="Culture Sent"
            checked={form.culture_sent}
            onChange={(e) => setForm({ ...form, culture_sent: e.currentTarget.checked })}
          />
          <Button tone="primary" loading={createMut.isPending} onClick={() => createMut.mutate()}>
            Submit
          </Button>
        </Stack>
      </Drawer>
      <Drawer
        opened={timeoutId !== null}
        onClose={() => setTimeoutId(null)}
        title="Antibiotic time-out review (48-72h)"
        position="right"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Review the antibiotic now that cultures/sensitivities are back and document the
            decision.
          </Text>
          <Select
            label="Decision"
            data={[
              { value: "continue", label: "Continue (still appropriate)" },
              { value: "de_escalate", label: "De-escalate (narrower agent)" },
              { value: "stop", label: "Stop (no longer needed)" },
              { value: "switch_oral", label: "Switch IV → oral" },
              { value: "change", label: "Change (per sensitivities)" },
            ]}
            value={timeoutDecision}
            onChange={setTimeoutDecision}
          />
          <Textarea
            label="Notes"
            value={timeoutNotes}
            onChange={(e) => setTimeoutNotes(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            loading={timeoutMut.isPending}
            onClick={() => timeoutId && timeoutMut.mutate(timeoutId)}
          >
            Record decision
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Bio-waste Tab ───────────────────────────────────────
