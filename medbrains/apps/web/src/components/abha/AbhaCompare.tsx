import { Group, Stack, Text } from "@mantine/core";
import type { AbhaField, AbhaVerifiedProfile } from "@medbrains/types";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { Image, SegmentedControl, Table } from "@/components/ui";

/** The patient's details as they stand on our side. */
export interface OurDetails {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  /** YYYY-MM-DD */
  date_of_birth?: string | null;
  gender?: string | null;
}

interface Row {
  field: AbhaField;
  label: string;
  abha: string;
  ours: string;
}

const clean = (v?: string | null) => (v ?? "").trim().replace(/\s+/g, " ");
const name = (first?: string | null, middle?: string | null, last?: string | null) =>
  [first, middle, last].map(clean).filter(Boolean).join(" ");

export function compareRows(profile: AbhaVerifiedProfile, ours: OurDetails): Row[] {
  return [
    {
      field: "name",
      label: "Name",
      abha:
        name(profile.first_name, profile.middle_name, profile.last_name) ||
        clean(profile.full_name),
      ours: name(ours.first_name, ours.middle_name, ours.last_name),
    },
    {
      field: "date_of_birth",
      label: "Date of birth",
      abha: clean(profile.date_of_birth) || clean(profile.year_of_birth),
      ours: clean(ours.date_of_birth),
    },
    { field: "gender", label: "Gender", abha: clean(profile.gender), ours: clean(ours.gender) },
  ];
}

const same = (r: Row) => r.abha.toLowerCase() === r.ours.toLowerCase();

interface AbhaCompareProps {
  profile: AbhaVerifiedProfile;
  ours: OurDetails;
  apply: AbhaField[];
  onApplyChange: (apply: AbhaField[]) => void;
}

/**
 * ABHA's details beside ours. Where they differ, staff choose which to keep —
 * a local spelling may be deliberate; ABHA's comes from Aadhaar.
 */
export function AbhaCompare({ profile, ours, apply, onApplyChange }: AbhaCompareProps) {
  const rows = compareRows(profile, ours);
  const choose = (field: AbhaField, useAbha: boolean) =>
    onApplyChange(useAbha ? [...new Set([...apply, field])] : apply.filter((f) => f !== field));

  return (
    <Stack gap="sm">
      <Group gap="md" wrap="nowrap" align="flex-start">
        {profile.photo && (
          <Image
            src={`data:image/jpeg;base64,${profile.photo}`}
            alt="Photo on the ABHA, to confirm this is the patient"
            w={72}
            h={88}
            fit="cover"
          />
        )}
        <Stack gap={2}>
          <Text fw={600}>{profile.abha_number}</Text>
          {profile.abha_address && <Text size="sm">{profile.abha_address}</Text>}
          <Text size="xs" c="dimmed">
            {profile.kyc_verified ? "KYC verified with Aadhaar" : "Not KYC verified"}
            {profile.mobile_masked ? ` · mobile ${profile.mobile_masked}` : ""}
          </Text>
        </Stack>
      </Group>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Detail</Table.Th>
            <Table.Th>On ABHA</Table.Th>
            <Table.Th>On our form</Table.Th>
            <Table.Th>Keep</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.field}>
              <Table.Td>{r.label}</Table.Td>
              <Table.Td>{r.abha || "—"}</Table.Td>
              <Table.Td>{r.ours || "—"}</Table.Td>
              <Table.Td>
                {same(r) || !r.abha ? (
                  <Group gap={4}>
                    <IconCheck size={16} aria-hidden />
                    <Text size="xs">{same(r) ? "Matches" : "Ours"}</Text>
                  </Group>
                ) : (
                  <Group gap={6} wrap="nowrap">
                    <IconAlertTriangle size={16} aria-label="Differs" />
                    <SegmentedControl
                      size="xs"
                      aria-label={`Which ${r.label.toLowerCase()} to keep`}
                      value={apply.includes(r.field) ? "abha" : "ours"}
                      onChange={(v) => choose(r.field, v === "abha")}
                      data={[
                        { value: "abha", label: "ABHA" },
                        { value: "ours", label: "Ours" },
                      ]}
                    />
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
