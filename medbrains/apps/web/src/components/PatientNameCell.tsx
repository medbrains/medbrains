import { Badge, Group, Skeleton, Stack, Text, Tooltip } from "@mantine/core";
import type { Gender } from "@medbrains/types";
import {
  IconGenderFemale,
  IconGenderMale,
  IconUserCheck,
  IconUserQuestion,
} from "@tabler/icons-react";
import { usePatientName } from "@/hooks/usePatientName";
import { PermissionedFieldValue, useProtectedFieldValue } from "./PermissionedFieldValue";
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

const PATIENT_NAME_FIELD_CODES = [
  "patients.first_name",
  "patients.middle_name",
  "patients.last_name",
] as const;

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
  const protectedName = useProtectedFieldValue({
    fieldCodes: PATIENT_NAME_FIELD_CODES,
    value: fullName,
    kind: "name",
  });

  return (
    <Group gap={6} wrap="nowrap" className={styles.nameRow}>
      <Tooltip
        label={protectedName.restrictionLabel ?? protectedName.displayValue}
        disabled={!protectedName.restrictionLabel && protectedName.displayValue.length < 24}
        withArrow
      >
        <Text
          size={size}
          c={protectedName.isRestricted ? "var(--mb-text-muted)" : undefined}
          className={styles.name}
          truncate
        >
          {protectedName.displayValue}
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
      <PermissionedFieldValue
        fieldCode="patients.uhid"
        value={data.uhid}
        kind="identifier"
        size="xs"
        ff="monospace"
        className={styles.uhid}
      />
    </Stack>
  );
}
