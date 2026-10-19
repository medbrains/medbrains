import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { InsuranceClaim } from "@medbrains/types";
import { useMemo } from "react";
import { Alert, Badge } from "@/components/ui";
import { nhcxStatusLabel, summariseNhcxResponse } from "./nhcxSummary";

interface NhcxExchangeCardProps {
  claim: InsuranceClaim;
}

const when = (at: string | null) => (at ? new Date(at).toLocaleString() : "—");

/**
 * The claim's latest NHCX exchange as it really stands: waiting, sent,
 * refused, or the payer's answer — with the correlation id the payer and
 * the gateway know it by.
 */
export function NhcxExchangeCard({ claim }: NhcxExchangeCardProps) {
  const status = nhcxStatusLabel(claim.nhcx_status);
  const summary = useMemo(
    () => summariseNhcxResponse(claim.nhcx_response_payload),
    [claim.nhcx_response_payload],
  );
  const outcome = claim.nhcx_outcome ?? summary?.outcome ?? null;
  const rows: [string, string][] = [
    ["Correlation ID", claim.nhcx_correlation_id ?? "—"],
    ["API call ID", claim.nhcx_api_call_id ?? "—"],
    ["Payer (HCX code)", claim.nhcx_recipient_code ?? "—"],
    ["Sent at", when(claim.nhcx_submitted_at)],
    ["Payer answered at", when(claim.nhcx_response_at)],
  ];

  return (
    <Card withBorder padding="sm" radius="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600} size="sm">
          NHCX exchange
        </Text>
        <Badge tone={status.tone}>{status.label}</Badge>
      </Group>
      {claim.nhcx_correlation_id ? (
        <Stack gap="xs">
          {claim.nhcx_status === "send_failed" && claim.nhcx_disposition && (
            <Alert tone="danger" title="NHCX did not accept the message">
              {claim.nhcx_disposition}
            </Alert>
          )}
          {claim.nhcx_response_at && (
            <SimpleGrid cols={2} spacing="xs">
              <Text size="xs" c="dimmed">
                Outcome
              </Text>
              <Text size="sm">{outcome ?? "—"}</Text>
              <Text size="xs" c="dimmed">
                Approved by the payer
              </Text>
              <Text size="sm">{claim.approved_amount ? `₹${claim.approved_amount}` : "—"}</Text>
              {summary?.disposition && (
                <>
                  <Text size="xs" c="dimmed">
                    Payer's note
                  </Text>
                  <Text size="sm">{summary.disposition}</Text>
                </>
              )}
              {summary?.error && (
                <>
                  <Text size="xs" c="dimmed">
                    Error
                  </Text>
                  <Text size="sm">{summary.error}</Text>
                </>
              )}
            </SimpleGrid>
          )}
          <SimpleGrid cols={2} spacing={4}>
            {rows.map(([label, value]) => (
              <Stack key={label} gap={0}>
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
                <Text size="xs" ff="monospace">
                  {value}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Nothing has been sent to NHCX for this claim.
        </Text>
      )}
    </Card>
  );
}
