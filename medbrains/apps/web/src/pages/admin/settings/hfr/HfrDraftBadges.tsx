/**
 * Where this campus stands on HFR, above the stepper: the tracking ID in use,
 * the HFR ID once issued, and when it was last submitted.
 */

import { Group } from "@mantine/core";
import type { HfrOnboardingDraft } from "@medbrains/types";
import { Badge } from "@/components/ui";

interface HfrDraftBadgesProps {
  trackingId: string;
  draft: HfrOnboardingDraft;
}

/** One badge per fact that is known; nothing for what is not. */
export function HfrDraftBadges({ trackingId, draft }: HfrDraftBadgesProps) {
  return (
    <Group gap="sm">
      {trackingId !== "" && <Badge tone="info">Tracking ID {trackingId}</Badge>}
      {draft.hfr_facility_id && <Badge tone="success">HFR ID {draft.hfr_facility_id}</Badge>}
      {draft.submitted_at && (
        <Badge tone="neutral">Last submitted {new Date(draft.submitted_at).toLocaleString()}</Badge>
      )}
    </Group>
  );
}
