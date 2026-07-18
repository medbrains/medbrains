// IPD InvestigationsTab — split from ipd.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { InvestigationsResponse } from "@medbrains/types";
import { IconEye, IconFlask } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function InvestigationsTab({
  admissionId,
  canOrder,
  onOrderLab,
  onOrderRadiology,
}: {
  admissionId: string;
  canOrder: boolean;
  onOrderLab: () => void;
  onOrderRadiology: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-investigations", admissionId],
    queryFn: () => ipdService.getAdmissionInvestigations(admissionId),
  });

  if (isLoading) return <Text c="dimmed">Loading...</Text>;

  const inv = data as InvestigationsResponse | undefined;
  if (!inv) return <Text c="dimmed">No data.</Text>;

  return (
    <Stack>
      <Group justify="space-between" align="center">
        <Text fw={600}>Lab Orders ({inv.lab_orders.length})</Text>
        {canOrder && (
          <Group gap="xs">
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconFlask size={14} />}
              onClick={onOrderLab}
            >
              Order lab
            </Button>
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconEye size={14} />}
              onClick={onOrderRadiology}
            >
              Order imaging
            </Button>
          </Group>
        )}
      </Group>
      {inv.lab_orders.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Test</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Results</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {inv.lab_orders.map((lo) => {
              const results = inv.lab_results.filter((r) => r.order_id === lo.id);
              return (
                <Table.Tr key={lo.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {lo.test_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs">{new Date(lo.ordered_at).toLocaleDateString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm">{lo.status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {results.length > 0 ? (
                      <Stack gap={2}>
                        {results.map((r) => (
                          <Group key={r.id} gap={4}>
                            <Text
                              size="xs"
                              c={r.is_abnormal ? "danger" : undefined}
                              fw={r.is_abnormal ? 600 : undefined}
                            >
                              {r.parameter_name}: {r.value ?? "—"} {r.unit ?? ""}
                            </Text>
                            {r.reference_range && (
                              <Text size="xs" c="dimmed">
                                ({r.reference_range})
                              </Text>
                            )}
                            {r.is_abnormal && (
                              <Badge tone="danger" size="xs">
                                Abnormal
                              </Badge>
                            )}
                          </Group>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Pending
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No lab orders during admission.
        </Text>
      )}

      <Text fw={600} mt="md">
        Radiology Orders ({inv.radiology_orders.length})
      </Text>
      {inv.radiology_orders.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Modality</Table.Th>
              <Table.Th>Body Part</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Findings</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {inv.radiology_orders.map((ro) => (
              <Table.Tr key={ro.id}>
                <Table.Td>
                  <Text size="sm">{ro.modality}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{ro.body_part ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{new Date(ro.ordered_at).toLocaleDateString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{ro.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{ro.findings ?? "Pending"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No radiology orders during admission.
        </Text>
      )}
    </Stack>
  );
}
