// Before a bed is allocated (admission or transfer): the room's rate against
// the patient's policy room-rent limit. Above it, the desk shows the family
// the proportionate deduction IRDAI lets the insurer make on every room-linked
// charge, and records their consent if they still choose the room. A failed
// check is shown as a fault, never as "within limit".

import { Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type RoomCheck, type RoomConsentInput } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { inr } from "@/pages/billing/revenue-alerts/revenue-alerts-labels";
import { ipdService } from "@/services/ipd.service";
import { RoomAboveLimit } from "./room-above-limit";
import { RoomLimitModal } from "./room-limit-modal";

interface RoomEligibilityNoticeProps {
  patientId: string;
  bedId: string;
  /** The admission being transferred; empty for a new admission. */
  admissionId?: string;
  /** The consent to send with the allocation, or undefined for none. */
  onConsentChange: (consent: RoomConsentInput | undefined) => void;
}

/**
 * The consent held for the bed now chosen. A consent given for one bed is
 * never sent with another: choosing a different bed drops it.
 */
export function useRoomConsent(bedId: string) {
  const [held, setHeld] = useState<{ bedId: string; consent: RoomConsentInput } | null>(null);
  const consent = held && held.bedId === bedId ? held.consent : undefined;
  /** Hold `next` against the bed chosen now; undefined drops it. */
  const setConsent = (next: RoomConsentInput | undefined) =>
    setHeld(next ? { bedId, consent: next } : null);
  return [consent, setConsent] as const;
}

/** One line for the checks that need no decision. */
function quietLine(check: RoomCheck): string | null {
  switch (check.status) {
    case "within":
      return `Within the policy's room limit of ${inr(check.eligible_rate)} a day.`;
    case "unpriced":
      return "This bed has no daily rate, so it was not checked against the policy.";
    case "icu":
      return "ICU bed: the insurer may not cut charges in proportion for ICU.";
    case "no_differential_billing":
      return "This hospital charges the same in every room, so there is no deduction here.";
    default:
      return null;
  }
}

/**
 * Record or correct the policy's room rent limit, for someone who may
 * configure it; nothing for anyone else or without a policy.
 */
function EditLimit({ check, label }: { check: RoomCheck; label: string }) {
  const canConfigure = useHasPermission(P.INSURANCE.ROOM_ELIGIBILITY.CONFIGURE);
  const [editing, setEditing] = useState(false);
  if (!canConfigure || !check.patient_insurance_id) return null;
  return (
    <>
      <Button tone="secondary" size="xs" onClick={() => setEditing(true)}>
        {label}
      </Button>
      {editing && (
        <RoomLimitModal
          policyId={check.patient_insurance_id}
          insurer={check.insurance_provider}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

/** No limit on the policy: say so, and let the insurance desk record it. */
function NoLimit({ check }: { check: RoomCheck }) {
  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">
        No room rent limit is recorded on the patient's policy, so this room was not checked.
      </Text>
      <EditLimit check={check} label="Record the limit" />
    </Group>
  );
}

/** The room check for the chosen bed, with consent capture when above the limit. */
export function RoomEligibilityNotice({
  patientId,
  bedId,
  admissionId,
  onConsentChange,
}: RoomEligibilityNoticeProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ipd", "room-eligibility", patientId, bedId, admissionId ?? ""],
    queryFn: () =>
      ipdService.checkRoomEligibility({
        patient_id: patientId,
        bed_id: bedId,
        admission_id: admissionId,
      }),
    enabled: Boolean(patientId && bedId),
  });
  if (!patientId || !bedId) return null;
  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Checking the room against the patient's policy…
      </Text>
    );
  }
  if (isError || !data) {
    return (
      <Alert tone="danger" title="Could not check this room against the policy">
        The room may be above the policy limit. Check with the insurance desk before allocating.
      </Alert>
    );
  }
  if (data.status === "above") {
    return (
      <>
        <RoomAboveLimit key={bedId} check={data} onConsentChange={onConsentChange} />
        <EditLimit check={data} label="Edit the limit" />
      </>
    );
  }
  if (data.status === "no_limit") return <NoLimit check={data} />;
  if (data.status === "limit_unknown") {
    return (
      <Alert tone="danger" title="Could not work out the policy's room limit">
        The limit is a share of the sum insured, which is not recorded on the policy. Check the
        e-card, or record the limit in rupees a day, before allocating.{" "}
        <EditLimit check={data} label="Edit the limit" />
      </Alert>
    );
  }
  const line = quietLine(data);
  if (!line) return null;
  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">
        {line}
      </Text>
      {data.status === "within" && <EditLimit check={data} label="Edit the limit" />}
    </Group>
  );
}
