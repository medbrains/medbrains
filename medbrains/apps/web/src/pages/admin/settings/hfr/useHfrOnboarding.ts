import type {
  FacilityHfr,
  HfrFacilityInformation,
  HfrOnboardingDraft,
  HfrStepSaved,
  HprSessionView,
} from "@medbrains/types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useHfrSystems } from "./useHfrMaster";

export const HFR_ONBOARDING_KEY = "abdm-hfr-onboarding";
export const BASIC = 1;
export const SUBMIT = 4;

/**
 * The state of one onboarding sitting: which step is open and how far the
 * user has got, the tracking ID, the HPR sign-ins, and what basic information
 * saved that later steps need. A campus with a tracking ID opens at basic
 * information with every step reachable, ready to update.
 */
export function useHfrOnboarding(
  facility: FacilityHfr,
  draft: HfrOnboardingDraft,
  hfrListKey: readonly unknown[],
) {
  const queryClient = useQueryClient();
  const isUpdate = draft.tracking_id !== null;
  const [step, setStep] = useState(isUpdate ? BASIC : 0);
  const [reached, setReached] = useState(isUpdate ? SUBMIT : 0);
  const [trackingId, setTrackingId] = useState(draft.tracking_id ?? "");
  const [sessions, setSessions] = useState<HprSessionView[]>(draft.hpr_sessions);
  const [basic, setBasic] = useState<HfrFacilityInformation | null>(draft.basic);
  const [typeName, setTypeName] = useState("");
  const systems = useHfrSystems(basic);

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
  /** A step saved on HFR: refresh, then open `next`. */
  const advance = (next: number) => () => {
    refresh();
    goTo(next);
  };
  /** Basic information saved: keep what later steps need, then go on. */
  const basicSaved = (saved: HfrStepSaved, info: HfrFacilityInformation, name: string) => {
    setTrackingId(saved.tracking_id);
    setBasic(info);
    setTypeName(name);
    advance(BASIC + 1)();
  };
  /** Replace the session for the role that just signed in to HPR. */
  const signedIn = (view: HprSessionView) =>
    setSessions((cur) => [...cur.filter((s) => s.role !== view.role), view]);
  /** The stepper may go back to any step already reached, never ahead. */
  const pick = (i: number) => i <= reached && setStep(i);

  const manager = sessions.find((s) => s.role === "manager");
  return {
    step,
    pick,
    goTo,
    advance,
    basicSaved,
    refresh,
    trackingId,
    sessions,
    signedIn,
    manager,
    typeName,
    systems,
  };
}
