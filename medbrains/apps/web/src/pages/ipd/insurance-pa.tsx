// IPD InsurancePaTab — split from ipd.tsx (pure move).

import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { PriorAuthRequestRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import type { BadgeTone } from "@/components/ui";
import { Badge, Table } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function InsurancePaTab({ admissionId }: { admissionId: string }) {
  // The tab rides in on ipd.admissions.view; the pre-authorisations carries its own
  // code. Refused, `data ?? []` renders an empty table that reads as a
  // fact about the patient rather than about the reader.
  const canViewPriorAuth = useHasPermission(P.BILLING.CORPORATE_LIST);
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-prior-auth", admissionId],
    queryFn: () => ipdService.getAdmissionPriorAuth(admissionId),
    enabled: canViewPriorAuth,
  });

  const paStatusColors: Record<string, BadgeTone> = {
    draft: "neutral",
    submitted: "primary",
    approved: "success",
    partially_approved: "warning",
    denied: "danger",
    cancelled: "neutral",
    expired: "warning",
  };

  const rows = data ?? [];

  return (
    <Stack>
      <Text fw={600}>Prior Authorization Requests</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>PA Number</Table.Th>
              <Table.Th>Service</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Urgency</Table.Th>
              <Table.Th>Submitted</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((pa: PriorAuthRequestRow) => (
              <Table.Tr key={pa.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {pa.pa_number}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{pa.service_type}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge tone={paStatusColors[pa.status] ?? "neutral"} size="sm">
                    {pa.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{pa.urgency}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {pa.submitted_at ? new Date(pa.submitted_at).toLocaleDateString() : "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No prior authorization requests for this admission.
        </Text>
      )}
    </Stack>
  );
}
