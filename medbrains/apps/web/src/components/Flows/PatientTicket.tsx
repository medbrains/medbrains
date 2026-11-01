/**
 * A patient's discharge ticket (RFC-SOP-FLOWS §5.2 #3): the station they are
 * at, what it waits for, who holds it, how long they have been there, and the
 * switch that routed them there. Links to the switchboard and the chart.
 */
import { Anchor, Group, Loader, Stack, Text } from "@mantine/core";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type { FlowTicket } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlayerPlay, IconRoute, IconUserCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Button, Panel, Select, toast } from "@/components/ui";
import { duration } from "@/pages/admin/flows/duration";
import { DISCHARGE_FLOW, sopFlowsService } from "@/services/sopFlows.service";

const STOP = {
  done: { text: "Done", tone: "success" },
  current: { text: "Here now", tone: "primary" },
  ahead: { text: "Ahead", tone: "neutral" },
  skipped: { text: "Not on route", tone: "neutral" },
} as const;

const TYPES = [
  { value: "normal", label: "Normal" },
  { value: "lama", label: "LAMA" },
  { value: "dama", label: "DAMA" },
  { value: "referred", label: "Referred" },
  { value: "absconded", label: "Absconded" },
  { value: "deceased", label: "Deceased" },
];

interface PatientTicketProps {
  admissionId: string;
  patientId: string;
}

export function PatientTicket({ admissionId, patientId }: PatientTicketProps) {
  const queryClient = useQueryClient();
  const canView = useHasPermission(P.FLOWS.VIEW);
  const canStart = useHasPermission(P.IPD.DISCHARGE_TAT.UPDATE);
  const canDischarge = useHasPermission(P.IPD.DISCHARGE_CREATE);
  const role = useAuthStore((s) => s.user?.role);
  const [type, setType] = useState("normal");
  const key = ["flow-ticket", DISCHARGE_FLOW, admissionId];
  const ticket = useQuery({
    queryKey: key,
    queryFn: () => sopFlowsService.ticket(DISCHARGE_FLOW, admissionId),
    enabled: canView,
  });
  const done = (t: FlowTicket) => queryClient.setQueryData(key, t);
  const fail = (title: string) => (e: Error) => {
    toast.error(e.message, { title });
    void queryClient.invalidateQueries({ queryKey: key });
  };
  const start = useMutation({
    mutationFn: () => sopFlowsService.start(DISCHARGE_FLOW, admissionId),
    onSuccess: done,
    onError: fail("Could not start discharge"),
  });
  const run = useMutation({
    mutationFn: (station: string) =>
      sopFlowsService.run(DISCHARGE_FLOW, admissionId, {
        station,
        input: { discharge_type: type },
      }),
    onSuccess: (t) => {
      done(t);
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
    },
    onError: fail("Discharge was refused"),
  });
  const signOff = useMutation({
    mutationFn: (station: string) =>
      sopFlowsService.completeTask(DISCHARGE_FLOW, admissionId, station),
    onSuccess: done,
    onError: fail("Could not sign off"),
  });

  if (!canView) return null;
  if (ticket.isLoading) return <Loader size="sm" aria-label="Loading the discharge ticket" />;
  if (ticket.error) {
    return (
      <Alert tone="danger" title="Could not load the discharge ticket">
        <Group gap="xs">
          <Text size="sm">{ticket.error.message}</Text>
          <Button tone="secondary" size="xs" onClick={() => void ticket.refetch()}>
            Try again
          </Button>
        </Group>
      </Alert>
    );
  }
  const t = ticket.data;
  if (!t) {
    return (
      <Panel
        title="Discharge flow"
        description="Not started. Starting it opens the discharge checklist and TAT log."
      >
        {canStart && (
          <Button
            tone="primary"
            leftSection={<IconRoute size={16} />}
            loading={start.isPending}
            onClick={() => start.mutate()}
          >
            Start discharge
          </Button>
        )}
      </Panel>
    );
  }
  const c = t.current;
  return (
    <Panel
      title="Discharge ticket"
      description={`Version ${t.version} of the discharge flow${t.status === "completed" ? " · completed" : ""}`}
      actions={
        <Group gap="sm">
          <Anchor component={Link} to={`/admin/flows/${DISCHARGE_FLOW}`} size="sm">
            Switchboard
          </Anchor>
          <Anchor component={Link} to={`/patients/${patientId}`} size="sm">
            Patient chart
          </Anchor>
        </Group>
      }
    >
      <Stack gap="sm">
        {t.last_error && (
          <Alert tone="danger" title={`${t.last_error.name} did not go through`}>
            {t.last_error.reason}
          </Alert>
        )}
        {c && (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" ff="var(--mb-font-mono)">
              {c.path}
            </Text>
            <Group gap="xs">
              <Text fw={700} size="lg">
                {c.name}
              </Text>
              <Badge tone={c.overdue ? "danger" : "neutral"}>
                {duration(c.minutes)} here{c.overdue ? " · overdue" : ""}
              </Badge>
            </Group>
            <Text size="sm">Held by: {c.holder}</Text>
            {c.outstanding.length > 0 && (
              <Text size="sm">Waiting for: {c.outstanding.join("; ")}</Text>
            )}
            {c.routed_by && (
              <Text size="sm">
                Routed here by the switch "{c.routed_by}".{" "}
                <Anchor component={Link} to={`/admin/flows/${DISCHARGE_FLOW}`}>
                  See the switch
                </Anchor>
              </Text>
            )}
            {c.kind === "action" && canDischarge && (
              <Group align="flex-end" gap="xs">
                <Select
                  label="Discharge type"
                  data={TYPES}
                  value={type}
                  onChange={(v) => setType(v ?? "normal")}
                  allowDeselect={false}
                />
                <Button
                  tone="primary"
                  leftSection={<IconPlayerPlay size={16} />}
                  loading={run.isPending}
                  onClick={() => run.mutate(c.key)}
                >
                  Discharge patient
                </Button>
              </Group>
            )}
            {c.kind === "task" && c.key === "ms_signoff" && role === "medical_superintendent" && (
              <Group>
                <Button
                  tone="primary"
                  leftSection={<IconUserCheck size={16} />}
                  loading={signOff.isPending}
                  onClick={() => signOff.mutate(c.key)}
                >
                  Sign off discharge
                </Button>
              </Group>
            )}
          </Stack>
        )}
        <Group gap={6} aria-label="Stops on this discharge">
          {t.stops
            .filter((s) => s.state !== "skipped")
            .map((s) => (
              <Badge
                key={s.key}
                tone={STOP[s.state].tone}
                variant={s.state === "current" ? "filled" : "light"}
              >
                {s.name}: {STOP[s.state].text}
              </Badge>
            ))}
        </Group>
      </Stack>
    </Panel>
  );
}
