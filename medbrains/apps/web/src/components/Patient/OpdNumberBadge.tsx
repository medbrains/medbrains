// OpdNumberBadge — the hospital OPD number and its register date, as a chip.

import { Badge } from "@/components/ui";
import { opdLabel } from "@/utils/patient-identity";

interface OpdNumberBadgeProps {
  opd?: { opd_number?: string | null; opd_date?: string | null } | null;
}

/** "OPD 1043 (15 Aug 2026)" beside the UHID; nothing when the patient has none. */
export function OpdNumberBadge({ opd }: OpdNumberBadgeProps) {
  const label = opdLabel(opd ?? undefined).replace(/^ · /, "");
  if (!label) return null;
  return (
    <Badge tone="accent" variant="light" data-testid="opd-number-badge">
      {label}
    </Badge>
  );
}
