import { Group, Text } from "@mantine/core";
import type { PrescriptionRefillTerms } from "@medbrains/types";
import { IconCalendarX, IconRepeat } from "@tabler/icons-react";
import { Alert, Badge } from "@/components/ui";
import { formatDate, todayDateString } from "@/lib/date-utils";

interface RxTermsLineProps {
  terms: PrescriptionRefillTerms | null;
  /** Which refill this queue entry is; null for the prescription itself. */
  repeatIndex: number | null;
}

/** True once the prescription's last valid day has passed. */
export function isRxExpired(terms: PrescriptionRefillTerms | null): boolean {
  return Boolean(terms?.valid_until && terms.valid_until < todayDateString());
}

/** Refill number and expiry, where the pharmacist decides whether to approve. */
export function RxTermsLine({ terms, repeatIndex }: RxTermsLineProps) {
  if (!terms) return null;
  if (isRxExpired(terms)) {
    return (
      <Alert tone="danger" title="Prescription expired" icon={<IconCalendarX size={16} />}>
        Valid until {formatDate(terms.valid_until)}. The patient needs a new prescription.
      </Alert>
    );
  }
  return (
    <Group gap="xs">
      {repeatIndex !== null && (
        <Badge tone="info" size="sm" leftSection={<IconRepeat size={12} />}>
          Refill {repeatIndex} of {terms.repeats_allowed}
        </Badge>
      )}
      {terms.valid_until && (
        <Text size="sm" c="dimmed">
          Valid until {formatDate(terms.valid_until)}
        </Text>
      )}
    </Group>
  );
}
