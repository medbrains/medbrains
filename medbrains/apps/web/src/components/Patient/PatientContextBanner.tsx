// PatientContextBanner — alert chips at the top of any
// patient-touching clinical or financial screen. Renders the
// denormalized blob from GET /api/patients/{id}/context.
//
// Severity grouping:
//   - red:    drug allergies, MLC, outstanding balance, deceased flag
//   - amber:  pending consents, no recent vitals, missing demographics
//   - info:   VIP, primary insurance, language preference
//
// Usage: <PatientContextBanner patientId={id} />
//
// Plan section 1 — feeds form defaults via the hook elsewhere.

import { Alert, Badge, Group, Skeleton, Text, Tooltip } from "@mantine/core";
import type { PatientContext } from "@medbrains/types";
import { PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBan,
  IconCash,
  IconHeartbeat,
  IconShieldCheck,
  IconStarFilled,
  IconUserExclamation,
} from "@tabler/icons-react";
import { useProtectedFieldValue } from "@/components/PermissionedFieldValue";
import { usePatientContext } from "@/hooks/usePatientContext";

interface PatientContextBannerProps {
  patientId: string | null | undefined;
  /** When true, hide the loading skeleton. Useful when the parent
   * screen already shows a header skeleton. */
  hideLoadingState?: boolean;
}

function PatientContextIdentity({ data }: { data: PatientContext }) {
  const protectedUhid = useProtectedFieldValue({
    fieldCode: PATIENT_UHID_FIELD_ACCESS_KEY,
    value: data.uhid,
    kind: "identifier",
  });
  const protectedName = useProtectedFieldValue({
    fieldCodes: PATIENT_NAME_FIELD_ACCESS_KEYS,
    value: data.full_name,
    kind: "name",
  });
  const restrictionLabel = [protectedUhid.restrictionLabel, protectedName.restrictionLabel]
    .filter(Boolean)
    .join("; ");

  const identity = (
    <Text
      size="xs"
      c={
        protectedUhid.isRestricted || protectedName.isRestricted ? "var(--mb-text-muted)" : "dimmed"
      }
      fw={500}
      mr={4}
    >
      {protectedUhid.displayValue} · {protectedName.displayValue}
      {data.age_years !== null ? ` · ${data.age_years}y` : ""}
      {data.gender ? ` · ${data.gender}` : ""}
    </Text>
  );

  if (!restrictionLabel) {
    return identity;
  }

  return (
    <Tooltip label={restrictionLabel} withArrow>
      {identity}
    </Tooltip>
  );
}

function ProtectedBalanceAmount({ balance }: { balance: number }) {
  const protectedBalance = useProtectedFieldValue({
    fieldCode: "billing.amount",
    value: balance,
    kind: "money",
  });

  return <>{protectedBalance.displayValue}</>;
}

export function PatientContextBanner({
  patientId,
  hideLoadingState = false,
}: PatientContextBannerProps) {
  const { data, isLoading, isError } = usePatientContext(patientId);

  if (!patientId) return null;

  if (isLoading) {
    if (hideLoadingState) return null;
    return <Skeleton height={36} mb="sm" radius="sm" />;
  }

  if (isError || !data) {
    return null;
  }

  const balance = Number(data.outstanding_balance);
  const hasBalance = Number.isFinite(balance) && balance > 0;
  const hasDrugAllergies = data.drug_allergies.length > 0;
  const hasKnownAllergies = !data.no_known_allergies && data.known_allergies.length > 0;
  const hasPendingConsents = data.pending_consents.length > 0;

  const reds: React.ReactNode[] = [];
  const ambers: React.ReactNode[] = [];
  const infos: React.ReactNode[] = [];

  if (data.is_deceased) {
    reds.push(
      <Badge key="deceased" color="red" leftSection={<IconBan size={12} />} variant="filled">
        Deceased
      </Badge>,
    );
  }

  if (data.is_medico_legal) {
    reds.push(
      <Badge key="mlc" color="red" leftSection={<IconUserExclamation size={12} />} variant="filled">
        MLC{data.mlc_number ? ` ${data.mlc_number}` : ""}
      </Badge>,
    );
  }

  if (hasDrugAllergies) {
    reds.push(
      <Tooltip key="drug-allergies" label={data.drug_allergies.join(", ")} multiline w={260}>
        <Badge color="red" leftSection={<IconAlertTriangle size={12} />} variant="filled">
          {data.drug_allergies.length} drug{" "}
          {data.drug_allergies.length === 1 ? "allergy" : "allergies"}
        </Badge>
      </Tooltip>,
    );
  }

  if (hasKnownAllergies) {
    reds.push(
      <Tooltip
        key="allergies"
        label={data.known_allergies.map((a) => `${a.substance} (${a.severity})`).join(", ")}
        multiline
        w={260}
      >
        <Badge color="red" leftSection={<IconAlertTriangle size={12} />} variant="light">
          {data.known_allergies.length} other{" "}
          {data.known_allergies.length === 1 ? "allergy" : "allergies"}
        </Badge>
      </Tooltip>,
    );
  }

  if (hasBalance) {
    reds.push(
      <Badge key="balance" color="red" leftSection={<IconCash size={12} />} variant="light">
        Outstanding <ProtectedBalanceAmount balance={balance} />
      </Badge>,
    );
  }

  if (hasPendingConsents) {
    ambers.push(
      <Tooltip
        key="consents"
        label={data.pending_consents.map((c) => `${c.consent_type} (${c.status})`).join(", ")}
        multiline
        w={260}
      >
        <Badge color="yellow" variant="light">
          {data.pending_consents.length} pending consent
          {data.pending_consents.length === 1 ? "" : "s"}
        </Badge>
      </Tooltip>,
    );
  }

  if (!data.last_vitals) {
    ambers.push(
      <Badge
        key="no-vitals"
        color="yellow"
        leftSection={<IconHeartbeat size={12} />}
        variant="light"
      >
        No vitals on record
      </Badge>,
    );
  }

  if (data.is_vip) {
    infos.push(
      <Badge key="vip" color="brand" leftSection={<IconStarFilled size={12} />} variant="light">
        VIP
      </Badge>,
    );
  }

  if (data.primary_insurance) {
    infos.push(
      <Badge
        key="insurance"
        color="brand"
        leftSection={<IconShieldCheck size={12} />}
        variant="light"
      >
        {data.primary_insurance.provider_name}
      </Badge>,
    );
  }

  if (data.no_known_allergies && !hasDrugAllergies) {
    infos.push(
      <Badge key="nka" color="gray" variant="light">
        NKA
      </Badge>,
    );
  }

  const allChips = [...reds, ...ambers, ...infos];
  if (allChips.length === 0) return null;

  // Use the highest severity present to colour the alert frame.
  const alertColor = reds.length > 0 ? "red" : ambers.length > 0 ? "yellow" : "brand";

  return (
    <Alert color={alertColor} variant="light" mb="sm" radius="sm" withCloseButton={false}>
      <Group gap="xs" wrap="wrap" align="center">
        <PatientContextIdentity data={data} />
        {allChips}
      </Group>
    </Alert>
  );
}
