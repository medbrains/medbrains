// Fall / pressure-injury risk flags the server sets from the latest Morse and
// Braden scores. Text + icon, never colour alone.

import { Group } from "@mantine/core";
import { IconBed, IconWalk } from "@tabler/icons-react";
import { Badge } from "@/components/ui";

interface AdmissionRiskBadgesProps {
  isFallRisk: boolean;
  isPressureInjuryRisk: boolean;
}

export function AdmissionRiskBadges({
  isFallRisk,
  isPressureInjuryRisk,
}: AdmissionRiskBadgesProps) {
  if (!isFallRisk && !isPressureInjuryRisk) return null;
  return (
    <Group gap={4}>
      {isFallRisk && (
        <Badge tone="danger" size="xs" leftSection={<IconWalk size={12} aria-hidden />}>
          Fall risk
        </Badge>
      )}
      {isPressureInjuryRisk && (
        <Badge tone="danger" size="xs" leftSection={<IconBed size={12} aria-hidden />}>
          Pressure injury risk
        </Badge>
      )}
    </Group>
  );
}
