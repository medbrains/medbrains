/**
 * Register or update one campus on ABDM's Health Facility Registry through
 * HFR's official flow (#5716): search → basic → additional → detailed →
 * submit, in a full-screen modal. The draft is kept on the server under
 * HFR's trackingId, so a sitting can stop and resume at any step; a campus
 * with a trackingId opens at basic information, ready to update.
 */

import { Group, Loader, Stack, Stepper, Text } from "@mantine/core";
import type { FacilityHfr, HfrOnboardingDraft } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Modal } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { EMPTY_PROGRAM_IDS, HfrAdditionalStep } from "./HfrAdditionalStep";
import { HfrBasicStep } from "./HfrBasicStep";
import { HfrDetailedStep } from "./HfrDetailedStep";
import { HfrDraftBadges } from "./HfrDraftBadges";
import { HfrSearchStep } from "./HfrSearchStep";
import { HfrSubmitStep } from "./HfrSubmitStep";
import { HprSignInPanel } from "./HprSignInPanel";
import { emptyBasic, fromFacilityInformation } from "./hfrBasicForm";
import { useHfrLink } from "./useHfrLink";
import { BASIC, HFR_ONBOARDING_KEY, SUBMIT, useHfrOnboarding } from "./useHfrOnboarding";

const STEPS = ["Search HFR", "Basic", "Additional", "Detailed", "Submit"] as const;

interface HfrOnboardingModalProps {
  facility: FacilityHfr;
  hfrListKey: readonly unknown[];
  onClose: () => void;
}

/** The modal shell: loads the draft, and never shows a failed load as empty. */
export function HfrOnboardingModal({ facility, hfrListKey, onClose }: HfrOnboardingModalProps) {
  const draft = useQuery({
    queryKey: [HFR_ONBOARDING_KEY, facility.id],
    queryFn: () => abdmRegistryService.getHfrOnboarding(facility.id),
  });
  return (
    <Modal
      opened
      onClose={onClose}
      fullScreen
      title={`Health Facility Registry — ${facility.name}`}
    >
      {draft.isLoading && (
        <Group justify="center" p="xl">
          <Loader aria-label="Loading the HFR draft" />
        </Group>
      )}
      {draft.isError && (
        <Alert tone="danger" title="Could not load this campus's HFR record">
          {draft.error.message}{" "}
          <Button tone="ghost" size="xs" onClick={() => void draft.refetch()}>
            Try again
          </Button>
        </Alert>
      )}
      {draft.data && !draft.data.registry_configured && (
        <Alert tone="info" title="ABDM keys are not configured">
          HFR registration needs this hospital's ABDM keys. Until then, register on
          facility.abdm.gov.in and link the ID it issues.
        </Alert>
      )}
      {draft.data?.registry_configured && (
        <OnboardingFlow
          facility={facility}
          draft={draft.data}
          hfrListKey={hfrListKey}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

interface OnboardingFlowProps {
  facility: FacilityHfr;
  draft: HfrOnboardingDraft;
  hfrListKey: readonly unknown[];
  onClose: () => void;
}

/** The stepper and the step in hand. */
function OnboardingFlow({ facility, draft, hfrListKey, onClose }: OnboardingFlowProps) {
  const flow = useHfrOnboarding(facility, draft, hfrListKey);
  const { step, trackingId, sessions, signedIn, manager, advance, refresh } = flow;
  const link = useHfrLink(facility, () => {
    refresh();
    onClose();
  });

  return (
    <Stack gap="lg">
      <HfrDraftBadges trackingId={trackingId} draft={draft} />
      <Stepper active={step} onStepClick={flow.pick} allowNextStepsSelect={false}>
        {STEPS.map((label) => (
          <Stepper.Step key={label} label={label} />
        ))}
      </Stepper>
      {step === 0 && (
        <HfrSearchStep
          defaultName={facility.name}
          canLink
          linking={link.isPending}
          onLink={(id) => link.mutate(id)}
          onRegisterNew={() => flow.goTo(BASIC)}
        />
      )}
      {step === BASIC && (
        <Stack gap="md">
          <HprSignInPanel hprRole="manager" session={manager} onSignedIn={signedIn} />
          <HfrBasicStep
            facilityId={facility.id}
            initial={draft.basic ? fromFacilityInformation(draft.basic) : emptyBasic(facility.name)}
            signedIn={manager !== undefined}
            onSaved={flow.basicSaved}
          />
        </Stack>
      )}
      {step === 2 && (
        <HfrAdditionalStep
          facilityId={facility.id}
          initial={draft.additional?.linkedProgramIds ?? EMPTY_PROGRAM_IDS}
          onSaved={advance(3)}
        />
      )}
      {step === 3 && (
        <HfrDetailedStep
          facilityId={facility.id}
          systems={flow.systems}
          facilityTypeName={flow.typeName}
          initial={draft.detailed}
          onSaved={advance(SUBMIT)}
        />
      )}
      {step === SUBMIT && (
        <HfrSubmitStep
          facilityId={facility.id}
          trackingId={trackingId}
          isUpdate={draft.submitted_at !== null}
          sessions={sessions}
          onSignedIn={signedIn}
          onSubmitted={refresh}
        />
      )}
      {step > 0 && step < SUBMIT && (
        <Text size="sm" c="dimmed">
          Each step is saved on HFR under the tracking ID; you can close this and resume later.
        </Text>
      )}
    </Stack>
  );
}
