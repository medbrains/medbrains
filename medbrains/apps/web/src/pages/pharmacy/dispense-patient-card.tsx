import { Card, Group, Loader, Stack, Text } from "@mantine/core";
import type { PharmacyDispenseContext } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Alert, Badge } from "@/components/ui";

interface DispensePatientCardProps {
  context: PharmacyDispenseContext | undefined;
  loading: boolean;
  failed: boolean;
}

/**
 * Who the medicines are for, and what they react to — the dispensing view of
 * the patient, read through the pharmacy's own narrow gate. A failed read says
 * so: an empty allergy list here would read as "no allergies".
 */
export function DispensePatientCard({ context, loading, failed }: DispensePatientCardProps) {
  if (loading) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm">Reading the patient's allergies…</Text>
      </Group>
    );
  }
  if (failed || !context) {
    return (
      <Alert
        tone="danger"
        icon={<IconAlertTriangle size={16} />}
        title="Allergies could not be read"
      >
        This is a fault, not a clean record. Check the patient's allergies before dispensing.
      </Alert>
    );
  }
  return (
    <Card withBorder padding="sm" component="section" aria-label="Patient for this order">
      <Stack gap={6}>
        <Text fw={700}>
          {context.full_name} · {context.uhid}
        </Text>
        {context.drug_allergies.length > 0 ? (
          <Group gap="xs">
            <Text size="sm" fw={600}>
              Drug allergies:
            </Text>
            {context.drug_allergies.map((a) => (
              <Badge key={a.allergen_name} tone="danger">
                {a.allergen_name}
                {a.severity ? ` (${a.severity})` : ""}
              </Badge>
            ))}
          </Group>
        ) : (
          <Text size="sm">
            {context.no_known_allergies
              ? "No known drug allergies (recorded)"
              : "No drug allergies recorded — none has been noted as asked"}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
