import { Group, Stack, Text } from "@mantine/core";
import type { LabReportDispatch } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { DataTable } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { labService } from "@/services/lab.service";
import { LAB_DISPATCH_METHOD_OPTIONS } from "./shared";

/**
 * Where a report went, and whether it arrived.
 *
 * `lab_report_dispatches` is the record that a result reached the clinician
 * who asked for it. All three endpoints existed with no caller, so that record
 * could neither be created nor confirmed from the product — which makes "the
 * report was sent" an assertion nobody can check afterwards, and it is exactly
 * the question asked when a critical result is said to have been missed.
 */

export function LabDispatchSection({ canManage }: { canManage: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
            {LAB_DISPATCH_METHOD_OPTIONS.find((option) => option.value === row.dispatch_method)
              ?.label ?? row.dispatch_method}
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
            onClick={() => navigate("/lab/dispatch/new")}
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
    </Stack>
  );
}
