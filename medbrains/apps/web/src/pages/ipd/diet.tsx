// IPD DietTab — split from ipd.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import type { DietOrder } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import type { BadgeTone } from "@/components/ui";
import { Badge, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function DietTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-diet-orders", admissionId],
    queryFn: () => ipdService.getAdmissionDietOrders(admissionId),
  });

  const rows = (data ?? []) as DietOrder[];
  const dietTypeColors: Record<string, BadgeTone> = {
    regular: "primary",
    soft: "success",
    liquid: "info",
    npo: "danger",
    diabetic: "warning",
    renal: "accent",
    cardiac: "danger",
    custom: "neutral",
  };

  return (
    <Stack>
      <Text fw={600}>Diet Orders</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Diet Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>NPO</Table.Th>
              <Table.Th>Special Instructions</Table.Th>
              <Table.Th>Start Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>
                  <Badge tone={dietTypeColors[d.diet_type] ?? "neutral"} size="sm">
                    {d.diet_type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{d.status}</Badge>
                </Table.Td>
                <Table.Td>
                  {d.is_npo ? (
                    <Badge tone="danger" size="xs">
                      NPO
                    </Badge>
                  ) : (
                    "—"
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{d.special_instructions ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{d.start_date}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No diet orders for this admission.
        </Text>
      )}
    </Stack>
  );
}
