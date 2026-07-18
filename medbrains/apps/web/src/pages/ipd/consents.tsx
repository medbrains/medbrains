// IPD ConsentsTab — split from ipd.tsx (pure move).

import { Badge, Table } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { Stack, Text } from "@mantine/core";
import type { ProcedureConsent } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";

export function ConsentsTab({ admissionId }: { admissionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ipd-consents", admissionId],
    queryFn: () => ipdService.getAdmissionConsents(admissionId),
  });

  const rows = (data ?? []) as ProcedureConsent[];
  const consentStatusColors: Record<string, BadgeTone> = {
    pending: "warning",
    signed: "success",
    refused: "danger",
    withdrawn: "warning",
    expired: "neutral",
  };

  return (
    <Stack>
      <Text fw={600}>Procedure Consents</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : rows.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Consent Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Signed</Table.Th>
              <Table.Th>Consented By</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {c.procedure_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm">{c.consent_type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge tone={consentStatusColors[c.status] ?? "neutral"} size="sm">
                    {c.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">
                    {c.signed_at ? new Date(c.signed_at).toLocaleDateString() : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{c.consented_by_name ?? "—"}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          No procedure consents for this encounter.
        </Text>
      )}
    </Stack>
  );
}

// ── Admission Print ────────────────────────────────────
