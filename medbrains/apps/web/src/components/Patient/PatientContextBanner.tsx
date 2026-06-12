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

import { Alert, Group, Skeleton, Text, Tooltip } from "@mantine/core";
import type { PatientContext } from "@medbrains/types";
import {
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
  patientContextSignal,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBan,
  IconCash,
  IconHeartbeat,
  IconShieldCheck,
  IconStarFilled,
  IconUserExclamation,
} from "@tabler/icons-react";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components/OperationalSignal";
import { useProtectedFieldValue } from "@/components/PermissionedFieldValue";
import { usePatientContext } from "@/hooks/usePatientContext";

/** Which chips a screen cares about. Safety/identity chips
 * (deceased, MLC, VIP, insurance, balance) show everywhere;
 * clinical-only chips (vitals, allergies, consents) are noise at a
 * cash counter and stay off financial screens. */
type PatientContextVariant = "clinical" | "financial";

type PatientContextChipScope = "all" | "clinical";

interface PatientContextBannerProps {
  patientId: string | null | undefined;
  /** When true, hide the loading skeleton. Useful when the parent
   * screen already shows a header skeleton. */
  hideLoadingState?: boolean;
  variant?: PatientContextVariant;
}

interface PatientContextChip {
  key: string;
  node: ReactNode;
  scope: PatientContextChipScope;
  severity: "critical" | "info" | "warning";
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
  variant = "clinical",
}: PatientContextBannerProps) {
  const { t } = useTranslation("patients");
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

  const chips: PatientContextChip[] = [];

  const pushChip = (
    kind: Parameters<typeof patientContextSignal>[0],
    key: string,
    label: ReactNode,
    icon?: ComponentType<{ className?: string; size?: number; stroke?: number }>,
    value?: ReactNode,
    scope: PatientContextChipScope = "all",
  ) => {
    const signal = patientContextSignal(kind);
    chips.push({
      key,
      scope,
      severity: signal.severity,
      node: (
        <OperationalSignal
          icon={icon}
          label={label}
          shape={signal.shape}
          size="xs"
          tone={signal.tone}
          value={value}
        />
      ),
    });
  };

  if (data.is_deceased) {
    pushChip("deceased", "deceased", t("contextSignals.deceased"), IconBan);
  }

  if (data.is_medico_legal) {
    pushChip(
      "medico_legal",
      "mlc",
      t("contextSignals.mlc"),
      IconUserExclamation,
      data.mlc_number ?? undefined,
    );
  }

  if (hasDrugAllergies) {
    const signal = patientContextSignal("drug_allergy");
    chips.push({
      key: "drug-allergies",
      scope: "clinical",
      severity: signal.severity,
      node: (
        <Tooltip label={data.drug_allergies.join(", ")} multiline w={260}>
          <OperationalSignal
            icon={IconAlertTriangle}
            label={t("contextSignals.drugAllergies", { count: data.drug_allergies.length })}
            shape={signal.shape}
            size="xs"
            tone={signal.tone}
          />
        </Tooltip>
      ),
    });
  }

  if (hasKnownAllergies) {
    const signal = patientContextSignal("allergy");
    chips.push({
      key: "allergies",
      scope: "clinical",
      severity: signal.severity,
      node: (
        <Tooltip
          label={data.known_allergies.map((a) => `${a.substance} (${a.severity})`).join(", ")}
          multiline
          w={260}
        >
          <OperationalSignal
            icon={IconAlertTriangle}
            label={t("contextSignals.otherAllergies", { count: data.known_allergies.length })}
            shape={signal.shape}
            size="xs"
            tone={signal.tone}
          />
        </Tooltip>
      ),
    });
  }

  if (hasBalance) {
    pushChip(
      "balance_due",
      "balance",
      t("contextSignals.outstanding"),
      IconCash,
      <ProtectedBalanceAmount balance={balance} />,
    );
  }

  if (hasPendingConsents) {
    const signal = patientContextSignal("consent_pending");
    chips.push({
      key: "consents",
      scope: "clinical",
      severity: signal.severity,
      node: (
        <Tooltip
          label={data.pending_consents.map((c) => `${c.consent_type} (${c.status})`).join(", ")}
          multiline
          w={260}
        >
          <OperationalSignal
            label={t("contextSignals.pendingConsents", { count: data.pending_consents.length })}
            shape={signal.shape}
            size="xs"
            tone={signal.tone}
          />
        </Tooltip>
      ),
    });
  }

  if (!data.last_vitals) {
    pushChip(
      "vitals_missing",
      "no-vitals",
      t("contextSignals.noVitals"),
      IconHeartbeat,
      undefined,
      "clinical",
    );
  }

  if (data.is_vip) {
    pushChip("vip", "vip", t("contextSignals.vip"), IconStarFilled);
  }

  if (data.primary_insurance) {
    pushChip("insurance", "insurance", data.primary_insurance.provider_name, IconShieldCheck);
  }

  if (data.no_known_allergies && !hasDrugAllergies) {
    pushChip(
      "no_known_allergies",
      "nka",
      t("contextSignals.noKnownAllergies"),
      undefined,
      undefined,
      "clinical",
    );
  }

  const visibleChips =
    variant === "financial" ? chips.filter((chip) => chip.scope === "all") : chips;

  if (visibleChips.length === 0) return null;

  // Use the highest severity present to colour the alert frame.
  const alertColor = visibleChips.some((chip) => chip.severity === "critical")
    ? "red"
    : visibleChips.some((chip) => chip.severity === "warning")
      ? "yellow"
      : "brand";

  return (
    <Alert color={alertColor} variant="light" mb="sm" radius="sm" withCloseButton={false}>
      <Group gap="xs" wrap="wrap" align="center">
        <PatientContextIdentity data={data} />
        {visibleChips.map((chip) => (
          <span key={chip.key}>{chip.node}</span>
        ))}
      </Group>
    </Alert>
  );
}
