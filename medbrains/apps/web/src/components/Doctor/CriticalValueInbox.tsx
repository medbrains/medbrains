/**
 * The critical values on this doctor's own patients.
 *
 * `listDoctorCriticalAlerts` filters server-side to the encounters this doctor
 * owns, and refuses with 404 when the id is not their own. Until now it had no
 * caller: the only place a panic value appeared was the laboratory's chase
 * list, which is every doctor's alerts at once. A potassium of 7.1 sat in a
 * list of everyone's, and the person who could act on it had no view of their
 * own.
 *
 * The laboratory's list stays where it is — NABL requires the lab to track
 * acknowledgement of every critical value it raises, which is a different job
 * from a clinician acting on their own.
 */
import { Group, Stack, Table, Text, TextInput } from "@mantine/core";
import type { LabCriticalAlert } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, Badge, Button, Modal, toast } from "@/components/ui";
import { labService } from "@/services/lab.service";

/** NABL: a critical value must be communicated AND acknowledged within a target. */
const ACK_TARGET_MINUTES = 30;

function isOverdue(alert: LabCriticalAlert): boolean {
  return (
    !!alert.notified_at &&
    Date.now() - new Date(alert.notified_at).getTime() > ACK_TARGET_MINUTES * 60_000
  );
}

export function CriticalValueInbox({ doctorId }: { doctorId: string }) {
  const queryClient = useQueryClient();
  // Acknowledgement carries a read-back: the doctor repeats the value to prove
  // they heard it correctly. Mirrors the modal on the lab order detail rather
  // than inventing a second way to do the same regulated step.
  const [ackAlert, setAckAlert] = useState<LabCriticalAlert | null>(null);
  const [readback, setReadback] = useState("");
  const {
    data: alerts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["doctor-critical-alerts", doctorId],
    queryFn: () => labService.listDoctorCriticalAlerts(doctorId),
    enabled: doctorId.length > 0,
    refetchInterval: 30_000,
  });

  const acknowledge = useMutation({
    mutationFn: (vars: { alertId: string; readback_value: string }) =>
      labService.acknowledgeCriticalAlert(vars.alertId, { readback_value: vars.readback_value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-critical-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["lab-critical-alerts"] });
      setAckAlert(null);
      setReadback("");
      toast.success("Critical value acknowledged");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not acknowledge" }),
  });

  // An outage must not read as "nothing critical". That sentence is the one
  // thing this panel must never say untruthfully.
  if (isError) {
    return (
      <Alert tone="danger" title="Critical values could not be read">
        This is a failed read, not an empty list. Do not treat it as "nothing outstanding" — check
        the laboratory's own list before acting.
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Checking for critical values…
      </Text>
    );
  }

  const outstanding = alerts.filter((a) => !a.acknowledged_at);

  if (outstanding.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No outstanding critical values on your patients.
      </Text>
    );
  }

  const overdue = outstanding.filter(isOverdue);

  return (
    <Stack gap="sm">
      {overdue.length > 0 && (
        <Alert
          tone="danger"
          title={`${overdue.length} past the ${ACK_TARGET_MINUTES}-minute target`}
        >
          Each of these is a result the laboratory has already telephoned through.
        </Alert>
      )}
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Patient</Table.Th>
            <Table.Th>Parameter</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th>Notified</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...outstanding]
            .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)))
            .map((alert) => (
              <Table.Tr key={alert.id}>
                <Table.Td>
                  <PatientNameCell patientId={alert.patient_id} />
                </Table.Td>
                <Table.Td>{alert.parameter_name}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text fw={600}>{alert.value}</Text>
                    <Badge tone="danger" size="sm">
                      {alert.flag}
                    </Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {alert.notified_at ? (
                    <Badge tone={isOverdue(alert) ? "danger" : "neutral"} size="sm">
                      {new Date(alert.notified_at).toLocaleTimeString()}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      not yet called
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Button
                    size="compact-sm"
                    tone="primary"
                    leftSection={<IconAlertTriangle size={14} />}
                    onClick={() => {
                      setAckAlert(alert);
                      setReadback("");
                    }}
                  >
                    Acknowledge
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={ackAlert !== null}
        onClose={() => setAckAlert(null)}
        title="Acknowledge critical value"
        size="sm"
      >
        {ackAlert && (
          <Stack gap="sm">
            <Text size="sm">
              Read back the value for <b>{ackAlert.parameter_name}</b> to confirm you received it
              correctly.
            </Text>
            <TextInput
              label="Read-back value"
              placeholder="Type the value you were told"
              value={readback}
              onChange={(event) => setReadback(event.currentTarget.value)}
            />
            <Button
              tone="primary"
              loading={acknowledge.isPending}
              disabled={!readback.trim()}
              onClick={() =>
                acknowledge.mutate({ alertId: ackAlert.id, readback_value: readback.trim() })
              }
            >
              Acknowledge
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
