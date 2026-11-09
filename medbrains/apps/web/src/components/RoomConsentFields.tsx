// Who agreed to pay the proportionate deduction for a room above the policy
// limit (the patient or a named relative), and the member of staff who saw
// them agree. Shared by the admission and transfer flows and the insurance
// desk's later consent.

import { type ComboboxItem, Group, Stack } from "@mantine/core";
import type { RoomConsentInput } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input, Select } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { ROOM_DISCLOSURE_VERSION } from "./room-disclosure";

interface RoomConsentFieldsProps {
  value: RoomConsentInput;
  onChange: (value: RoomConsentInput) => void;
}

/** An empty consent on the current disclosure wording. */
export function emptyConsent(): RoomConsentInput {
  return {
    consented_by_name: "",
    consenter_relation: "",
    witness_user_id: "",
    disclosure_version: ROOM_DISCLOSURE_VERSION,
  };
}

/** Whether the consent names who agreed, their relation and a witness. */
export function isConsentComplete(c: RoomConsentInput): boolean {
  return (
    c.consented_by_name.trim().length >= 2 &&
    c.consenter_relation.trim().length >= 2 &&
    c.witness_user_id !== ""
  );
}

/** Name, relation and witness inputs for a room consent. */
export function RoomConsentFields({ value, onChange }: RoomConsentFieldsProps) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<ComboboxItem | null>(null);
  // Once picked, the box shows the witness's label; that is not a new search.
  const needle = search && search !== picked?.label ? search : undefined;
  const { data: staff = [], isError } = useQuery({
    queryKey: ["billing", "room-consent-witnesses", needle ?? ""],
    queryFn: () => billingService.listRoomConsentWitnesses(needle),
    staleTime: 60_000,
  });
  const options = staff
    .map((s) => ({ value: s.id, label: `${s.full_name} (${s.role})` }))
    .filter((o) => o.value !== picked?.value);
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
      <Select
        label="Witnessed by"
        placeholder="Search staff by name"
        required
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        data={picked ? [picked, ...options] : options}
        value={value.witness_user_id || null}
        onChange={(id, option) => {
          setPicked(id ? option : null);
          onChange({ ...value, witness_user_id: id ?? "" });
        }}
        error={isError ? "Could not load staff to witness" : undefined}
        nothingFoundMessage="No staff found"
      />
    </Stack>
  );
}
