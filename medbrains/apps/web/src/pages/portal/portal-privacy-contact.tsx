// Whom a patient asks and complains to about their data — the hospital's
// published grievance officer and DPO (DPDP Rules 2025 r.9, r.14(3)).

import { Stack, Text, Title } from "@mantine/core";
import type { PublicOfficer, PublicPrivacyContact } from "@medbrains/types";
import { Card } from "@/components/ui";

function Officer({ label, o }: { label: string; o: PublicOfficer }) {
  return (
    <Stack gap={0}>
      <Text size="sm" fw={600}>
        {label}: {o.name}, {o.designation}
      </Text>
      <Text size="sm">
        {o.email} · {o.phone}
      </Text>
      {o.hours && <Text size="xs">{o.hours}</Text>}
    </Stack>
  );
}

export function PortalPrivacyContact({ contact }: { contact: PublicPrivacyContact | undefined }) {
  if (!contact || (!contact.grievance_officer && !contact.dpo)) return null;
  return (
    <Card withBorder data-testid="portal-privacy-contact">
      <Stack gap="sm">
        <Title order={4}>Questions and complaints about your data</Title>
        {contact.grievance_officer && (
          <Officer label="Grievance officer" o={contact.grievance_officer} />
        )}
        {contact.dpo && <Officer label="Data Protection Officer" o={contact.dpo} />}
        <Text size="xs" c="dimmed">
          The hospital answers within 90 days. If you are not satisfied, you may complain to the
          Data Protection Board of India.
        </Text>
      </Stack>
    </Card>
  );
}
