/**
 * What is waiting to be run at the bench.
 *
 * `GET /lab/analyzer-worklist` was routed, permission-checked and careful —
 * it blanks the patient name for a reader holding lab.orders.list but not
 * patients.view, and the handler's comment records that the roles were
 * checked rather than assumed — and no screen consumed it. The analyser
 * interface was configured in Settings and read by nobody, so the bench
 * worked from the general orders list instead, which is not ordered by
 * priority and does not carry the barcode.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { LabAnalyzerWorklistRow } from "@medbrains/types";
import { IconBarcode } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { DataTable } from "@/components";
import { Alert, Badge, Button } from "@/components/ui";
import { labService } from "@/services/lab.service";

export function BenchWorklistSection() {
  const navigate = useNavigate();
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["lab-analyzer-worklist"],
    queryFn: () => labService.getLabAnalyzerWorklist(),
    refetchInterval: 30_000,
  });

  // A failed read must not look like an empty bench. "Nothing waiting" sends
  // a technician away from samples that are sitting there.
  if (isError) {
    return (
      <Alert tone="danger" title="The worklist could not be read">
        This is a failed read, not an empty bench. Check the orders list before assuming there is
        nothing to run.
      </Alert>
    );
  }

  const columns = [
    {
      key: "sample_barcode" as const,
      label: "Barcode",
      render: (row: LabAnalyzerWorklistRow) =>
        row.sample_barcode ? (
          <Group gap={6}>
            <IconBarcode size={14} />
            <Text size="sm" ff="monospace">
              {row.sample_barcode}
            </Text>
          </Group>
        ) : (
          <Badge tone="warning" size="sm">
            Not labelled
          </Badge>
        ),
    },
    {
      key: "patient_name" as const,
      label: "Patient",
      render: (row: LabAnalyzerWorklistRow) => (
        <Text size="sm" c={row.patient_name === "Restricted" ? "dimmed" : undefined}>
          {row.patient_name}
        </Text>
      ),
    },
    {
      key: "ordered_at" as const,
      label: "Ordered",
      render: (row: LabAnalyzerWorklistRow) => (
        <Text size="sm">{new Date(row.ordered_at).toLocaleString()}</Text>
      ),
    },
    {
      key: "order_id" as const,
      label: "",
      render: (row: LabAnalyzerWorklistRow) => (
        <Button
          size="compact-xs"
          tone="secondary"
          onClick={() => navigate(`/lab/orders/${row.order_id}`)}
        >
          Open order
        </Button>
      ),
    },
  ];

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Orders awaiting a result, most urgent first. Samples with no barcode are called out — an
        unlabelled tube cannot be matched to a patient by the analyser.
      </Text>
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row) => row.order_id}
        emptyTitle="Nothing waiting at the bench"
      />
    </Stack>
  );
}
