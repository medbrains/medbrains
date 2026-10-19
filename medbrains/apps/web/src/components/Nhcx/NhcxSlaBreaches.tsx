import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Table } from "@/components/ui";
import { NhcxSlaBadge } from "./NhcxSlaBadge";

const UNNAMED = "Not sent through NHCX";

/**
 * IRDAI turnaround over the last 30 days: breaches by payer, then the
 * breached and still-waiting requests themselves.
 */
export function NhcxSlaBreaches() {
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const report = useQuery({
    queryKey: ["nhcx-sla"],
    queryFn: () => api.getNhcxSla(),
    enabled: canView,
  });
  if (!canView) return null;
  const open = (report.data?.rows ?? []).filter(
    (r) => r.sla.state === "breached" || r.sla.state === "running",
  );
  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Text fw={600}>Pre-auth turnaround (IRDAI: 1 hour, 3 hours at discharge)</Text>
        {report.isError ? (
          <Alert tone="warning" title="Could not load the turnaround">
            Whether any payer is over its limit is unknown right now — try again in a minute.
          </Alert>
        ) : report.isLoading ? (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        ) : (
          <>
            <Table verticalSpacing={4} fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Payer</Table.Th>
                  <Table.Th>Requests</Table.Th>
                  <Table.Th>Over the limit</Table.Th>
                  <Table.Th>Waiting now</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(report.data?.by_payer ?? []).map((p) => (
                  <Table.Tr key={p.payer_code ?? UNNAMED}>
                    <Table.Td>{p.payer_name ?? p.payer_code ?? UNNAMED}</Table.Td>
                    <Table.Td>{p.total}</Table.Td>
                    <Table.Td>{p.breached}</Table.Td>
                    <Table.Td>{p.running}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {open.length === 0 ? (
              <Text size="sm" c="dimmed">
                No pre-auth is over its limit or waiting.
              </Text>
            ) : (
              <Stack gap={4}>
                {open.map((r) => (
                  <Group key={r.prior_auth_id} justify="space-between">
                    <Text size="sm">
                      {r.pa_number} · {r.payer_name ?? r.payer_code ?? UNNAMED}
                      {r.open_queries > 0 ? ` · ${r.open_queries} open query` : ""}
                    </Text>
                    <NhcxSlaBadge sla={r.sla} />
                  </Group>
                ))}
              </Stack>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}
