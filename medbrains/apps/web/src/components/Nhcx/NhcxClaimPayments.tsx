import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Card, Table } from "@/components/ui";
import { paymentFlag, rupees } from "./claimNhcx";

interface NhcxClaimPaymentsProps {
  claimId: string;
}

/** What the payer reported paying on this claim through NHCX: the transfer,
 * the TDS it withheld, and whether it matches what it approved. */
export function NhcxClaimPayments({ claimId }: NhcxClaimPaymentsProps) {
  const canSee = useHasPermission(P.INSURANCE.NHCX.PAYMENTS);
  const payments = useQuery({
    queryKey: ["claim-nhcx-payments", claimId],
    queryFn: () => api.listClaimNhcxPayments(claimId),
    enabled: canSee,
  });
  if (!canSee) return null;
  const rows = payments.data ?? [];
  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Payments from the payer
        </Text>
        {payments.isError ? (
          <Alert tone="warning" title="Could not load the payments">
            Whether the payer has paid is unknown right now — try again in a minute.
          </Alert>
        ) : payments.isLoading ? (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        ) : rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            No payment notice has been received for this claim.
          </Text>
        ) : (
          <Table verticalSpacing={4} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Paid on</Table.Th>
                <Table.Th>UTR</Table.Th>
                <Table.Th>Approved paid</Table.Th>
                <Table.Th>TDS</Table.Th>
                <Table.Th>Received</Table.Th>
                <Table.Th>Check</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((p) => {
                const flag = paymentFlag(p);
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td>{p.payment_date ?? "—"}</Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {p.payment_reference ?? "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>{rupees(p.gross_amount)}</Table.Td>
                    <Table.Td>{rupees(p.tds_amount)}</Table.Td>
                    <Table.Td>{rupees(p.net_amount)}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" tone={flag.tone}>
                        {flag.label}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Card>
  );
}
