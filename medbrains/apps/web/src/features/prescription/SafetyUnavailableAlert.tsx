import { Alert } from "@/components/ui";

/**
 * Shown when the drug-safety check could not run. Says plainly that nothing
 * on the rail was screened, so an empty rail is not read as "all clear".
 */
export function SafetyUnavailableAlert() {
  return (
    <Alert tone="warning" title="Safety check unavailable">
      The drug-safety service could not be reached, so these drugs have not been screened for
      interactions, allergies or dose limits. The server re-checks allergies and serious
      interactions at save; check doses by hand.
    </Alert>
  );
}
