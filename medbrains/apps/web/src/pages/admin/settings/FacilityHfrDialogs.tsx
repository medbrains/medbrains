/**
 * The HFR dialogs for one campus: the link/status dialog, and the stepped
 * onboarding screen it hands over to. Kept apart from the facilities table so
 * the onboarding state lives with the dialogs that use it.
 */
import type { FacilityHfr } from "@medbrains/types";
import { useState } from "react";
import { FacilityHfrModal, HFR_QUERY_KEY } from "./FacilityHfrModal";
import { HfrOnboardingModal } from "./hfr/HfrOnboardingModal";

interface FacilityHfrDialogsProps {
  /** The campus whose HFR dialog is open; none renders nothing. */
  facility: FacilityHfr | undefined;
  registryConfigured: boolean;
  onClose: () => void;
}

/** Shows the HFR dialog, or the onboarding screen once the user starts it. */
export function FacilityHfrDialogs({
  facility,
  registryConfigured,
  onClose,
}: FacilityHfrDialogsProps) {
  const [onboarding, setOnboarding] = useState(false);
  if (!facility) return null;
  /** Close, and open on the dialog (not onboarding) for the next campus. */
  const close = () => {
    setOnboarding(false);
    onClose();
  };
  if (onboarding) {
    return <HfrOnboardingModal facility={facility} hfrListKey={HFR_QUERY_KEY} onClose={close} />;
  }
  return (
    <FacilityHfrModal
      facility={facility}
      registryConfigured={registryConfigured}
      onClose={close}
      onOnboard={() => setOnboarding(true)}
    />
  );
}
