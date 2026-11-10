// OPD queue-table cell renderers (patient identity, appointment marker, visit-type badge)
// split from opd.tsx (pure move).

import { Group, Stack, Text } from "@mantine/core";
import type { FieldAccessLevel, QueueEntry } from "@medbrains/types";
import { IconHeartbeat, IconHeartOff } from "@tabler/icons-react";
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
      <Text size="sm" c="dimmed">
        {t("queueSignals.directQueue")}
      </Text>
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

/** Why a colleague's row is in this queue, in the words a doctor reads. */
const ROW_KIND_LABEL: Record<Exclude<QueueEntry["kind"], "primary">, string> = {
  cross_consult: "Opinion requested",
  returned: "Back with opinion",
};

export function QueueVisitTypeBadge({ row }: { row: QueueEntry }) {
  const { t } = useTranslation("opd");
  const visitType = row.visit_type ?? (row.appointment_id ? "booked" : "walk_in");
  if (row.kind !== "primary") {
    return (
      <Stack gap={2}>
        <OperationalSignal
          label={ROW_KIND_LABEL[row.kind]}
          shape="diamond"
          size="xs"
          tone="active"
        />
        {row.kind === "cross_consult" && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {[row.referral_from_doctor && `Dr. ${row.referral_from_doctor}`, row.referral_reason]
              .filter(Boolean)
              .join(": ")}
          </Text>
        )}
      </Stack>
    );
  }
  const tone = queueVisitTypeTone(visitType);
  return (
    <Stack gap={2}>
      {tone === "neutral" ? (
        <Text size="sm">{queueVisitTypeLabel(t, visitType)}</Text>
      ) : (
        <OperationalSignal
          label={queueVisitTypeLabel(t, visitType)}
          shape={queueVisitTypeShape(visitType)}
          size="xs"
          tone={tone}
        />
      )}
      {visitType === "camp" && row.camp_name && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {row.camp_name}
        </Text>
      )}
    </Stack>
  );
}

/**
 * Whether the nurse has taken this patient's vitals: said in words with an
 * icon, never by colour alone. The row used to give no sign at all, so the
 * doctor called a patient whose vitals were not yet taken.
 */
export function QueueVitalsCell({ row }: { row: QueueEntry }) {
  const { t } = useTranslation("opd");
  return row.has_vitals ? (
    <OperationalSignal
      icon={IconHeartbeat}
      label={t("queueSignals.vitalsTaken")}
      shape="pill"
      size="xs"
      tone="complete"
    />
  ) : (
    <OperationalSignal
      icon={IconHeartOff}
      label={t("queueSignals.vitalsNotTaken")}
      shape="pill"
      size="xs"
      tone="neutral"
    />
  );
}
