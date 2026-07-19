// PATIENT MergeTab — split from patient-detail.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { PatientMergeFormInput } from "@medbrains/schemas";
import { patientMergeFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { Patient, PatientMergeHistory } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, Table } from "@/components/ui";
import {
  DEFAULT_PATIENT_MERGE_FORM_VALUES,
  toMergePatientRequest,
} from "@/forms/patient-detail.form";
import { patientDetailService } from "@/services/patientDetail.service";
import { formatDate } from "./shared";

export function MergeTab({ patient }: { patient: Patient }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<Patient | null>(null);
  const [confirmOpen, confirmHandlers] = useDisclosure(false);
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PatientMergeFormInput>({
    resolver: zodResolver(patientMergeFormSchema),
    defaultValues: DEFAULT_PATIENT_MERGE_FORM_VALUES,
  });

  const { data: mergeHistory = [], isLoading } = useQuery<PatientMergeHistory[]>({
    queryKey: ["patient-merge-history", patient.id],
    queryFn: () => patientDetailService.listMergeHistory(patient.id),
  });

  const mergeMutation = useMutation({
    mutationFn: (values: PatientMergeFormInput) =>
      patientDetailService.mergePatients(toMergePatientRequest(patient.id, values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-merge-history", patient.id] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      notifications.show({ title: "Merged", message: "Patient records merged", color: "success" });
      confirmHandlers.close();
      setSelectedTarget(null);
      reset(DEFAULT_PATIENT_MERGE_FORM_VALUES);
    },
  });

  const unmergeMutation = useMutation({
    mutationFn: (historyId: string) => patientDetailService.unmergePatient(historyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-merge-history", patient.id] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      notifications.show({
        title: "Unmerged",
        message: "Patient records separated",
        color: "success",
      });
    },
  });

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="lg">
      {patient.is_merged && (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          This patient has been merged into another record.
        </Alert>
      )}

      {/* Merge History */}
      <Card withBorder>
        <Title order={5} mb="sm">
          Merge History
        </Title>
        {mergeHistory.length === 0 ? (
          <Text size="sm" c="dimmed">
            No merge history
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Surviving</Table.Th>
                <Table.Th>Merged</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Status</Table.Th>
                {canUpdate && <Table.Th w={60} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {mergeHistory.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td>
                    <Text size="xs">{formatDate(h.created_at)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <PatientNameCell patientId={h.surviving_patient_id} showUhid={false} />
                  </Table.Td>
                  <Table.Td>
                    <PatientNameCell patientId={h.merged_patient_id} showUhid={false} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{h.merge_reason}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" tone={h.unmerged_at ? "neutral" : "success"}>
                      {h.unmerged_at ? "Unmerged" : "Active"}
                    </Badge>
                  </Table.Td>
                  {canUpdate && (
                    <Table.Td>
                      {!h.unmerged_at && (
                        <Button
                          tone="secondary"
                          size="xs"
                          onClick={() => unmergeMutation.mutate(h.id)}
                        >
                          Undo
                        </Button>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Merge Another Patient Into This One */}
      {canUpdate && !patient.is_merged && (
        <Card withBorder>
          <Title order={5} mb="sm">
            Merge Duplicate Into This Patient
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            Search for a duplicate patient record and merge it into this one. The duplicate will be
            deactivated.
          </Text>
          <PatientSearchSelect
            value={selectedTarget?.id ?? ""}
            onChange={(id) => {
              if (!id) {
                setSelectedTarget(null);
                setValue("merged_patient_id", "", { shouldValidate: true });
                return;
              }
              patientDetailService
                .getPatient(id)
                .then((p) => {
                  setSelectedTarget(p);
                  setValue("merged_patient_id", p.id, { shouldValidate: true });
                })
                .catch(() => {
                  setSelectedTarget(null);
                  setValue("merged_patient_id", "", { shouldValidate: true });
                });
            }}
            label="Search duplicate patient"
            placeholder="Search by UHID, name or phone..."
          />
          {errors.merged_patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.merged_patient_id.message}
            </Text>
          )}
          {selectedTarget && (
            <Stack
              component="form"
              gap="sm"
              mt="md"
              onSubmit={handleSubmit(() => confirmHandlers.open())}
            >
              {/* Side-by-side comparison */}
              <Card withBorder bg="var(--fc-panel, #f7f8f6)" p="md">
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  mb="sm"
                  tt="uppercase"
                  ff="var(--font-mono, monospace)"
                  style={{ letterSpacing: "0.14em" }}
                >
                  Compare Before Merging
                </Text>
                <SimpleGrid cols={2}>
                  <Stack gap={4}>
                    <Badge tone="success" size="sm" mb={4}>
                      Surviving Record (this patient)
                    </Badge>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        UHID
                      </Text>
                      <Text size="sm" fw={600}>
                        {patient.uhid}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Name
                      </Text>
                      <Text size="sm">
                        {patient.first_name} {patient.last_name}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Phone
                      </Text>
                      <Text size="sm">{patient.phone ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        DOB
                      </Text>
                      <Text size="sm">{patient.date_of_birth ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Gender
                      </Text>
                      <Text size="sm">{patient.gender}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Category
                      </Text>
                      <Badge size="xs">{patient.category}</Badge>
                    </Group>
                  </Stack>
                  <Stack gap={4}>
                    <Badge tone="warning" size="sm" mb={4}>
                      Duplicate (will be deactivated)
                    </Badge>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        UHID
                      </Text>
                      <Text size="sm" fw={600}>
                        {selectedTarget.uhid}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Name
                      </Text>
                      <Text size="sm">
                        {selectedTarget.first_name} {selectedTarget.last_name}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Phone
                      </Text>
                      <Text size="sm">{selectedTarget.phone ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        DOB
                      </Text>
                      <Text size="sm">{selectedTarget.date_of_birth ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Gender
                      </Text>
                      <Text size="sm">{selectedTarget.gender}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Category
                      </Text>
                      <Badge size="xs">{selectedTarget.category}</Badge>
                    </Group>
                  </Stack>
                </SimpleGrid>
              </Card>

              <Alert tone="warning">
                All visits, prescriptions, lab orders, and billing records from{" "}
                <b>{selectedTarget.uhid}</b> will be transferred to <b>{patient.uhid}</b>.
              </Alert>
              <Controller
                name="merge_reason"
                control={control}
                render={({ field }) => (
                  <Textarea
                    label="Merge Reason"
                    placeholder="Why are these records being merged?"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.merge_reason?.message}
                    required
                  />
                )}
              />
              <Group justify="flex-end">
                <Button
                  tone="ghost"
                  type="button"
                  onClick={() => {
                    setSelectedTarget(null);
                    reset(DEFAULT_PATIENT_MERGE_FORM_VALUES);
                  }}
                >
                  Cancel
                </Button>
                <Button tone="primary" type="submit">
                  Merge Records
                </Button>
              </Group>
            </Stack>
          )}
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal opened={confirmOpen} onClose={confirmHandlers.close} title="Confirm Merge">
        <Alert tone="danger" icon={<IconAlertTriangle size={16} />} mb="md">
          This will deactivate {selectedTarget?.uhid} and merge its data into {patient.uhid}. This
          can be undone later.
        </Alert>
        <Group justify="flex-end">
          <Button tone="ghost" onClick={confirmHandlers.close}>
            Cancel
          </Button>
          <Button
            tone="danger"
            loading={mergeMutation.isPending}
            onClick={() => {
              if (selectedTarget) {
                mergeMutation.mutate(getValues());
              }
            }}
          >
            Confirm Merge
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

// ── Print Patient Card ─────────────────────────────────────
