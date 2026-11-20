/**
 * Step 5 — submit (HFR-062/063; resubmit after an update, HFR-116/117).
 * Needs the facility manager's and a verifier's HPR sign-in; the source
 * fields are left for HFR to treat the campus as a submitted entity. A
 * submitted campus then waits on NHA or state review — that is not a failure.
 */

import { Stack, Text } from "@mantine/core";
import type { HfrSubmitResult, HprSessionView } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { HprSignInPanel } from "./HprSignInPanel";

interface HfrSubmitStepProps {
  facilityId: string;
  trackingId: string;
  isUpdate: boolean;
  sessions: HprSessionView[];
  onSignedIn: (view: HprSessionView) => void;
  onSubmitted: (result: HfrSubmitResult) => void;
}

/** Verifier sign-in, then submit, then HFR's answer. */
export function HfrSubmitStep(props: HfrSubmitStepProps) {
  const { facilityId, trackingId, isUpdate, sessions, onSignedIn, onSubmitted } = props;
  const manager = sessions.find((s) => s.role === "manager");
  const verifier = sessions.find((s) => s.role === "verifier");
  const submit = useMutation({
    mutationFn: () => abdmRegistryService.submitHfrFacility(facilityId),
    onSuccess: onSubmitted,
  });
  return (
    <Stack gap="md">
      <Text size="sm">
        {isUpdate ? "Resubmit" : "Submit"} tracking ID <strong>{trackingId}</strong> to HFR for
        review. NHA or the state reviews it before the facility is approved.
      </Text>
      <HprSignInPanel hprRole="manager" session={manager} onSignedIn={onSignedIn} />
      <HprSignInPanel hprRole="verifier" session={verifier} onSignedIn={onSignedIn} />
      {submit.isError && (
        <Alert tone="danger" title="HFR did not accept the submission">
          {submit.error.message}
        </Alert>
      )}
      {submit.data && (
        <Alert tone="success" title="Submitted to HFR">
          {submit.data.facility_id
            ? `HFR facility ID ${submit.data.facility_id}. `
            : "HFR will issue the facility ID after review. "}
          {submit.data.message ?? ""}
        </Alert>
      )}
      <Button
        tone="primary"
        disabled={!manager || !verifier || submit.isSuccess}
        loading={submit.isPending}
        onClick={() => submit.mutate()}
      >
        {isUpdate ? "Resubmit to HFR" : "Submit to HFR"}
      </Button>
    </Stack>
  );
}
