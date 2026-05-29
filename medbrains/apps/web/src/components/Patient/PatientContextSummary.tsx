// Compact patient-context summary for the OPD sidebar.
//
// Shows up to 2 highest-severity chips + a "Details" link that opens a
// full-detail modal. Lets the OPD screen reclaim the vertical real-estate
// the old full-width PatientContextBanner consumed at the top.

import { Anchor, Badge, Group, Modal, Skeleton, Stack, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PatientContext } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBan,
  IconCash,
  IconHeartbeat,
  IconShieldCheck,
  IconStarFilled,
  IconUserExclamation,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useProtectedFieldValue } from "@/components/PermissionedFieldValue";
import { usePatientContext } from "@/hooks/usePatientContext";

interface PatientContextSummaryProps {
  patientId: string | null | undefined;
}

interface ChipMeta {
  key: string;
  severity: "red" | "amber" | "info";
  node: ReactNode;
}

const PATIENT_NAME_FIELD_CODES = [
  "patients.first_name",
  "patients.middle_name",
  "patients.last_name",
] as const;

function PatientContextSummaryTitle({ data }: { data: PatientContext }) {
  const protectedUhid = useProtectedFieldValue({
    fieldCode: "patients.uhid",
    value: data.uhid,
    kind: "identifier",
  });
  const protectedName = useProtectedFieldValue({
    fieldCodes: PATIENT_NAME_FIELD_CODES,
    value: data.full_name,
    kind: "name",
  });
  const restrictionLabel = [protectedUhid.restrictionLabel, protectedName.restrictionLabel]
    .filter(Boolean)
    .join("; ");

  const title = (
    <Text
      fw={600}
      c={
        protectedUhid.isRestricted || protectedName.isRestricted
          ? "var(--mb-text-muted)"
          : undefined
      }
    >
      {protectedUhid.displayValue} · {protectedName.displayValue}
    </Text>
  );

  if (!restrictionLabel) {
    return title;
  }

  return (
    <Tooltip label={restrictionLabel} withArrow>
      {title}
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

export function PatientContextSummary({ patientId }: PatientContextSummaryProps) {
  const [opened, handlers] = useDisclosure(false);
  const { data, isLoading, isError } = usePatientContext(patientId);

  if (!patientId) return null;
  if (isLoading) return <Skeleton height={20} mt={4} radius="sm" />;
  if (isError || !data) return null;

  const balance = Number(data.outstanding_balance);
  const hasBalance = Number.isFinite(balance) && balance > 0;
  const hasDrugAllergies = data.drug_allergies.length > 0;
  const hasKnownAllergies = !data.no_known_allergies && data.known_allergies.length > 0;
  const hasPendingConsents = data.pending_consents.length > 0;

  const chips: ChipMeta[] = [];

  if (data.is_deceased) {
    chips.push({
      key: "deceased",
      severity: "red",
      node: (
        <Badge color="red" leftSection={<IconBan size={12} />} variant="filled">
          Deceased
        </Badge>
      ),
    });
  }
  if (data.is_medico_legal) {
    chips.push({
      key: "mlc",
      severity: "red",
      node: (
        <Badge color="red" leftSection={<IconUserExclamation size={12} />} variant="filled">
          MLC{data.mlc_number ? ` ${data.mlc_number}` : ""}
        </Badge>
      ),
    });
  }
  if (hasDrugAllergies) {
    chips.push({
      key: "drug-allergies",
      severity: "red",
      node: (
        <Tooltip label={data.drug_allergies.join(", ")} multiline w={260}>
          <Badge color="red" leftSection={<IconAlertTriangle size={12} />} variant="filled">
            {data.drug_allergies.length} drug{" "}
            {data.drug_allergies.length === 1 ? "allergy" : "allergies"}
          </Badge>
        </Tooltip>
      ),
    });
  }
  if (hasKnownAllergies) {
    chips.push({
      key: "allergies",
      severity: "red",
      node: (
        <Badge color="red" leftSection={<IconAlertTriangle size={12} />} variant="light">
          {data.known_allergies.length} other{" "}
          {data.known_allergies.length === 1 ? "allergy" : "allergies"}
        </Badge>
      ),
    });
  }
  if (hasBalance) {
    chips.push({
      key: "balance",
      severity: "red",
      node: (
        <Badge color="red" leftSection={<IconCash size={12} />} variant="light">
          <ProtectedBalanceAmount balance={balance} />
        </Badge>
      ),
    });
  }
  if (hasPendingConsents) {
    chips.push({
      key: "consents",
      severity: "amber",
      node: (
        <Badge color="yellow" variant="light">
          {data.pending_consents.length} pending consent
          {data.pending_consents.length === 1 ? "" : "s"}
        </Badge>
      ),
    });
  }
  if (!data.last_vitals) {
    chips.push({
      key: "no-vitals",
      severity: "amber",
      node: (
        <Badge color="yellow" leftSection={<IconHeartbeat size={12} />} variant="light">
          No vitals
        </Badge>
      ),
    });
  }
  if (data.is_vip) {
    chips.push({
      key: "vip",
      severity: "info",
      node: (
        <Badge color="brand" leftSection={<IconStarFilled size={12} />} variant="light">
          VIP
        </Badge>
      ),
    });
  }
  if (data.primary_insurance) {
    chips.push({
      key: "insurance",
      severity: "info",
      node: (
        <Badge color="brand" leftSection={<IconShieldCheck size={12} />} variant="light">
          {data.primary_insurance.provider_name}
        </Badge>
      ),
    });
  }
  if (data.no_known_allergies && !hasDrugAllergies) {
    chips.push({
      key: "nka",
      severity: "info",
      node: (
        <Badge color="gray" variant="light">
          NKA
        </Badge>
      ),
    });
  }

  if (chips.length === 0) return null;

  const top = chips.slice(0, 2);
  const extra = chips.length - top.length;

  return (
    <>
      <Stack gap={4} mt={6}>
        <Group gap={4} wrap="wrap">
          {top.map((c) => (
            <span key={c.key}>{c.node}</span>
          ))}
          {extra > 0 && (
            <Anchor
              component="button"
              type="button"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                handlers.open();
              }}
            >
              +{extra} more
            </Anchor>
          )}
        </Group>
        <Anchor
          component="button"
          type="button"
          size="xs"
          c="dimmed"
          onClick={(e) => {
            e.stopPropagation();
            handlers.open();
          }}
        >
          View context details
        </Anchor>
      </Stack>

      <Modal
        opened={opened}
        onClose={handlers.close}
        title={<PatientContextSummaryTitle data={data} />}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {data.age_years !== null ? `${data.age_years} years` : "Age unknown"}
              {data.gender ? ` · ${data.gender}` : ""}
            </Text>
          </Group>

          {chips.length > 0 && (
            <div>
              <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase">
                Alerts
              </Text>
              <Group gap="xs" wrap="wrap">
                {chips.map((c) => (
                  <span key={c.key}>{c.node}</span>
                ))}
              </Group>
            </div>
          )}

          {data.drug_allergies.length > 0 && (
            <div>
              <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase">
                Drug allergies
              </Text>
              <Text size="sm">{data.drug_allergies.join(", ")}</Text>
            </div>
          )}

          {data.known_allergies.length > 0 && (
            <div>
              <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase">
                Other allergies
              </Text>
              <Text size="sm">
                {data.known_allergies.map((a) => `${a.substance} (${a.severity})`).join(", ")}
              </Text>
            </div>
          )}

          {data.pending_consents.length > 0 && (
            <div>
              <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase">
                Pending consents
              </Text>
              <Text size="sm">
                {data.pending_consents.map((c) => `${c.consent_type} (${c.status})`).join(", ")}
              </Text>
            </div>
          )}

          {hasBalance && (
            <div>
              <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase">
                Outstanding balance
              </Text>
              <Text size="sm" c="red" fw={600}>
                <ProtectedBalanceAmount balance={balance} />
              </Text>
            </div>
          )}

          {data.primary_insurance && (
            <div>
              <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase">
                Primary insurance
              </Text>
              <Text size="sm">
                {data.primary_insurance.provider_name}
                {data.primary_insurance.policy_number
                  ? ` · ${data.primary_insurance.policy_number}`
                  : ""}
              </Text>
            </div>
          )}

          {data.last_vitals && (
            <div>
              <Text size="xs" c="dimmed" mb={4} fw={600} tt="uppercase">
                Last vitals
              </Text>
              <Text size="sm">
                {data.last_vitals.systolic_bp && data.last_vitals.diastolic_bp
                  ? `BP ${data.last_vitals.systolic_bp}/${data.last_vitals.diastolic_bp} · `
                  : ""}
                {data.last_vitals.pulse ? `HR ${data.last_vitals.pulse} · ` : ""}
                {data.last_vitals.spo2 ? `SpO₂ ${data.last_vitals.spo2}% · ` : ""}
                {data.last_vitals.temperature ? `Temp ${data.last_vitals.temperature}°` : ""}
              </Text>
            </div>
          )}
        </Stack>
      </Modal>
    </>
  );
}
