/**
 * Bedside monitor readings waiting for the nurse. A reading is charted only
 * when confirmed -- with the ACVPU and oxygen a monitor cannot see -- and is
 * then scored like any charted set. One the nurse knows is wrong (probe off,
 * cuff on the wrong limb) is discarded with a reason.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { EwsScoringInputs, EwsView, MonitorReading } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EwsInputs } from "@/components/EarlyWarning/EwsInputs";
import { Alert, Badge, Button, Input, Modal, Table, toast } from "@/components/ui";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

interface MonitorReadingsPanelProps {
  encounterId: string;
  canRecord: boolean;
  onScored: (ews: EwsView) => void;
}

function values(r: MonitorReading): string {
  return [
    r.pulse != null && `HR ${r.pulse}`,
    r.spo2 != null && `SpO₂ ${r.spo2}%`,
    r.systolic_bp != null && `BP ${r.systolic_bp}/${r.diastolic_bp ?? "—"}`,
    r.respiratory_rate != null && `RR ${r.respiratory_rate}`,
    r.temperature != null && `T ${r.temperature} °C`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function MonitorReadingsPanel({
  encounterId,
  canRecord,
  onScored,
}: MonitorReadingsPanelProps) {
  const qc = useQueryClient();
  const key = ["monitor-readings", encounterId];
  const readings = useQuery({
    queryKey: key,
    queryFn: () => nurseActivitiesService.listMonitorReadings(encounterId),
    refetchInterval: 60_000,
  });
  const [confirming, setConfirming] = useState<MonitorReading | null>(null);
  const [discarding, setDiscarding] = useState<MonitorReading | null>(null);
  const [inputs, setInputs] = useState<EwsScoringInputs>({});
  const [reason, setReason] = useState("");
  const done = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["nurse-vitals", encounterId] });
    setConfirming(null);
    setDiscarding(null);
    setInputs({});
    setReason("");
  };
  const confirm = useMutation({
    mutationFn: (r: MonitorReading) => nurseActivitiesService.confirmMonitorReading(r.id, inputs),
    onSuccess: (row) => {
      onScored(row.ews);
      done();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not charted" }),
  });
  const discard = useMutation({
    mutationFn: (r: MonitorReading) => nurseActivitiesService.discardMonitorReading(r.id, reason),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message, { title: "Not discarded" }),
  });

  if (readings.isError) {
    return (
      <Alert tone="danger" title="Monitor readings could not be loaded">
        {(readings.error as Error).message}
      </Alert>
    );
  }
  if (!readings.data?.length) return null;

  return (
    <Stack gap="xs">
      <Text fw={600}>Monitor readings to confirm ({readings.data.length})</Text>
      <Table aria-label="Monitor readings to confirm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Measured</Table.Th>
            <Table.Th>Monitor</Table.Th>
            <Table.Th>Readings</Table.Th>
            <Table.Th>Action</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {readings.data.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{new Date(r.observed_at).toLocaleString()}</Table.Td>
              <Table.Td>{r.device_name}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Text size="sm">{values(r)}</Text>
                  {r.is_abnormal && <Badge tone="danger">Abnormal</Badge>}
                </Group>
              </Table.Td>
              <Table.Td>
                {canRecord && (
                  <Group gap="xs">
                    <Button tone="primary" size="xs" onClick={() => setConfirming(r)}>
                      Confirm
                    </Button>
                    <Button tone="ghost" size="xs" onClick={() => setDiscarding(r)}>
                      Discard
                    </Button>
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Modal
        opened={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Chart monitor reading"
      >
        {confirming && (
          <Stack gap="sm">
            <Text size="sm">{values(confirming)}</Text>
            <EwsInputs value={inputs} onChange={setInputs} />
            <Button
              tone="primary"
              loading={confirm.isPending}
              onClick={() => confirm.mutate(confirming)}
            >
              Chart and score
            </Button>
          </Stack>
        )}
      </Modal>
      <Modal
        opened={discarding !== null}
        onClose={() => setDiscarding(null)}
        title="Discard monitor reading"
      >
        {discarding && (
          <Stack gap="sm">
            <Text size="sm">{values(discarding)}</Text>
            <Input
              label="Reason"
              placeholder="e.g. probe off, cuff on the drip arm"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Button
              tone="danger"
              disabled={reason.trim().length < 3}
              loading={discard.isPending}
              onClick={() => discard.mutate(discarding)}
            >
              Discard
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
