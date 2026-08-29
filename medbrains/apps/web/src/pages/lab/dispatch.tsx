import { Group, Select as MantineSelect, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { CreateReportDispatchRequest, LabReportDispatch } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, Badge, Button, Drawer, toast } from "@/components/ui";
import { labService } from "@/services/lab.service";

/**
 * Where a report went, and whether it arrived.
 *
 * `lab_report_dispatches` is the record that a result reached the clinician
 * who asked for it. All three endpoints existed with no caller, so that record
 * could neither be created nor confirmed from the product — which makes "the
 * report was sent" an assertion nobody can check afterwards, and it is exactly
 * the question asked when a critical result is said to have been missed.
 */
const METHOD_OPTIONS = [
  { value: "counter", label: "Collected at the counter" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "portal", label: "Patient portal" },
  { value: "courier", label: "Courier" },
];

const EMPTY = {
  order_id: "",
  patient_id: "",
  dispatch_method: "counter",
  dispatched_to: "",
  notes: "",
};

export function LabDispatchSection({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [form, setForm] = useState(EMPTY);

  const {
    data: dispatches = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["lab-report-dispatches"],
    queryFn: () => labService.listReportDispatches(),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["lab-report-dispatches"] });

  const createMutation = useMutation({
    mutationFn: () =>
      labService.createReportDispatch({
        order_id: form.order_id.trim(),
        patient_id: form.patient_id.trim(),
        dispatch_method: form.dispatch_method as CreateReportDispatchRequest["dispatch_method"],
        dispatched_to: form.dispatched_to.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm(EMPTY);
      formHandlers.close();
      toast.success("Dispatch recorded");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not record dispatch" }),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => labService.confirmReportDispatch(id),
    onSuccess: () => {
      invalidate();
      toast.success("Receipt confirmed");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not confirm receipt" }),
  });

  const unconfirmed = dispatches.filter((d: LabReportDispatch) => !d.received_confirmation);

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row: LabReportDispatch) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    {
      key: "dispatch_method",
      label: "Sent by",
      render: (row: LabReportDispatch) => (
        <Stack gap={0}>
          <Text size="sm">
            {METHOD_OPTIONS.find((m) => m.value === row.dispatch_method)?.label ??
              row.dispatch_method}
          </Text>
          {row.dispatched_to && (
            <Text size="xs" c="dimmed">
              {row.dispatched_to}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "dispatched_at",
      label: "Sent",
      render: (row: LabReportDispatch) => (
        <Text size="sm">{new Date(row.dispatched_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "received_confirmation",
      label: "Receipt",
      // Sent and received are different facts. A dispatch row with no
      // confirmation means it left, not that it arrived, and the wording says
      // so rather than showing a neutral dash.
      render: (row: LabReportDispatch) =>
        row.received_confirmation ? (
          <Badge tone="success" size="sm">
            Confirmed {row.confirmed_at ? new Date(row.confirmed_at).toLocaleDateString() : ""}
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            Not confirmed
          </Badge>
        ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (row: LabReportDispatch) =>
              row.received_confirmation ? null : (
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconCheck size={14} />}
                  loading={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate(row.id)}
                >
                  Confirm receipt
                </Button>
              ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      {isError && (
        <Alert tone="danger" title="Dispatch records could not be loaded">
          Do not read this as no reports having been sent.
        </Alert>
      )}
      {unconfirmed.length > 0 && (
        <Alert tone="warning" title={`${unconfirmed.length} dispatch(es) unconfirmed`}>
          These reports left the laboratory and nobody has recorded them arriving.
        </Alert>
      )}

      {canManage && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
            Record a dispatch
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={dispatches}
        loading={isLoading}
        rowKey={(row: LabReportDispatch) => row.id}
        emptyTitle={isError ? "Could not load dispatches" : "No dispatches recorded"}
        emptyDescription={
          isError
            ? "The list failed to load — this is not a statement that nothing was sent."
            : "Recording how a report was sent is what makes its delivery checkable later."
        }
      />

      <Drawer
        opened={formOpen}
        onClose={formHandlers.close}
        title="Record a dispatch"
        position="right"
      >
        <Stack gap="sm">
          <TextInput
            label="Order id"
            value={form.order_id}
            onChange={(event) => setForm((f) => ({ ...f, order_id: event.currentTarget.value }))}
          />
          <TextInput
            label="Patient id"
            value={form.patient_id}
            onChange={(event) => setForm((f) => ({ ...f, patient_id: event.currentTarget.value }))}
          />
          <MantineSelect
            label="How it was sent"
            data={METHOD_OPTIONS}
            value={form.dispatch_method}
            onChange={(value) => setForm((f) => ({ ...f, dispatch_method: value ?? "counter" }))}
            allowDeselect={false}
          />
          <TextInput
            label="Sent to"
            description="The address, number or person who took it."
            value={form.dispatched_to}
            onChange={(event) =>
              setForm((f) => ({ ...f, dispatched_to: event.currentTarget.value }))
            }
          />
          <Textarea
            label="Notes"
            autosize
            minRows={2}
            value={form.notes}
            onChange={(event) => setForm((f) => ({ ...f, notes: event.currentTarget.value }))}
          />
          <Group justify="flex-end">
            <Button tone="secondary" size="xs" onClick={formHandlers.close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              size="xs"
              disabled={form.order_id.trim() === "" || form.patient_id.trim() === ""}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Record dispatch
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
