// Bedside-portal IpdBedsideContextStrip — split from bedside-portal.tsx (pure move).

import { Card, Group, Text } from "@mantine/core";
import { Badge } from "@/components/ui";
import { compactContextId } from "./shared";

export function IpdBedsideContextStrip({
  admissionId,
  patientId,
  encounterId,
  wardId,
  bedId,
  chargeContext,
  chargeable,
}: {
  admissionId: string;
  patientId: string;
  encounterId: string;
  wardId: string;
  bedId: string;
  chargeContext: string;
  chargeable: string;
}) {
  if (!admissionId && !patientId && !encounterId && !wardId && !bedId) {
    return null;
  }

  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed" mb={4}>
        Linked IPD context
      </Text>
      <Group gap="xs">
        {admissionId && (
          <Badge tone="neutral" variant="light">
            Admission {compactContextId(admissionId)}
          </Badge>
        )}
        {patientId && (
          <Badge tone="neutral" variant="light">
            Patient {compactContextId(patientId)}
          </Badge>
        )}
        {encounterId && (
          <Badge tone="neutral" variant="light">
            Encounter {compactContextId(encounterId)}
          </Badge>
        )}
        {wardId && (
          <Badge tone="neutral" variant="light">
            Ward {compactContextId(wardId)}
          </Badge>
        )}
        {bedId && (
          <Badge tone="neutral" variant="light">
            Bed {compactContextId(bedId)}
          </Badge>
        )}
        {chargeContext && (
          <Badge tone={chargeable === "true" ? "warning" : "neutral"} variant="light">
            {chargeContext}
            {chargeable ? ` · chargeable ${chargeable}` : ""}
          </Badge>
        )}
      </Group>
    </Card>
  );
}

// ── Main Page Component ──
