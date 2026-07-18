// Emergency VisitsTab — split from emergency.tsx (pure move).

import { Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { ErVisit } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBuildingHospital,
  IconCheck,
  IconClock,
  IconEye,
  IconGavel,
  IconHeartbeat,
  IconPlus,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { DataTable, OperationalSignal, TableValueBadge } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, Button, IconButton } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";
import {
  RestrictedValue,
  triageInfo,
  triageLabel,
  triageShape,
  triageTone,
  visitStatusIcon,
  visitStatusLabel,
  visitStatusShape,
  visitStatusTone,
} from "./shared";

function useTimer(startTime: string | null, endIndicator: number | null): string {
  const [elapsed, setElapsed] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatDuration = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!startTime) {
      setElapsed("");
      return;
    }

    const start = new Date(startTime).getTime();

    // Doctor already seen — show static duration
    if (endIndicator !== null && endIndicator !== undefined) {
      setElapsed(`${endIndicator} min`);
      return;
    }

    // Live ticking timer
    const update = () => {
      const now = Date.now();
      const diff = now - start;
      setElapsed(formatDuration(diff > 0 ? diff : 0));
    };
    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, endIndicator, formatDuration]);

  return elapsed;
}

// ── Inline Timer Component ────────────────────────────

function WaitTimeBadge({
  arrivalTime,
  doorToDoctorMins,
}: {
  arrivalTime: string;
  doorToDoctorMins: number | null;
}) {
  const { t } = useTranslation("emergency");
  const display = useTimer(arrivalTime, doorToDoctorMins);

  if (!display)
    return (
      <Text size="sm" c="dimmed">
        {t("common.notAvailable")}
      </Text>
    );

  if (doorToDoctorMins !== null && doorToDoctorMins !== undefined) {
    return (
      <OperationalSignal
        icon={IconCheck}
        label={t("waitTime.seen")}
        shape="pill"
        tone="ready"
        value={display}
      />
    );
  }

  return (
    <OperationalSignal
      icon={IconClock}
      label={t("waitTime.waiting")}
      shape="diamond"
      tone="blocked"
      value={display}
    />
  );
}

export function VisitsTab({
  canView,
  canCreate,
  canViewPatientRecord,
  contextPatientId,
}: {
  canView: boolean;
  canCreate: boolean;
  canViewPatientRecord: boolean;
  contextPatientId: string;
}) {
  const { t } = useTranslation("emergency");
  const navigate = useNavigate();
  const canUpdateVisit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const canCreateIpdAdmission = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const canAdmit = canUpdateVisit && canCreateIpdAdmission;
  const { data = [], isLoading } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
    enabled: canView,
  });
  const visibleVisits = contextPatientId
    ? data.filter((visit) => visit.patient_id === contextPatientId)
    : data;

  const columns = [
    {
      key: "visit_number",
      label: t("queueColumns.visitNumber"),
      render: (r: ErVisit) => <Text fw={600}>{r.visit_number}</Text>,
    },
    {
      key: "patient_id",
      label: t("queueColumns.patient"),
      render: (r: ErVisit) =>
        canViewPatientRecord ? (
          <PatientNameCell patientId={r.patient_id} showUhid={false} />
        ) : (
          <RestrictedValue />
        ),
    },
    {
      key: "arrival_time",
      label: t("queueColumns.arrival"),
      render: (r: ErVisit) => new Date(r.arrival_time).toLocaleString(),
    },
    {
      key: "arrival_mode",
      label: t("queueColumns.mode"),
      render: (r: ErVisit) =>
        r.arrival_mode ? (
          <TableValueBadge value={r.arrival_mode} kind="source" variant="outline" />
        ) : (
          "---"
        ),
    },
    {
      key: "chief_complaint",
      label: t("queueColumns.chiefComplaint"),
      render: (r: ErVisit) => r.chief_complaint ?? "---",
    },
    {
      key: "triage_level",
      label: t("queueColumns.triage"),
      render: (r: ErVisit) => {
        const info = triageInfo(r.triage_level);
        return (
          <OperationalSignal
            icon={IconHeartbeat}
            label={triageLabel(t, r.triage_level)}
            shape={triageShape(r.triage_level)}
            tone={triageTone(r.triage_level)}
            value={info.level > 0 ? String(info.level) : undefined}
          />
        );
      },
    },
    {
      key: "status",
      label: t("queueColumns.status"),
      render: (r: ErVisit) => (
        <OperationalSignal
          icon={visitStatusIcon(r.status)}
          label={visitStatusLabel(t, r.status)}
          shape={visitStatusShape(r.status)}
          tone={visitStatusTone(r.status)}
        />
      ),
    },
    {
      key: "is_mlc",
      label: t("queueColumns.mlc"),
      render: (r: ErVisit) =>
        r.is_mlc ? (
          <OperationalSignal
            icon={IconGavel}
            label={t("signals.mlc")}
            shape="diamond"
            tone="risk"
          />
        ) : null,
    },
    {
      key: "bay_number",
      label: t("queueColumns.bay"),
      render: (r: ErVisit) =>
        r.bay_number ? (
          <OperationalSignal
            label={t("signals.bay")}
            shape="token"
            tone="active"
            value={r.bay_number}
          />
        ) : (
          "---"
        ),
    },
    {
      key: "wait_time",
      label: t("queueColumns.waitTime"),
      render: (r: ErVisit) => (
        <WaitTimeBadge arrivalTime={r.arrival_time} doorToDoctorMins={r.door_to_doctor_mins} />
      ),
    },
    {
      key: "actions",
      label: t("queueColumns.actions"),
      render: (r: ErVisit) => {
        const canShowAdmit =
          canAdmit && ["registered", "triaged", "in_treatment", "observation"].includes(r.status);
        return (
          <Group gap="xs" wrap="nowrap">
            <Tooltip label={t("actions.openErVisit")}>
              <IconButton
                tone="primary"
                aria-label={t("actions.openErVisit")}
                onClick={() => navigate(`/emergency/visits/${r.id}`)}
              >
                <IconEye size={16} />
              </IconButton>
            </Tooltip>
            {canShowAdmit && (
              <Tooltip label={t("actions.openVisitToAdmit")}>
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconBuildingHospital size={14} />}
                  onClick={() => navigate(`/emergency/visits/${r.id}`)}
                >
                  {t("actions.admit")}
                </Button>
              </Tooltip>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              navigate(
                contextPatientId
                  ? `/emergency/visits/new?patient_id=${contextPatientId}`
                  : "/emergency/visits/new",
              )
            }
          >
            {t("registerErVisit")}
          </Button>
        </Group>
      )}
      {canView ? (
        <Stack>
          {contextPatientId && canViewPatientRecord && (
            <PatientContextBanner patientId={contextPatientId} hideLoadingState />
          )}
          {contextPatientId && !canViewPatientRecord && (
            <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
              Patient context is restricted for this role.
            </Alert>
          )}
          <DataTable
            columns={columns}
            data={visibleVisits}
            loading={isLoading}
            rowKey={(r) => r.id}
          />
        </Stack>
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            ER visit queue is not available for your role. You can register a new ER visit when
            visit creation is allowed.
          </Text>
        </Card>
      )}
    </Stack>
  );
}

// ── Code Activations Tab ──────────────────────────────
