// OPD TodayAppointmentsPanel — split from opd.tsx (pure move).

import { Card, Group, Loader, Text } from "@mantine/core";
import type { AppointmentWithPatient, FieldAccessLevel } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { DataTable, OperationalSignal } from "@/components";
import { Button } from "@/components/ui";
import {
  appointmentSlotLabel,
  appointmentStatusLabel,
  appointmentStatusShape,
  appointmentStatusTone,
  appointmentTypeLabel,
  todayIsoDate,
} from "./shared";

export function TodayAppointmentsPanel({
  appointments,
  appointmentDate,
  loading,
  canCheckIn,
  checkingInId,
  isCheckingIn,
  patientNameAccess,
  onCheckIn,
}: {
  appointments: AppointmentWithPatient[];
  appointmentDate: string;
  loading: boolean;
  canCheckIn: boolean;
  checkingInId?: string;
  isCheckingIn: boolean;
  patientNameAccess: FieldAccessLevel;
  onCheckIn: (appointment: AppointmentWithPatient) => void;
}) {
  const { t } = useTranslation("opd");
  const today = todayIsoDate();

  return (
    <Card withBorder mb="md" p="sm">
      <Group justify="space-between" mb="xs">
        <div>
          <Text fw={600} size="sm">
            {t("appointments.title")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("appointments.subtitle", { date: appointmentDate })}
          </Text>
        </div>
        <OperationalSignal
          label={t("appointments.count")}
          shape="token"
          tone={appointments.length > 0 ? "active" : "neutral"}
          value={String(appointments.length)}
        />
      </Group>

      {loading ? (
        <Group py="md" justify="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            {t("appointments.loading")}
          </Text>
        </Group>
      ) : appointments.length === 0 ? (
        <Text size="sm" c="dimmed" py="xs">
          {t("appointments.empty")}
        </Text>
      ) : (
        <DataTable
          columns={[
            {
              key: "time",
              label: t("appointments.time"),
              render: (row: AppointmentWithPatient) => (
                <Text size="sm">{appointmentSlotLabel(row, t("queue.noSlot"))}</Text>
              ),
            },
            {
              key: "patient",
              label: t("appointments.patient"),
              render: (row: AppointmentWithPatient) => {
                const protectedName = fieldAccessText(patientNameAccess, row.patient_name, "name");
                const patientName =
                  protectedName === "—" ? t("queueFallback.patient") : protectedName;
                return (
                  <>
                    <Text size="sm" fw={500}>
                      {patientName}
                    </Text>
                    {row.reason && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {row.reason}
                      </Text>
                    )}
                  </>
                );
              },
            },
            {
              key: "doctor",
              label: t("appointments.doctor"),
              render: (row: AppointmentWithPatient) => <Text size="sm">{row.doctor_name}</Text>,
            },
            {
              key: "type",
              label: t("appointments.type"),
              render: (row: AppointmentWithPatient) => (
                <OperationalSignal
                  label={appointmentTypeLabel(t, row.appointment_type)}
                  shape="token"
                  size="xs"
                  tone="active"
                />
              ),
            },
            {
              key: "status",
              label: t("appointments.status"),
              render: (row: AppointmentWithPatient) => (
                <OperationalSignal
                  label={appointmentStatusLabel(t, row.status)}
                  shape={appointmentStatusShape(row.status)}
                  size="xs"
                  tone={appointmentStatusTone(row.status)}
                />
              ),
            },
            {
              key: "action",
              label: "",
              render: (row: AppointmentWithPatient) => {
                const isFutureAppointment = row.appointment_date > today;
                const canMoveToOpd =
                  !row.encounter_id &&
                  !isFutureAppointment &&
                  ["scheduled", "confirmed", "checked_in"].includes(row.status);
                return row.status === "completed" ? (
                  <OperationalSignal
                    label={t("appointmentHandoff.carriedOut")}
                    shape="pill"
                    size="xs"
                    tone="ready"
                  />
                ) : row.encounter_id ? (
                  <OperationalSignal
                    label={t("appointmentHandoff.inOpd")}
                    shape="diamond"
                    size="xs"
                    tone="active"
                  />
                ) : isFutureAppointment ? (
                  <OperationalSignal
                    label={t("appointmentHandoff.futureSlot")}
                    shape="token"
                    size="xs"
                    tone="neutral"
                  />
                ) : (
                  <Button
                    tone="secondary"
                    size="xs"
                    leftSection={<IconPlayerPlay size={14} />}
                    disabled={!canCheckIn || !canMoveToOpd}
                    loading={isCheckingIn && checkingInId === row.id}
                    onClick={() => onCheckIn(row)}
                  >
                    {t("appointmentHandoff.sendToOpd")}
                  </Button>
                );
              },
            },
          ]}
          data={appointments}
          rowKey={(row) => row.id}
        />
      )}
    </Card>
  );
}

// ── Encounter detail tabs ────────────────────────────────
