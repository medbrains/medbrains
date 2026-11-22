// Emergency VisitsTab — split from emergency.tsx (pure move).

import { Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { ErVisit } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBuildingHospital,
  IconEye,
  IconGavel,
  IconHeartbeat,
  IconPlus,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
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
import { WaitTimeCell } from "./wait-time";

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
      render: (r: ErVisit) => <WaitTimeCell visit={r} />,
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
            <PatientContextBanner
              patientId={contextPatientId}
              hideLoadingState
              collectLane="emergency"
            />
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
