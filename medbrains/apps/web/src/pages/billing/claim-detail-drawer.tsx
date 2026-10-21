// Billing ClaimDetailDrawer — split from billing.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { InsuranceClaim } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { NhcxAdjudicationCard } from "@/components/Nhcx/NhcxAdjudicationCard";
import { NhcxClaimActions } from "@/components/Nhcx/NhcxClaimActions";
import { NhcxClaimPayments } from "@/components/Nhcx/NhcxClaimPayments";
import { NhcxEligibilityCard } from "@/components/Nhcx/NhcxEligibilityCard";
import { NhcxExchangeCard } from "@/components/Nhcx/NhcxExchangeCard";
import { NhcxSetupAlert } from "@/components/Nhcx/NhcxSetupAlert";
import { Alert, Badge, Modal, Table } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { nhcxSettingsService } from "@/services/nhcxSettings.service";

export function ClaimDetailDrawer({
  claim,
  onClose,
  onSubmitToNhcx,
}: {
  claim: InsuranceClaim | null;
  onClose: () => void;
  onSubmitToNhcx: (claim: InsuranceClaim, use: "preauthorization" | "claim") => void;
}) {
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const { data: nhcxStatus, isError: isStatusError } = useQuery({
    queryKey: ["nhcx", "status"],
    queryFn: nhcxSettingsService.status,
    enabled: !!claim && canView,
  });
  const callbacksQuery = useQuery({
    queryKey: ["nhcx-callbacks", claim?.id],
    queryFn: () => billingService.listNhcxCallbacks({ matched_id: claim?.id }),
    enabled: !!claim && canView,
  });
  const callbacks = callbacksQuery.data ?? [];
  // Without the view permission the status is unknown; the server still refuses.
  const nhcxReady = !canView || nhcxStatus?.ready === true;
  return (
    <Modal
      opened={!!claim}
      onClose={onClose}
      fullScreen
      title={
        claim ? (
          <Group gap="xs">
            <Text fw={600}>{claim.insurance_provider}</Text>
            <Badge size="sm" tone="neutral">
              {claim.claim_number ?? claim.id.slice(0, 8)}
            </Badge>
          </Group>
        ) : (
          "Claim"
        )
      }
    >
      {claim && (
        <Stack gap="md">
          {canView && <NhcxSetupAlert status={nhcxStatus} isError={isStatusError} />}
          <NhcxClaimActions claim={claim} isReady={nhcxReady} onSubmit={onSubmitToNhcx} />
          <SimpleGrid cols={2} spacing="xs">
            <Text size="xs" c="dimmed">
              Status
            </Text>
            <Text size="sm">{claim.status.replace(/_/g, " ")}</Text>
            <Text size="xs" c="dimmed">
              Type
            </Text>
            <Text size="sm">{claim.claim_type}</Text>
            <Text size="xs" c="dimmed">
              Pre-auth
            </Text>
            <Text size="sm">{claim.pre_auth_amount ? `₹${claim.pre_auth_amount}` : "—"}</Text>
            <Text size="xs" c="dimmed">
              Approved
            </Text>
            <Text size="sm">{claim.approved_amount ? `₹${claim.approved_amount}` : "—"}</Text>
            <Text size="sm" c="dimmed">
              Settled
            </Text>
            <Text size="sm">{claim.settled_amount ? `₹${claim.settled_amount}` : "—"}</Text>
            <Text size="xs" c="dimmed">
              TPA
            </Text>
            <Text size="sm">{claim.tpa_name ?? "—"}</Text>
            <Text size="xs" c="dimmed">
              Submitted
            </Text>
            <Text size="sm">
              {claim.submitted_at ? new Date(claim.submitted_at).toLocaleString() : "—"}
            </Text>
          </SimpleGrid>

          <NhcxEligibilityCard
            patientId={claim.patient_id}
            triggerPoint="claim"
            triggerEntityId={claim.id}
          />

          <NhcxExchangeCard claim={claim} />

          <NhcxAdjudicationCard claimId={claim.id} />

          <NhcxClaimPayments claimId={claim.id} />

          {canView && (
            <Card withBorder padding="sm" radius="md">
              <Group justify="space-between" mb="xs">
                <Text fw={600} size="sm">
                  Payer responses received
                </Text>
                <Badge tone="neutral">{callbacks.length}</Badge>
              </Group>
              {callbacksQuery.isError ? (
                <Alert tone="warning" title="Could not load the responses">
                  Whether the payer has answered is unknown right now — try again in a minute.
                </Alert>
              ) : callbacks.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No callbacks received yet.
                </Text>
              ) : (
                <Table verticalSpacing={4} fz="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>When</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Sender</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {callbacks.map((cb) => (
                      <Table.Tr key={cb.id}>
                        <Table.Td>{new Date(cb.received_at).toLocaleString()}</Table.Td>
                        <Table.Td>{cb.callback_type ?? "—"}</Table.Td>
                        <Table.Td>{cb.sender_code ?? "—"}</Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            tone={cb.verification_status === "verified" ? "success" : "warning"}
                          >
                            {cb.verification_status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          )}
        </Stack>
      )}
    </Modal>
  );
}
