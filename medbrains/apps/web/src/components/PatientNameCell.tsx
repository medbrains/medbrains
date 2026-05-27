import { Badge, Group, Skeleton, Stack, Text, Tooltip } from "@mantine/core";
import type { Gender } from "@medbrains/types";
import {
  IconGenderFemale,
  IconGenderMale,
  IconUserCheck,
  IconUserQuestion,
} from "@tabler/icons-react";
import { usePatientName } from "../hooks/usePatientName";
import styles from "./patient-name-cell.module.scss";

interface PatientNameCellProps {
  patientId: string | null | undefined;
  /** When true, renders UHID below the name (default true). */
  showUhid?: boolean;
  /** Override the rendered text size (default `"sm"`). */
  size?: "xs" | "sm" | "md";
  /** Show a compact gender identity indicator next to the patient name. */
  showGender?: boolean;
}

const genderLabels: Record<Gender, string> = {
  male: "M",
  female: "F",
  other: "O",
  unknown: "U",
};

const genderTitles: Record<Gender, string> = {
  male: "Male patient",
  female: "Female patient",
  other: "Other gender identity",
  unknown: "Gender not recorded",
};

function GenderIcon({ gender }: { gender: Gender }) {
  if (gender === "male") return <IconGenderMale size={11} stroke={2.5} />;
  if (gender === "female") return <IconGenderFemale size={11} stroke={2.5} />;
  if (gender === "other") return <IconUserCheck size={11} stroke={2.5} />;
  return <IconUserQuestion size={11} stroke={2.5} />;
}

function genderBadgeStyle(gender: Gender) {
  return {
    backgroundColor: `var(--mb-gender-${gender}-bg)`,
    borderColor: `var(--mb-gender-${gender}-border)`,
    color: `var(--mb-gender-${gender}-text)`,
  };
}

function PatientIdentityLine({
  fullName,
  gender,
  showGender,
  size,
}: {
  fullName: string;
  gender: Gender;
  showGender: boolean;
  size: "xs" | "sm" | "md";
}) {
  return (
    <Group gap={6} wrap="nowrap" className={styles.nameRow}>
      <Tooltip label={fullName} disabled={fullName.length < 24} withArrow>
        <Text size={size} className={styles.name} truncate>
          {fullName}
        </Text>
      </Tooltip>
      {showGender && (
        <Badge
          size="xs"
          variant="light"
          radius="sm"
          className={styles.genderBadge}
          style={genderBadgeStyle(gender)}
          leftSection={<GenderIcon gender={gender} />}
          aria-label={genderTitles[gender]}
          title={genderTitles[gender]}
        >
          {genderLabels[gender]}
        </Badge>
      )}
    </Group>
  );
}

/**
 * Resolve a `patient_id` to "Full Name" for table cells / detail rows.
 *
 * Replaces the old pattern `{row.patient_id.slice(0, 8)}...` which leaked
 * raw UUIDs to clinical users. Falls back to the short UUID only if the
 * lookup fails — never on success — so a network error still gives an
 * identifiable handle.
 */
export function PatientNameCell({
  patientId,
  showUhid = true,
  size = "sm",
  showGender = true,
}: PatientNameCellProps) {
  const { data, isLoading, isError } = usePatientName(patientId);

  if (!patientId) {
    return (
      <Text size={size} c="var(--mb-text-muted)">
        —
      </Text>
    );
  }

  if (isLoading) {
    return <Skeleton height={14} width={120} radius="sm" />;
  }

  if (isError || !data) {
    return (
      <Tooltip label={`Could not resolve patient ${patientId}`} withArrow>
        <Text size={size} c="var(--mb-text-muted)">
          {patientId.slice(0, 8)}…
        </Text>
      </Tooltip>
    );
  }

  if (!showUhid) {
    return (
      <PatientIdentityLine
        fullName={data.full_name}
        gender={data.gender}
        showGender={showGender}
        size={size}
      />
    );
  }

  return (
    <Stack gap={0} className={styles.identity}>
      <PatientIdentityLine
        fullName={data.full_name}
        gender={data.gender}
        showGender={showGender}
        size={size}
      />
      <Text size="xs" ff="monospace" className={styles.uhid}>
        {data.uhid}
      </Text>
    </Stack>
  );
}
