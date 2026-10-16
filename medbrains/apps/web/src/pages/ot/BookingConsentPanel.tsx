/**
 * Consent for the booked operation (IPSG-4).
 *
 * Surgery starts only with a signed surgical consent linked to THIS booking,
 * plus an anaesthesia consent when an anaesthetist is on it. The patient's
 * other consents are listed so the person holding the consent form can link
 * the right one after reading it; the server re-checks every link and the
 * start of surgery against the same rule.
 */
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { OtBooking, OtConsentOption } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Table, TextArea, toast } from "@/components/ui";
import { otService } from "@/services/ot.service";
import { consentTypeLabel } from "./consent-labels";
import { EmergencyConsentCard } from "./EmergencyConsentCard";

export function BookingConsentPanel({ booking }: { booking: OtBooking }) {
  const qc = useQueryClient();
  const canRead = useHasPermission(P.OT.BOOKINGS_LIST);
  const canLink = useHasPermission(P.OT.BOOKINGS_UPDATE);
  const [pending, setPending] = useState<OtConsentOption | null>(null);
  const [unlinking, setUnlinking] = useState<OtConsentOption | null>(null);
  const [unlinkReason, setUnlinkReason] = useState("");
  // The server refuses to unlink once surgery has started; so does the screen.
  const canUnlink = canLink && booking.status !== "in_progress" && booking.status !== "completed";
  const queryKey = ["ot-booking-consents", booking.id];

  const status = useQuery({
    queryKey,
    queryFn: () => otService.getOtBookingConsents(booking.id),
    enabled: canRead,
  });

  const link = useMutation({
    mutationFn: (consentId: string) => otService.linkOtBookingConsent(booking.id, consentId),
    onSuccess: (data) => {
      qc.setQueryData(queryKey, data);
      setPending(null);
      toast.success("Consent linked to this operation");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Consent not linked" }),
  });

  const unlink = useMutation({
    mutationFn: (consentId: string) =>
      otService.unlinkOtBookingConsent(booking.id, consentId, unlinkReason.trim()),
    onSuccess: (data) => {
      qc.setQueryData(queryKey, data);
      setUnlinking(null);
      setUnlinkReason("");
      toast.success("Consent unlinked from this operation");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Consent not unlinked" }),
  });

  if (!canRead) return null;
  if (status.isError) {
    // An outage is not "no consent" — and not "consent on file" either.
    return (
      <Alert tone="danger" title="Consent status could not be read">
        This is a failed check, not a missing consent. Verify the signed consent form before
        proceeding.
      </Alert>
    );
  }
  if (!status.data) {
    return (
      <Text size="sm" c="dimmed">
        Checking consent…
      </Text>
    );
  }

  const { block_reason, consents, anaesthesia_required, emergency } = status.data;
  const onEmergency = !!emergency?.second_certified_at;
  return (
    <Stack gap="xs">
      {block_reason ? (
        <Alert tone="warning" title="Consent incomplete — surgery cannot start">
          {block_reason}
        </Alert>
      ) : (
        <Alert tone="success" title="Consent complete">
          {onEmergency
            ? "Proceeding on emergency implied consent certified by two doctors."
            : `Signed surgical consent${anaesthesia_required ? " and anaesthesia consent" : ""} linked to this operation.`}
        </Alert>
      )}
      <EmergencyConsentCard booking={booking} consents={status.data} queryKey={queryKey} />

      {consents.length > 0 && (
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Consent for</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Signed</Table.Th>
              <Table.Th>This operation</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {consents.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.procedure_name}</Table.Td>
                <Table.Td>{consentTypeLabel(c.consent_type)}</Table.Td>
                <Table.Td>{c.signed_at ? new Date(c.signed_at).toLocaleString() : "—"}</Table.Td>
                <Table.Td>
                  {c.linked ? (
                    <Group gap="xs">
                      <Badge tone="success">Linked</Badge>
                      {canUnlink && (
                        <Button tone="ghost" size="xs" onClick={() => setUnlinking(c)}>
                          Unlink
                        </Button>
                      )}
                    </Group>
                  ) : canLink ? (
                    <Button tone="tertiary" size="xs" onClick={() => setPending(c)}>
                      Link
                    </Button>
                  ) : (
                    "—"
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {unlinking && (
        <Alert tone="warning" title={`Unlink the consent for ${unlinking.procedure_name}`}>
          <Stack gap="xs">
            <TextArea
              label="Reason"
              required
              value={unlinkReason}
              onChange={(e) => setUnlinkReason(e.currentTarget.value)}
            />
            <Group gap="xs">
              <Button
                tone="danger"
                size="sm"
                disabled={unlinkReason.trim().length === 0}
                loading={unlink.isPending}
                onClick={() => unlink.mutate(unlinking.id)}
              >
                Unlink
              </Button>
              <Button tone="ghost" size="sm" onClick={() => setUnlinking(null)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      {pending && (
        <Alert tone="info" title="Confirm the consent covers this operation">
          <Stack gap="xs">
            <Text size="sm">
              Booked: <b>{booking.procedure_name}</b>. Consent signed for:{" "}
              <b>{pending.procedure_name}</b> ({consentTypeLabel(pending.consent_type)}). Link only
              if you have read the consent and it covers this operation.
            </Text>
            <Group gap="xs">
              <Button
                tone="primary"
                size="sm"
                loading={link.isPending}
                onClick={() => link.mutate(pending.id)}
              >
                It covers this operation — link
              </Button>
              <Button tone="ghost" size="sm" onClick={() => setPending(null)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
