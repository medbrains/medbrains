import { Text } from "@mantine/core";
import type { AbdmConsentArtefact } from "@medbrains/types";
import { Badge, Table } from "@/components/ui";
import { formatDate } from "@/lib/date-utils";
import { CONSENT_STATUS, HI_TYPE_LABEL } from "./abdmStatus";

/** Consents the patient granted through ABDM that name this hospital. */
export function AbdmConsentTable({ consents }: { consents: AbdmConsentArtefact[] }) {
  if (consents.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No consent received. ABDM sends one when the patient approves a request to see these
        records.
      </Text>
    );
  }
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Requested by</Table.Th>
          <Table.Th>Purpose</Table.Th>
          <Table.Th>Records</Table.Th>
          <Table.Th>Covers</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {consents.map((c) => (
          <Table.Tr key={c.id}>
            <Table.Td>
              <Text size="sm">{c.hiu_id ?? "—"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{c.purpose_text ?? "—"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{c.hi_types.map((t) => HI_TYPE_LABEL[t] ?? t).join(", ")}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">
                {formatDate(c.date_from)} – {formatDate(c.date_to)}
              </Text>
              <Text size="xs" c="dimmed">
                Erase by {formatDate(c.data_erase_at)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge tone={CONSENT_STATUS[c.status] ?? "neutral"}>{c.status.toLowerCase()}</Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
