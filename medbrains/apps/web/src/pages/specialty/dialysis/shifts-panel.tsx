/**
 * The day's dialysis shifts: who is on which machine, and booking a patient
 * onto a free machine of their serology.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DialysisSerology, type DialysisShift, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, Card, Input, Select, Table, toast } from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import { SEROLOGY_OPTIONS, SHIFT_OPTIONS, serologyLabel, todayIso } from "./labels";

export function ShiftsPanel() {
  const qc = useQueryClient();
  const canBook = useHasPermission(P.SPECIALTY.OTHER.DIALYSIS_MANAGE);
  const [date, setDate] = useState(todayIso());
  const [patientId, setPatientId] = useState("");
  const [machineId, setMachineId] = useState<string | null>(null);
  const [shift, setShift] = useState<DialysisShift>("morning");
  const [serology, setSerology] = useState<DialysisSerology>("none");
  const slots = useQuery({
    queryKey: ["dialysis-slots", date],
    queryFn: () => specialtyService.listDialysisSlots(date),
  });
  const machines = useQuery({
    queryKey: ["dialysis-machines"],
    queryFn: specialtyService.listDialysisMachines,
  });

  const book = useMutation({
    mutationFn: specialtyService.bookDialysisSlot,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dialysis-slots"] });
      setPatientId("");
      toast.success("Shift booked");
    },
  });
  const cancel = useMutation({
    mutationFn: specialtyService.cancelDialysisSlot,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dialysis-slots"] }),
  });

  // Only active machines kept for this patient's serology are offered.
  const fitting = (machines.data ?? [])
    .filter((m) => m.status === "active" && m.serology === serology)
    .map((m) => ({ value: m.id, label: `${m.code} · ${m.name}` }));

  return (
    <Stack gap="md">
      <Input
        label="Day"
        type="date"
        value={date}
        onChange={(e) => setDate(e.currentTarget.value)}
        w={200}
      />
      {slots.isError ? (
        <Alert tone="danger">Could not load the shifts: {slots.error.message}</Alert>
      ) : (
        <Table aria-label="Dialysis shifts">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Shift</Table.Th>
              <Table.Th>Machine</Table.Th>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Serology</Table.Th>
              <Table.Th>Status</Table.Th>
              {canBook && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(slots.data ?? []).map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>{s.shift}</Table.Td>
                <Table.Td>{s.machine_code}</Table.Td>
                <Table.Td>
                  {s.patient_name ?? "—"} {s.uhid ? `(${s.uhid})` : ""}
                </Table.Td>
                <Table.Td>
                  <Badge tone={s.serology === "none" ? "neutral" : "warning"}>
                    {serologyLabel(s.serology)}
                  </Badge>
                </Table.Td>
                <Table.Td>{s.status}</Table.Td>
                {canBook && (
                  <Table.Td>
                    {s.status === "booked" && (
                      <Button size="xs" tone="danger-ghost" onClick={() => cancel.mutate(s.id)}>
                        Cancel
                      </Button>
                    )}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {(slots.data?.length ?? 0) === 0 && !slots.isPending && !slots.isError && (
        <Text size="sm" c="dimmed">
          No one is booked for this day yet.
        </Text>
      )}
      {canBook && (
        <Card padding="md" withBorder>
          <Stack gap="sm">
            <Text fw={600}>Book a shift</Text>
            <PatientSearchSelect value={patientId} onChange={setPatientId} required />
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Select
                label="Patient serology"
                data={SEROLOGY_OPTIONS}
                value={serology}
                allowDeselect={false}
                onChange={(v) => {
                  if (v) {
                    setSerology(v as DialysisSerology);
                    setMachineId(null);
                  }
                }}
              />
              <Select
                label="Shift"
                data={SHIFT_OPTIONS}
                value={shift}
                allowDeselect={false}
                onChange={(v) => v && setShift(v as DialysisShift)}
              />
              <Select
                label="Machine"
                data={fitting}
                value={machineId}
                onChange={setMachineId}
                placeholder={fitting.length ? "Choose" : "No active machine for this serology"}
              />
            </SimpleGrid>
            {book.isError && <Alert tone="danger">{book.error.message}</Alert>}
            <Group justify="flex-end">
              <Button
                tone="primary"
                loading={book.isPending}
                disabled={!patientId || !machineId}
                onClick={() =>
                  machineId &&
                  book.mutate({
                    machine_id: machineId,
                    patient_id: patientId,
                    slot_date: date,
                    shift,
                    serology,
                  })
                }
              >
                Book
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
