// Billing ClaimDetailDrawer — split from billing.tsx (pure move).

import { Card, Drawer, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { InsuranceClaim } from "@medbrains/types";
import { IconShieldCheck } from "@tabler/icons-react";
import { Badge, Button, Table } from "@/components/ui";

interface NhcxCallbackRow {
  id: string;
  received_at: string;
  correlation_id: string | null;
  sender_code: string | null;
  callback_type: string | null;
  verification_status: string;
  decrypted_payload: unknown;
}

export function ClaimDetailDrawer({
  claim,
  callbacks,
  onClose,
  onNhcxAction,
}: {
  claim: InsuranceClaim | null;
  callbacks: NhcxCallbackRow[];
  onClose: () => void;
  onNhcxAction: (claim: InsuranceClaim, mode: "submit" | "eligibility") => void;
}) {
  return (
    <Drawer
      opened={!!claim}
      onClose={onClose}
      position="right"
      size="xl"
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
          <Group justify="flex-end">
            <Button size="xs" tone="secondary" onClick={() => onNhcxAction(claim, "eligibility")}>
              Check eligibility
            </Button>
            <Button
              size="xs"
              leftSection={<IconShieldCheck size={14} />}
              onClick={() => onNhcxAction(claim, "submit")}
            >
              Submit to NHCX
            </Button>
          </Group>
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

          <Card withBorder padding="sm" radius="md">
            <Text fw={600} size="sm" mb="xs">
              NHCX exchange
            </Text>
            {claim.nhcx_correlation_id ? (
              <Stack gap={4}>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    Correlation ID
                  </Text>
                  <Text size="xs" ff="monospace">
                    {claim.nhcx_correlation_id}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    API call ID
                  </Text>
                  <Text size="xs" ff="monospace">
                    {claim.nhcx_api_call_id ?? "—"}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    Recipient code
                  </Text>
                  <Text size="xs" ff="monospace">
                    {claim.nhcx_recipient_code ?? "—"}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text size="xs" c="dimmed" style={{ minWidth: 140 }}>
                    Last response at
                  </Text>
                  <Text size="xs">
                    {claim.nhcx_response_at
                      ? new Date(claim.nhcx_response_at).toLocaleString()
                      : "—"}
                  </Text>
                </Group>
                {claim.nhcx_response_payload != null && (
                  <Card withBorder padding="xs" radius="sm" mt="xs" bg="gray.0">
                    <Text size="xs" c="dimmed" mb={4}>
                      Decrypted response payload
                    </Text>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 11,
                        maxHeight: 220,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {JSON.stringify(claim.nhcx_response_payload, null, 2)}
                    </pre>
                  </Card>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Not yet exchanged with NHCX gateway.
              </Text>
            )}
          </Card>

          <Card withBorder padding="sm" radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={600} size="sm">
                Webhook callbacks
              </Text>
              <Badge tone="neutral">{callbacks.length}</Badge>
            </Group>
            {callbacks.length === 0 ? (
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
        </Stack>
      )}
    </Drawer>
  );
}
