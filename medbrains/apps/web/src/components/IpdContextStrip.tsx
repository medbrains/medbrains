import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { IconLink } from "@tabler/icons-react";

export interface IpdLinkedContext {
  admissionId: string;
  patientId: string;
  encounterId: string;
  wardId: string;
  bedId: string;
  admissionStatus: string;
  billingSource: string;
  chargeContext: string;
  chargeable: string;
}

function compactContextId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

function param(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) ?? "";
}

export function ipdContextFromSearchParams(searchParams: URLSearchParams) {
  const context: IpdLinkedContext = {
    admissionId: param(searchParams, "admission_id"),
    patientId: param(searchParams, "patient_id"),
    encounterId: param(searchParams, "encounter_id"),
    wardId: param(searchParams, "ward_id"),
    bedId: param(searchParams, "bed_id"),
    admissionStatus: param(searchParams, "admission_status"),
    billingSource: param(searchParams, "billing_source"),
    chargeContext: param(searchParams, "charge_context"),
    chargeable: param(searchParams, "chargeable"),
  };

  return Object.values(context).some(Boolean) ? context : null;
}

export function IpdContextStrip({ context }: { context: IpdLinkedContext | null }) {
  if (!context) {
    return null;
  }

  const chargeableLabel =
    context.chargeable === "false"
      ? "Non-chargeable"
      : context.chargeable === "true"
        ? "Chargeable"
        : "";

  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Group gap="xs" align="flex-start">
          <IconLink size={16} />
          <Stack gap={2}>
            <Text size="sm" fw={700}>
              Linked IPD admission
            </Text>
            <Text size="xs" c="dimmed">
              {[context.admissionStatus, context.billingSource].filter(Boolean).join(" · ") ||
                "Admission-scoped operation"}
            </Text>
          </Stack>
        </Group>
        <Group gap={6} wrap="wrap">
          {context.admissionId && (
            <Badge variant="light" color="primary" title={context.admissionId}>
              Admission {compactContextId(context.admissionId)}
            </Badge>
          )}
          {context.patientId && (
            <Badge variant="light" color="teal" title={context.patientId}>
              Patient {compactContextId(context.patientId)}
            </Badge>
          )}
          {context.encounterId && (
            <Badge variant="light" color="indigo" title={context.encounterId}>
              Encounter {compactContextId(context.encounterId)}
            </Badge>
          )}
          {context.wardId && (
            <Badge variant="light" color="violet" title={context.wardId}>
              Ward {compactContextId(context.wardId)}
            </Badge>
          )}
          {context.bedId && (
            <Badge variant="light" color="violet" title={context.bedId}>
              Bed {compactContextId(context.bedId)}
            </Badge>
          )}
          {context.chargeContext && (
            <Badge variant="light" color="orange">
              {context.chargeContext}
            </Badge>
          )}
          {chargeableLabel && (
            <Badge variant="light" color={context.chargeable === "true" ? "green" : "gray"}>
              {chargeableLabel}
            </Badge>
          )}
        </Group>
      </Group>
    </Card>
  );
}
