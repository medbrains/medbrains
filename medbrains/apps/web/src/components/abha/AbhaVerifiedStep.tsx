import { Stack, Text } from "@mantine/core";
import type { AbhaField, AbhaVerificationStep, AbhaVerifiedProfile } from "@medbrains/types";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { abhaService } from "@/services/abha.service";
import { AbhaCompare, compareRows, type OurDetails } from "./AbhaCompare";

export interface AbhaVerified {
  verificationId: string;
  profile: AbhaVerifiedProfile;
  /** Details staff chose to take from ABHA. */
  apply: AbhaField[];
}

export interface AbhaConfirmProps {
  /** The patient's details as they are now, for the side-by-side check. */
  ours: OurDetails;
  /** Label for the final button: "Use for this registration" / "Link to this patient". */
  confirmLabel: string;
  confirming?: boolean;
  onConfirm: (verified: AbhaVerified) => void;
}

interface AbhaVerifiedStepProps extends AbhaConfirmProps {
  step: AbhaVerificationStep;
  profile: AbhaVerifiedProfile;
}

/** Take ABHA's value wherever ours is blank or different, until staff say otherwise. */
const defaultApply = (profile: AbhaVerifiedProfile, ours: OurDetails): AbhaField[] =>
  compareRows(profile, ours)
    .filter((r) => r.abha && r.abha.toLowerCase() !== r.ours.toLowerCase())
    .map((r) => r.field);

/** The last step of Verify and Create: compare, print the card, use it. */
export function AbhaVerifiedStep({
  step,
  profile,
  ours,
  confirmLabel,
  confirming,
  onConfirm,
}: AbhaVerifiedStepProps) {
  const [apply, setApply] = useState(() => defaultApply(profile, ours));
  return (
    <Stack>
      {step.message && <Text size="sm">{step.message}</Text>}
      <AbhaCompare profile={profile} ours={ours} apply={apply} onApplyChange={setApply} />
      <Button
        tone="secondary"
        onClick={() => window.open(abhaService.cardUrl(step.id), "_blank", "noopener")}
      >
        Print ABHA card
      </Button>
      {step.already_linked ? (
        <Alert tone="warning" title="This ABHA is already on another patient">
          It belongs to {step.already_linked.name} ({step.already_linked.uhid}). Open that record
          instead of registering the patient again.
        </Alert>
      ) : (
        <Button
          tone="primary"
          loading={confirming}
          onClick={() => onConfirm({ verificationId: step.id, profile, apply })}
        >
          {confirmLabel}
        </Button>
      )}
    </Stack>
  );
}
