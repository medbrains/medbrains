// OPD queue-table cell renderers (patient identity, appointment marker, visit-type badge)
// split from opd.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { FieldAccessLevel, QueueEntry } from "@medbrains/types";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components";
import {
  appointmentSlotLabel,
  appointmentStatusLabel,
  appointmentStatusShape,
  appointmentStatusTone,
  appointmentTypeLabel,
  protectedOpdQueueIdentity,
  queueVisitTypeLabel,
  queueVisitTypeShape,
  queueVisitTypeTone,
} from "./shared";

export function QueuePatientCell({
  access,
  row,
}: {
  access: { name: FieldAccessLevel; uhid: FieldAccessLevel };
  row: QueueEntry;
}) {
  const { t } = useTranslation("opd");
  const identity = protectedOpdQueueIdentity(row, access, {
    patient: t("queueFallback.patient"),
    uhid: t("queueFallback.uhid"),
  });

  return (
    <Stack gap={2}>
      <Text size="sm" fw={600} lineClamp={1}>
        {identity.name}
      </Text>
      <Text size="xs" c="dimmed" ff="var(--mb-font-mono, monospace)">
        {identity.uhid}
      </Text>
    </Stack>
  );
}

export function QueueAppointmentMarker({ row }: { row: QueueEntry }) {
  const { t } = useTranslation("opd");

  if (!row.appointment_id) {
    return (
      <OperationalSignal
        label={t("queueSignals.directQueue")}
        shape="pill"
        size="xs"
        tone="neutral"
      />
    );
  }

  const typeLabel = appointmentTypeLabel(t, row.appointment_type ?? "new_visit");
  const status = row.appointment_status ?? row.status;
  const statusLabel = appointmentStatusLabel(t, status);

  return (
    <Stack gap={2}>
      <Group gap={4}>
        <OperationalSignal label={typeLabel} shape="token" size="xs" tone="active" />
        <OperationalSignal
          label={statusLabel}
          shape={appointmentStatusShape(status)}
          size="xs"
          tone={appointmentStatusTone(status)}
        />
      </Group>
      <Text size="xs" c="dimmed">
        {appointmentSlotLabel(row, t("queue.noSlot"))}
      </Text>
      {row.appointment_reason && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {row.appointment_reason}
        </Text>
      )}
    </Stack>
  );
}

export function QueueVisitTypeBadge({ row }: { row: QueueEntry }) {
  const { t } = useTranslation("opd");
  const visitType = row.visit_type ?? (row.appointment_id ? "booked" : "walk_in");
  return (
    <Stack gap={2}>
      <OperationalSignal
        label={queueVisitTypeLabel(t, visitType)}
        shape={queueVisitTypeShape(visitType)}
        size="xs"
        tone={queueVisitTypeTone(visitType)}
      />
      {visitType === "camp" && row.camp_name && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {row.camp_name}
        </Text>
      )}
    </Stack>
  );
}
