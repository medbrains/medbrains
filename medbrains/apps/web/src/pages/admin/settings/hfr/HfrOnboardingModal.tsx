/**
 * Register or update one campus on ABDM's Health Facility Registry through
 * HFR's official flow (#5716): search → basic → additional → detailed →
 * submit, in a full-screen modal. The draft is kept on the server under
 * HFR's trackingId, so a sitting can stop and resume at any step; a campus
 * with a trackingId opens at basic information, ready to update.
 */

import { Group, Loader, Stack, Stepper, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
  FacilityHfr,
  HfrFacilityInformation,
  HfrOnboardingDraft,
  HprSessionView,
} from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Modal } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";
import { EMPTY_PROGRAM_IDS, HfrAdditionalStep } from "./HfrAdditionalStep";
import { HfrBasicStep } from "./HfrBasicStep";
import { HfrDetailedStep } from "./HfrDetailedStep";
import { HfrSearchStep } from "./HfrSearchStep";
import { HfrSubmitStep } from "./HfrSubmitStep";
import { HprSignInPanel } from "./HprSignInPanel";
import { emptyBasic, fromFacilityInformation } from "./hfrRules";
import { useHfrMaster } from "./useHfrMaster";

export const HFR_ONBOARDING_KEY = "abdm-hfr-onboarding";
const STEPS = ["Search HFR", "Basic", "Additional", "Detailed", "Submit"] as const;
const BASIC = 1;
const SUBMIT = 4;

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
  const queryClient = useQueryClient();
  const isUpdate = draft.tracking_id !== null;
  const [step, setStep] = useState(isUpdate ? BASIC : 0);
  const [reached, setReached] = useState(isUpdate ? SUBMIT : 0);
  const [trackingId, setTrackingId] = useState(draft.tracking_id ?? "");
  const [sessions, setSessions] = useState<HprSessionView[]>(draft.hpr_sessions);
  const [basic, setBasic] = useState<HfrFacilityInformation | null>(draft.basic);
  const [typeName, setTypeName] = useState("");
  const medicine = useHfrMaster("data", "MEDICINE", "", basic !== null);
  const systems = useMemo(
    () =>
      (basic?.systemOfMedicineCode ?? "")
        .split(",")
        .filter((c) => c !== "")
        .map((code) => ({
          code,
          name: medicine.data.find((m) => m.value === code)?.label ?? code,
        })),
    [basic, medicine.data],
  );
  const manager = sessions.find((s) => s.role === "manager");

  /** Re-read the draft and the facilities list after HFR saved something. */
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: [HFR_ONBOARDING_KEY, facility.id] });
    void queryClient.invalidateQueries({ queryKey: hfrListKey });
  };
  /** Move to a step, and let the stepper go back to it later. */
  const goTo = (next: number) => {
    setReached((r) => Math.max(r, next));
    setStep(next);
  };
  /** Replace the session for the role that just signed in to HPR. */
  const signedIn = (view: HprSessionView) =>
    setSessions((cur) => [...cur.filter((s) => s.role !== view.role), view]);
  const link = useMutation({
    mutationFn: (hfrId: string) =>
      abdmRegistryService.linkFacilityHfr(facility.id, {
        hfr_facility_id: hfrId,
        hfr_bed_count: facility.hfr_bed_count ?? facility.bed_count,
        hfr_ipd: facility.hfr_ipd,
      }),
    onSuccess: (row) => {
      notifications.show({
        title: "HFR ID linked",
        message: `${row.name}: ${row.hfr_facility_id}`,
        color: "success",
      });
      refresh();
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Link failed", message: err.message, color: "danger" }),
  });

  return (
    <Stack gap="lg">
      <Group gap="sm">
        {trackingId !== "" && <Badge tone="info">Tracking ID {trackingId}</Badge>}
        {draft.hfr_facility_id && <Badge tone="success">HFR ID {draft.hfr_facility_id}</Badge>}
        {draft.submitted_at && (
          <Badge tone="neutral">
            Last submitted {new Date(draft.submitted_at).toLocaleString()}
          </Badge>
        )}
      </Group>
      <Stepper
        active={step}
        onStepClick={(i) => i <= reached && setStep(i)}
        allowNextStepsSelect={false}
      >
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
          onRegisterNew={() => goTo(BASIC)}
        />
      )}
      {step === BASIC && (
        <Stack gap="md">
          <HprSignInPanel hprRole="manager" session={manager} onSignedIn={signedIn} />
          <HfrBasicStep
            facilityId={facility.id}
            initial={draft.basic ? fromFacilityInformation(draft.basic) : emptyBasic(facility.name)}
            signedIn={manager !== undefined}
            onSaved={(saved, info, name) => {
              setTrackingId(saved.tracking_id);
              setBasic(info);
              setTypeName(name);
              refresh();
              goTo(2);
            }}
          />
        </Stack>
      )}
      {step === 2 && (
        <HfrAdditionalStep
          facilityId={facility.id}
          initial={draft.additional?.linkedProgramIds ?? EMPTY_PROGRAM_IDS}
          onSaved={() => {
            refresh();
            goTo(3);
          }}
        />
      )}
      {step === 3 && (
        <HfrDetailedStep
          facilityId={facility.id}
          systems={systems}
          facilityTypeName={typeName}
          initial={draft.detailed}
          onSaved={() => {
            refresh();
            goTo(SUBMIT);
          }}
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
