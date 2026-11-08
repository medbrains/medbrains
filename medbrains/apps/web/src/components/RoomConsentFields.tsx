// Who agreed to pay the proportionate deduction for a room above the policy
// limit: the patient or a named relative. Shared by the admission and transfer
// flows and the insurance desk's later consent.

import { Group, Stack } from "@mantine/core";
import type { RoomConsentInput } from "@medbrains/types";
import { Input } from "@/components/ui";

interface RoomConsentFieldsProps {
  value: RoomConsentInput;
  onChange: (value: RoomConsentInput) => void;
}

/** Whether the consent names who agreed and how they relate to the patient. */
export function isConsentComplete(c: RoomConsentInput): boolean {
  return c.consented_by_name.trim().length >= 2 && c.consenter_relation.trim().length >= 2;
}

/** Name and relation inputs for a room consent. */
export function RoomConsentFields({ value, onChange }: RoomConsentFieldsProps) {
  return (
    <Stack gap="xs">
      <Group grow>
        <Input
          label="Agreed by"
          placeholder="Patient or relative's name"
          required
          value={value.consented_by_name}
          onChange={(e) => onChange({ ...value, consented_by_name: e.currentTarget.value })}
        />
        <Input
          label="Relation to patient"
          placeholder="Self, spouse, son…"
          required
          value={value.consenter_relation}
          onChange={(e) => onChange({ ...value, consenter_relation: e.currentTarget.value })}
        />
      </Group>
    </Stack>
  );
}
