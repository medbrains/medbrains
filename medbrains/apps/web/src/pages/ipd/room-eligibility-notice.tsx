// Before a bed is allocated (admission or transfer): the room's rate against
// the patient's policy room-rent limit. Above it, the desk shows the family
// the proportionate deduction IRDAI lets the insurer make on every room-linked
// charge, and records their consent if they still choose the room. A failed
// check is shown as a fault, never as "within limit".

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type RoomCheck, type RoomConsentInput } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isConsentComplete, RoomConsentFields } from "@/components/RoomConsentFields";
import { Alert, Button, Checkbox, NumberField } from "@/components/ui";
import { estimateDeduction, inr } from "@/pages/billing/revenue-alerts/revenue-alerts-labels";
import { ipdService } from "@/services/ipd.service";
import { RoomLimitModal } from "./room-limit-modal";

interface RoomEligibilityNoticeProps {
  patientId: string;
  bedId: string;
  /** The admission being transferred; empty for a new admission. */
  admissionId?: string;
  /** The consent to send with the allocation, or undefined for none. */
  onConsentChange: (consent: RoomConsentInput | undefined) => void;
}

const EMPTY: RoomConsentInput = { consented_by_name: "", consenter_relation: "" };

/**
 * The consent held for the bed now chosen. A consent given for one bed is
 * never sent with another: choosing a different bed drops it.
 */
export function useRoomConsent(bedId: string) {
  const [held, setHeld] = useState<{ bedId: string; consent: RoomConsentInput } | null>(null);
  const consent = held && held.bedId === bedId ? held.consent : undefined;
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
    default:
      return null;
  }
}

/** No limit on the policy: say so, and let the insurance desk record it. */
function NoLimit({ check }: { check: RoomCheck }) {
  const canConfigure = useHasPermission(P.INSURANCE.ROOM_ELIGIBILITY.CONFIGURE);
  const [editing, setEditing] = useState(false);
  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">
        No room rent limit is recorded on the patient's policy, so this room was not checked.
      </Text>
      {canConfigure && check.patient_insurance_id && (
        <Button tone="secondary" size="xs" onClick={() => setEditing(true)}>
          Record the limit
        </Button>
      )}
      {editing && check.patient_insurance_id && (
        <RoomLimitModal
          policyId={check.patient_insurance_id}
          insurer={check.insurance_provider}
          onClose={() => setEditing(false)}
        />
      )}
    </Group>
  );
}

/** The warning, the estimated cut and the consent for a room above the limit. */
function AboveLimit({
  check,
  onConsentChange,
}: { check: RoomCheck } & Pick<RoomEligibilityNoticeProps, "onConsentChange">) {
  const ratio = Number(check.payable_ratio);
  const [bill, setBill] = useState<number | "">(Number(check.associated_so_far ?? 0) || "");
  const [agreed, setAgreed] = useState(false);
  const [who, setWho] = useState<RoomConsentInput>(EMPTY);
  /** Pass the consent up only when it is agreed and names who agreed. */
  const publish = (nextAgreed: boolean, nextWho: RoomConsentInput, nextBill: number | "") =>
    onConsentChange(
      nextAgreed && isConsentComplete(nextWho)
        ? { ...nextWho, estimated_bill: nextBill === "" ? undefined : nextBill }
        : undefined,
    );
  return (
    <Alert tone="warning" title="Room above the policy's room rent limit">
      <Stack gap="xs">
        <Text size="sm">
          This room is {inr(check.room_rate)} a day; {check.insurance_provider ?? "the policy"}{" "}
          allows {inr(check.eligible_rate)}. The insurer may then pay only{" "}
          {Math.round(ratio * 1000) / 10}% of every room-linked charge (doctor visits, nursing, OT,
          procedures), not just refuse the rent difference. Medicines, implants and tests are not
          cut.
        </Text>
        <NumberField
          label="Estimated room-linked bill (₹)"
          min={0}
          value={bill}
          onChange={(v) => {
            const next = typeof v === "number" ? v : "";
            setBill(next);
            publish(agreed, who, next);
          }}
        />
        {bill !== "" && (
          <Text size="sm" fw={600}>
            Estimated deduction the family would pay: {inr(estimateDeduction(bill, ratio))}
          </Text>
        )}
        <Checkbox
          label="The patient or family was shown this and agrees to pay the deduction"
          checked={agreed}
          onChange={(e) => {
            setAgreed(e.currentTarget.checked);
            publish(e.currentTarget.checked, who, bill);
          }}
        />
        {agreed && (
          <RoomConsentFields
            value={who}
            onChange={(next) => {
              setWho(next);
              publish(agreed, next, bill);
            }}
          />
        )}
        {!agreed && (
          <Text size="xs" c="dimmed">
            Without consent the bed is still allocated, and the insurance desk is asked to follow
            up.
          </Text>
        )}
      </Stack>
    </Alert>
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
    return <AboveLimit key={bedId} check={data} onConsentChange={onConsentChange} />;
  }
  if (data.status === "no_limit") return <NoLimit check={data} />;
  const line = quietLine(data);
  return line ? (
    <Text size="sm" c="dimmed">
      {line}
    </Text>
  ) : null;
}
