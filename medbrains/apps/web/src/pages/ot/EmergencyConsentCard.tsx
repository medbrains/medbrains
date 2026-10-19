/**
 * Emergency implied consent: two different doctors each certify, in their own
 * session, that the operation cannot wait for consent. Each certification asks
 * for the doctor's password again (the app-wide step-up prompt), so neither
 * can be recorded on the other's behalf. Emergency bookings only.
 */
import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { OtBooking, OtBookingConsents } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, TextArea, toast } from "@/components/ui";
import { otService } from "@/services/ot.service";

const EMERGENCY_OVERRIDE = P.OT.CONSENT_EMERGENCY_OVERRIDE;

interface EmergencyConsentCardProps {
  booking: OtBooking;
  consents: OtBookingConsents;
  queryKey: readonly unknown[];
}

export function EmergencyConsentCard({ booking, consents, queryKey }: EmergencyConsentCardProps) {
  const qc = useQueryClient();
  const canCertify = useHasPermission(EMERGENCY_OVERRIDE);
  const [reason, setReason] = useState("");
  const emergency = consents.emergency;

  const certify = useMutation({
    mutationFn: () => otService.certifyOtEmergencyConsent(booking.id, reason.trim() || undefined),
    onSuccess: (data) => {
      qc.setQueryData(queryKey, data);
      setReason("");
      toast.success("Certification recorded");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not certified" }),
  });

  if (booking.priority !== "emergency") return null;
  if (!emergency && (!consents.block_reason || !canCertify)) return null;

  if (emergency?.second_certified_at) {
    return (
      <Alert tone="info" title="Emergency implied consent">
        Certified by {emergency.first_doctor_name ?? "—"} and {emergency.second_doctor_name ?? "—"}:{" "}
        {emergency.reason}
      </Alert>
    );
  }

  return (
    <Alert tone="warning" title="Emergency implied consent">
      <Stack gap="xs">
        {emergency ? (
          <Text size="sm">
            Certified by {emergency.first_doctor_name ?? "—"} (
            {new Date(emergency.first_certified_at).toLocaleString()}): {emergency.reason}. A
            second, different doctor must certify in their own session before surgery can start.
          </Text>
        ) : (
          <TextArea
            label="Why the operation cannot wait for consent"
            required
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
        )}
        {canCertify && (
          <Button
            tone="danger"
            size="sm"
            disabled={!emergency && reason.trim().length === 0}
            loading={certify.isPending}
            onClick={() => certify.mutate()}
          >
            {emergency ? "Certify as second doctor" : "Certify as first doctor"}
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
