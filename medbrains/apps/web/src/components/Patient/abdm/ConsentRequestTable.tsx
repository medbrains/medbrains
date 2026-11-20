import { Stack, Text } from "@mantine/core";
import type { AbdmConsentRequest } from "@medbrains/types";
import { Badge, Table } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { CONSENT_REQUEST_STATUS, HI_TYPE_LABEL, PURPOSE_LABEL, statusHint } from "./abdmStatus";
import { CheckConsentStatusButton } from "./CheckConsentStatusButton";

interface ConsentRequestTableProps {
  requests: AbdmConsentRequest[];
  /** Holds `abdm.consent.request` — may ask ABDM where a request stands. */
  canCheck: boolean;
  /** Hospital-wide list: name the patient on each row. */
  showPatient?: boolean;
  /** What an empty list says; it is only shown for a list that loaded. */
  emptyText: string;
}

/** Record types in staff words. */
function typesText(types: string[]): string {
  return types.map((t) => HI_TYPE_LABEL[t] ?? t).join(", ");
}

/** The ABHA the request went to: number (when held) and address. */
function AbhaCell({ r }: { r: AbdmConsentRequest }) {
  return (
    <Stack gap={0}>
      <Text size="sm" ff="monospace">
        {r.abha_number ?? "ABHA number not held"}
      </Text>
      <Text size="xs" ff="monospace" c="dimmed">
        {r.abha_address}
      </Text>
    </Stack>
  );
}

/**
 * The scope the patient granted once ABDM sent it (they may narrow the
 * record types and dates when granting), else the scope asked for —
 * labelled, so one is never mistaken for the other.
 */
function ScopeCell({ r }: { r: AbdmConsentRequest }) {
  const granted = r.granted_hi_types !== null;
  const types = r.granted_hi_types ?? r.hi_types;
  const from = r.granted_from ?? r.date_from;
  const to = r.granted_to ?? r.date_to;
  const eraseAt = r.granted_erase_at ?? r.data_erase_at;
  return (
    <Stack gap={2}>
      <Text size="xs" fw={600}>
        {granted ? "Granted" : "Asked for"}
      </Text>
      <Text size="sm">{typesText(types)}</Text>
      <Text size="xs" c="dimmed">
        {formatDate(from)} – {formatDate(to)} · expires {formatDateTime(eraseAt)}
      </Text>
      {granted && typesText(r.hi_types) !== typesText(types) && (
        <Text size="xs" c="dimmed">
          Asked for {typesText(r.hi_types)}
        </Text>
      )}
    </Stack>
  );
}

/** Status with its time, the grant time, and the records it brought. */
function StatusCell({ r, canCheck }: { r: AbdmConsentRequest; canCheck: boolean }) {
  const status = CONSENT_REQUEST_STATUS[r.status];
  const waiting = r.status === "awaiting_patient";
  return (
    <Stack gap={4} align="flex-start">
      <Badge tone={status.tone}>{status.label}</Badge>
      <Text size="xs">
        {status.label} {formatDateTime(r.status_at)}
      </Text>
      {r.granted_at && r.status !== "granted" && (
        <Text size="xs" c="dimmed">
          Granted {formatDateTime(r.granted_at)}
        </Text>
      )}
      <Text size="xs">{r.error ?? statusHint(r)}</Text>
      {r.records_received > 0 && (
        <Text size="xs" c="dimmed">
          {r.records_held} of {r.records_received} records held
        </Text>
      )}
      {waiting && (
        <Text size="xs" c="dimmed">
          {r.status_checked_at
            ? `Last checked ${formatDateTime(r.status_checked_at)}`
            : "Not checked with ABDM yet"}
        </Text>
      )}
      {canCheck && waiting && (
        <CheckConsentStatusButton patientId={r.patient_id} requestId={r.id} />
      )}
    </Stack>
  );
}

/** One request's row. */
function RequestRow({
  r,
  canCheck,
  showPatient,
}: {
  r: AbdmConsentRequest;
  canCheck: boolean;
  showPatient: boolean;
}) {
  return (
    <Table.Tr>
      {showPatient && (
        <Table.Td>
          <Text size="sm">{r.patient_name}</Text>
          <Text size="xs" ff="monospace" c="dimmed">
            {r.uhid}
          </Text>
        </Table.Td>
      )}
      <Table.Td>
        <AbhaCell r={r} />
      </Table.Td>
      <Table.Td>
        <Text size="sm">{formatDateTime(r.requested_at)}</Text>
        <Text size="xs" c="dimmed">
          {r.requester_name} · {PURPOSE_LABEL[r.purpose_code]}
        </Text>
      </Table.Td>
      <Table.Td>
        <ScopeCell r={r} />
      </Table.Td>
      <Table.Td>
        <StatusCell r={r} canCheck={canCheck} />
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Consent requests as an HIU (HIU_FLOW_104): ABHA number and address, when
 * it was created, the scope granted (or asked for), the expiry, and the
 * status with the time it was reached. One still waiting for the patient
 * shows when ABDM was last asked about it, and can be checked again.
 */
export function ConsentRequestTable({
  requests,
  canCheck,
  showPatient = false,
  emptyText,
}: ConsentRequestTableProps) {
  if (requests.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {emptyText}
      </Text>
    );
  }
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          {showPatient && <Table.Th>Patient</Table.Th>}
          <Table.Th>ABHA</Table.Th>
          <Table.Th>Created</Table.Th>
          <Table.Th>Records and expiry</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {requests.map((r) => (
          <RequestRow key={r.id} r={r} canCheck={canCheck} showPatient={showPatient} />
        ))}
      </Table.Tbody>
    </Table>
  );
}
