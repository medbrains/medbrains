// Nurse Activities shared helpers — split from nurse-activities.tsx (pure move).

import { Card, Text, TextInput } from "@mantine/core";
import { EncounterSelect } from "@/components/EncounterSelect";

export function compactId(value: string): string {
  return value ? value.slice(0, 8) : "";
}

export function EncounterContextField({
  value,
  onChange,
  locked,
  patientId,
}: {
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  patientId?: string;
}) {
  if (locked) {
    return (
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Linked encounter
        </Text>
        <Text size="sm" fw={700}>
          {compactId(value)}
        </Text>
      </Card>
    );
  }

  if (patientId) {
    return (
      <EncounterSelect
        label="Encounter"
        value={value}
        patientId={patientId}
        onChange={(encounterId) => onChange(encounterId)}
      />
    );
  }

  return (
    <TextInput
      label="Encounter ID"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      w={400}
      placeholder="Open from IPD to auto-link"
    />
  );
}
