import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Badge, Card, Table } from "@/components/ui";
import { adjudicationRows, rupees } from "./claimNhcx";
import { NhcxTaskList } from "./NhcxTaskList";

interface NhcxAdjudicationCardProps {
  claimId: string;
}

/**
 * The payer's adjudication of the final claim, line by line — what was
 * claimed, what it approved, what it cut and why — and every status,
 * cancel and reprocess request asked about the claim.
 */
export function NhcxAdjudicationCard({ claimId }: NhcxAdjudicationCardProps) {
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const view = useQuery({
    queryKey: ["claim-nhcx", claimId],
    queryFn: () => api.getClaimNhcx(claimId),
    enabled: canView,
  });
  const rows = useMemo(
    () => adjudicationRows(view.data?.claim_items ?? [], view.data?.adjudication ?? null),
    [view.data],
  );
  if (!canView) return null;
  if (view.isError) {
    return (
      <Alert tone="warning" title="Could not load the payer's adjudication">
        Whether the payer has decided is unknown right now — try again in a minute.
      </Alert>
    );
  }
  const adj = view.data?.adjudication ?? null;
  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600} size="sm">
            Payer's adjudication
          </Text>
          {adj?.outcome && <Badge tone="neutral">{adj.outcome}</Badge>}
        </Group>
        {view.data?.pre_auth_ref && (
          <Text size="xs" c="dimmed">
            Pre-auth reference {view.data.pre_auth_ref}
          </Text>
        )}
        {adj ? (
          <SimpleGrid cols={3} spacing="xs">
            {(
              [
                ["Claimed", adj.submitted],
                ["Approved", adj.approved],
                ["Deducted", adj.deducted],
              ] as const
            ).map(([label, value]) => (
              <Stack key={label} gap={0}>
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
                <Text size="sm" fw={600}>
                  {rupees(value)}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>
        ) : (
          <Text size="sm" c="dimmed">
            {rows.length > 0
              ? "The final claim is with the payer; no decision yet."
              : "No final claim has been sent for this claim."}
          </Text>
        )}
        {adj?.disposition && <Text size="sm">{adj.disposition}</Text>}
        {rows.length > 0 && (
          <Table verticalSpacing={4} fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Line</Table.Th>
                <Table.Th>Claimed</Table.Th>
                <Table.Th>Approved</Table.Th>
                <Table.Th>Deducted</Table.Th>
                <Table.Th>Payer's reason</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.sequence}>
                  <Table.Td>{r.sequence}</Table.Td>
                  <Table.Td>{r.description}</Table.Td>
                  <Table.Td>{rupees(r.submitted)}</Table.Td>
                  <Table.Td>{rupees(r.approved)}</Table.Td>
                  <Table.Td>
                    {r.isCut ? (
                      <Badge tone="warning">{rupees(r.deducted)}</Badge>
                    ) : (
                      rupees(r.deducted)
                    )}
                  </Table.Td>
                  <Table.Td>{r.reasons.join("; ") || "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <NhcxTaskList tasks={view.data?.tasks ?? []} />
      </Stack>
    </Card>
  );
}
