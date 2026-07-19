// PATIENT LabOrdersTab — split from patient-detail.tsx (pure move).

import { Loader, Text } from "@mantine/core";
import type { PatientLabOrderRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Badge, type BadgeTone, Table } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import { formatDate } from "./shared";

const LAB_STATUS_COLORS: Record<string, BadgeTone> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "warning",
  completed: "success",
  verified: "success",
  cancelled: "danger",
};

export function LabOrdersTab({ patientId }: { patientId: string }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => patientDetailService.listPatientLabOrders(patientId),
  });

  if (isLoading) return <Loader size="sm" />;

  if (!orders || orders.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No lab orders found.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Test</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Priority</Table.Th>
          <Table.Th>Ordered By</Table.Th>
          <Table.Th>Results</Table.Th>
          <Table.Th>Ordered</Table.Th>
          <Table.Th>Updated</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {orders.map((o: PatientLabOrderRow) => (
          <Table.Tr key={o.id}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {o.test_name ?? "-"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge tone={LAB_STATUS_COLORS[o.status] ?? "neutral"} size="sm">
                {o.status.replace(/_/g, " ")}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Badge
                tone={
                  o.priority === "stat" ? "danger" : o.priority === "urgent" ? "warning" : "neutral"
                }
                size="sm"
              >
                {o.priority}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{o.ordered_by_name ?? "-"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" ta="center">
                {o.result_count ?? 0}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatDate(o.created_at)}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatDate(o.updated_at)}</Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

// ── Imaging Tab ────────────────────────────────────────────
