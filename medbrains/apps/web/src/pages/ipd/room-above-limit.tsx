// A room above the policy's room rent limit: the disclosure read to the
// family, the estimated proportionate cut, and their witnessed consent. Only
// someone who may record consent (`insurance.room_eligibility.resolve`)
// captures it here; for anyone else the insurance desk follows up.

import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type RoomCheck, type RoomConsentInput } from "@medbrains/types";
import { useState } from "react";
import { emptyConsent, isConsentComplete, RoomConsentFields } from "@/components/RoomConsentFields";
import { roomDisclosure } from "@/components/room-disclosure";
import { Alert, Checkbox, NumberField } from "@/components/ui";
import { estimateDeduction, inr } from "@/pages/billing/revenue-alerts/revenue-alerts-labels";

interface RoomAboveLimitProps {
  check: RoomCheck;
  onConsentChange: (consent: RoomConsentInput | undefined) => void;
}

/** The warning, the estimated cut and the consent for a room above the limit. */
export function RoomAboveLimit({ check, onConsentChange }: RoomAboveLimitProps) {
  const canRecord = useHasPermission(P.INSURANCE.ROOM_ELIGIBILITY.RESOLVE);
  const ratio = Number(check.payable_ratio);
  const [bill, setBill] = useState<number | "">(Number(check.associated_so_far ?? 0) || "");
  const [agreed, setAgreed] = useState(false);
  const [who, setWho] = useState<RoomConsentInput>(emptyConsent);
  /** Pass the consent up only when agreed and complete. */
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
          allows {inr(check.eligible_rate)}.
        </Text>
        <Text size="sm">{roomDisclosure(Math.floor(ratio * 1000) / 10)}</Text>
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
        {canRecord ? (
          <>
            <Checkbox
              label="The patient or family was read this and agrees to pay the deduction"
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
          </>
        ) : (
          <Text size="xs" c="dimmed">
            The bed is still allocated; the insurance desk records the family's consent.
          </Text>
        )}
      </Stack>
    </Alert>
  );
}
