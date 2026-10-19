import { Stack, Text } from "@mantine/core";
import type { AbdmConsentRequest } from "@medbrains/types";
import { Badge, Table } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { CONSENT_REQUEST_STATUS, HI_TYPE_LABEL, PURPOSE_LABEL } from "./abdmStatus";
import { CheckConsentStatusButton } from "./CheckConsentStatusButton";

interface ConsentRequestTableProps {
  patientId: string;
  requests: AbdmConsentRequest[];
  /** Holds `abdm.consent.request` — may ask ABDM where a request stands. */
  canCheck: boolean;
}

/**
 * Consent requests raised for this patient, each with what its state means.
 * One still waiting for the patient shows when ABDM was last asked about it,
 * and can be checked again.
 */
export function ConsentRequestTable({ patientId, requests, canCheck }: ConsentRequestTableProps) {
  if (requests.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No request yet. Ask for the patient's records from other hospitals with "Request records".
      </Text>
    );
  }
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Requested</Table.Th>
          <Table.Th>Purpose</Table.Th>
          <Table.Th>Records</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {requests.map((r) => {
          const status = CONSENT_REQUEST_STATUS[r.status];
          return (
            <Table.Tr key={r.id}>
              <Table.Td>
                <Text size="sm">{formatDateTime(r.requested_at)}</Text>
                <Text size="xs" c="dimmed">
                  {r.requester_name}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{PURPOSE_LABEL[r.purpose_code]}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.hi_types.map((t) => HI_TYPE_LABEL[t] ?? t).join(", ")}</Text>
                <Text size="xs" c="dimmed">
                  {formatDate(r.date_from)} – {formatDate(r.date_to)} · erase by{" "}
                  {formatDate(r.data_erase_at)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Stack gap={4} align="flex-start">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <Text size="xs">{r.error ?? status.hint}</Text>
                  {r.records_received > 0 && (
                    <Text size="xs" c="dimmed">
                      {r.records_held} of {r.records_received} records held
                    </Text>
                  )}
                  {r.status === "awaiting_patient" && (
                    <Text size="xs" c="dimmed">
                      {r.status_checked_at
                        ? `Last checked ${formatDateTime(r.status_checked_at)}`
                        : "Not checked with ABDM yet"}
                    </Text>
                  )}
                  {canCheck && r.status === "awaiting_patient" && (
                    <CheckConsentStatusButton patientId={patientId} requestId={r.id} />
                  )}
                </Stack>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
