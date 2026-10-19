import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxEligibilityCheck } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconShieldSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Table } from "@/components/ui";
import { formatBenefitValue, summariseEligibility } from "./eligibilitySummary";
import { NhcxEligibilityCheckModal } from "./NhcxEligibilityCheckModal";

interface NhcxEligibilityCardProps {
  patientId: string;
  /** Where the check is run from: `front_office`, `claim`, `admission`. */
  triggerPoint: string;
  triggerEntityId?: string;
  /** HL7 benefit category codes to ask about. */
  serviceCategories?: string[];
}

const POLL_MS = 15_000;
const when = (at: string | null) => (at ? new Date(at).toLocaleString() : "—");

function EligibilityDetail({ check }: { check: NhcxEligibilityCheck }) {
  const result = check.nhcx_result;
  const errors = result?.errors ?? [];
  return (
    <Stack gap="xs">
      {check.nhcx_status === "send_failed" && check.nhcx_disposition && (
        <Alert tone="danger" title="NHCX did not accept the check">
          {check.nhcx_disposition}
        </Alert>
      )}
      {errors.length > 0 && (
        <Alert tone="warning" title="The payer's errors">
          {errors.join("; ")}
        </Alert>
      )}
      <SimpleGrid cols={2} spacing="xs">
        <Text size="xs" c="dimmed">
          Payer
        </Text>
        <Text size="sm">{check.payer_name ?? check.nhcx_recipient_code ?? "—"}</Text>
        <Text size="xs" c="dimmed">
          Coverage period
        </Text>
        <Text size="sm">
          {check.coverage_start || check.coverage_end
            ? `${check.coverage_start ?? "—"} to ${check.coverage_end ?? "—"}`
            : "—"}
        </Text>
        <Text size="xs" c="dimmed">
          Checked at
        </Text>
        <Text size="sm">{when(check.created_at)}</Text>
        <Text size="xs" c="dimmed">
          Payer answered at
        </Text>
        <Text size="sm">{when(check.nhcx_response_at)}</Text>
      </SimpleGrid>
      {result && result.benefits.length > 0 && (
        <Table verticalSpacing={4} fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Benefit</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Limit</Table.Th>
              <Table.Th>Used</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {result.benefits.map((b) => (
              <Table.Tr key={`${b.category}|${b.name}|${b.benefit_type}|${b.allowed}|${b.used}`}>
                <Table.Td>{[b.category, b.name].filter(Boolean).join(" — ") || "—"}</Table.Td>
                <Table.Td>{b.benefit_type ?? "—"}</Table.Td>
                <Table.Td>{formatBenefitValue(b.allowed, b.currency)}</Table.Td>
                <Table.Td>{formatBenefitValue(b.used, b.currency)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/**
 * The patient's latest NHCX eligibility check: in force or not, the benefits
 * and limits the payer reported, and when. A check still waiting for the
 * payer says so — it is never shown as "not covered".
 */
export function NhcxEligibilityCard({
  patientId,
  triggerPoint,
  triggerEntityId,
  serviceCategories,
}: NhcxEligibilityCardProps) {
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const canCheck = useHasPermission(P.INSURANCE.NHCX.SUBMIT);
  const [opened, setOpened] = useState(false);
  const checks = useQuery({
    queryKey: ["nhcx-eligibility", patientId],
    queryFn: () => api.listNhcxEligibility(patientId),
    enabled: canView && !!patientId,
    refetchInterval: (q) => (summariseEligibility(q.state.data?.[0]).isWaiting ? POLL_MS : false),
  });
  if (!canView && !canCheck) return null;
  const latest = checks.data?.[0];
  const summary = summariseEligibility(latest);

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" mb="xs">
        <Text fw={600} size="sm">
          Coverage eligibility (NHCX)
        </Text>
        {canView && !checks.isError && !checks.isLoading && (
          <Badge tone={summary.tone}>{summary.label}</Badge>
        )}
      </Group>
      <Stack gap="xs">
        {!canView ? (
          <Text size="sm" c="dimmed">
            You can send a check, but not see the payer's answer.
          </Text>
        ) : checks.isError ? (
          <Alert tone="warning" title="Could not load eligibility">
            Whether the policy is in force is unknown right now — try again in a minute.
          </Alert>
        ) : checks.isLoading ? (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        ) : latest ? (
          <EligibilityDetail check={latest} />
        ) : (
          <Text size="sm" c="dimmed">
            No eligibility check has been sent through NHCX for this patient.
          </Text>
        )}
        {canCheck && (
          <Group justify="flex-end">
            <Button
              size="xs"
              tone="secondary"
              leftSection={<IconShieldSearch size={16} />}
              onClick={() => setOpened(true)}
            >
              Check eligibility
            </Button>
          </Group>
        )}
      </Stack>
      <NhcxEligibilityCheckModal
        patientId={patientId}
        triggerPoint={triggerPoint}
        triggerEntityId={triggerEntityId}
        serviceCategories={serviceCategories}
        opened={opened}
        onClose={() => setOpened(false)}
      />
    </Card>
  );
}
