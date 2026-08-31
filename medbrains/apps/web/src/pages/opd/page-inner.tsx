// Opd OpdPageInner — split from opd.tsx (pure move).

import { Group, Select, Stack, Switch, Tabs, Text, TextInput, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type { AppointmentWithPatient, DepartmentRow, QueueEntry } from "@medbrains/types";
import {
  P,
  PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconCalendarStats,
  IconCheck,
  IconDeviceHeartMonitor,
  IconEye,
  IconHeartbeat,
  IconPhone,
  IconPlayerPlay,
  IconPlus,
  IconSearch,
  IconStethoscope,
  IconTransferIn,
  IconUserOff,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { Column, DataTableFilter } from "@/components";
import {
  DataTable,
  DoctorSearchSelect,
  OperationalSignal,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
} from "@/components";
import { Alert, Button, IconButton, toast } from "@/components/ui";
import { opdService } from "@/services/opd.service";
import type {
  OpdQueueRowActionId,
  OpdQueueRowActionPermissions,
  ResolvedOpdQueueRowAction,
} from "../opd-queue-actions";
import { resolveOpdQueueRowActions } from "../opd-queue-actions";
import { isStaleRowError } from "./queue-action-error";
import { QueueAppointmentMarker, QueuePatientCell, QueueVisitTypeBadge } from "./queue-cells";
import { OpdRegistrationPolicyToggle } from "./registration-policy-toggle";
import {
  appointmentVisitType,
  type OpdTranslate,
  queueStatusIcon,
  queueStatusLabel,
  queueStatusShape,
  queueStatusTone,
  queueTokenLabel,
  queueVisitTypeLabel,
  todayIsoDate,
} from "./shared";
import { TodayAppointmentsPanel } from "./today-appointments-panel";
import { OpdVitalsCounter } from "./vitals-counter";
import { FollowupComplianceTab, ReferralTrackingTab, WaitTimeBadge } from "./workflow-tabs";

function queueEntryEventPayload(row: QueueEntry) {
  return {
    appointment_id: row.appointment_id,
    department_id: row.department_id,
    doctor_id: row.doctor_id,
    encounter_id: row.encounter_id,
    patient_id: row.patient_id,
    queue_date: row.queue_date,
    queue_entry_id: row.id,
    token_number: row.token_number,
    visit_type: row.visit_type,
  };
}

function queueActionLabel(t: OpdTranslate, actionId: OpdQueueRowActionId): string {
  return t(`queueAction.${actionId}.label`);
}

function queueActionDisabledReason(t: OpdTranslate, action: ResolvedOpdQueueRowAction): string {
  return t(`queueAction.${action.id}.disabled`, {
    defaultValue: action.disabledReasonText ?? queueActionLabel(t, action.id),
  });
}

export function OpdPageInner() {
  const { t } = useTranslation("opd");
  const emit = useClinicalEmit();
  const navigate = useNavigate();
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canViewQueue = useHasPermission(P.OPD.QUEUE_VIEW);
  const canManageToken = useHasPermission(P.OPD.TOKEN_MANAGE);
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const canRecordNurseVitals = useHasPermission(P.NURSE.VITALS_RECORD);
  const canRecordVitals = canRecordNurseVitals || canUpdate;
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const patientUhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const currentUser = useAuthStore((s) => s.user);
  const patientIdentityAccess = useMemo(
    () => ({ name: patientNameAccess, uhid: patientUhidAccess }),
    [patientNameAccess, patientUhidAccess],
  );

  const queryClient = useQueryClient();
  // Today, shown. The server already defaults to the tenant's local today when
  // no date is sent, so an empty box and a filled one fetched the same rows --
  // but the box read as "no date filter", and a desk looking at an empty date
  // beside yesterday's leftovers cannot tell whether it is seeing today's
  // queue or every queue. Say which day this is.
  const [filterDate, setFilterDate] = useState(todayIsoDate);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string | null>(null);
  const [filterDoctorId, setFilterDoctorId] = useState<string | null>(null);
  const [queueVisitTypeTab, setQueueVisitTypeTab] = useState<string | null>("all");
  const [myPatientsOnly, setMyPatientsOnly] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [debouncedQueueSearch] = useDebouncedValue(queueSearch.trim(), 250);
  const queueStatusOptions = useMemo(
    () =>
      ["waiting", "called", "in_consultation", "completed", "no_show"].map((status) => ({
        value: status,
        label: queueStatusLabel(t, status),
      })),
    [t],
  );
  const queueVisitTypeTabs = useMemo(
    () =>
      ["all", "walk_in", "booked", "follow_up", "referral", "emergency", "camp"].map(
        (visitType) => ({
          value: visitType,
          label: visitType === "all" ? t("queueVisitType.all") : queueVisitTypeLabel(t, visitType),
        }),
      ),
    [t],
  );

  // Departments for filter dropdown
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });
  const deptOptions = (departments as DepartmentRow[])
    .filter((d) => d.department_type === "clinical" || d.department_type === "para_clinical")
    .map((d) => ({ value: d.id, label: d.name }));

  const queueParams: Record<string, string> = {};
  if (filterDate) {
    queueParams.date = filterDate;
  }
  if (filterStatus) {
    queueParams.status = filterStatus;
  }
  if (debouncedQueueSearch) {
    queueParams.search = debouncedQueueSearch;
  }
  if (filterDeptId) {
    queueParams.department_id = filterDeptId;
  }
  if (filterDoctorId) {
    queueParams.doctor_id = filterDoctorId;
  } else if (myPatientsOnly && currentUser) {
    queueParams.doctor_id = currentUser.id;
  }
  if (queueVisitTypeTab && queueVisitTypeTab !== "all") {
    queueParams.visit_type = queueVisitTypeTab;
  }

  const {
    data: queue = [],
    isLoading,
    isError: queueFailed,
  } = useQuery({
    queryKey: ["opd-queue", queueParams],
    queryFn: () => opdService.listQueue(queueParams),
  });

  const appointmentDate = filterDate || todayIsoDate();
  const appointmentParams: Record<string, string> = { date: appointmentDate };
  if (filterDeptId) {
    appointmentParams.department_id = filterDeptId;
  }
  if (filterDoctorId) {
    appointmentParams.doctor_id = filterDoctorId;
  } else if (myPatientsOnly && currentUser) {
    appointmentParams.doctor_id = currentUser.id;
  }
  const { data: todayAppointments = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ["opd-appointments", appointmentParams],
    queryFn: () => opdService.listAppointments(appointmentParams),
    enabled: canCreate || canManageToken,
  });

  const appointmentCheckInMutation = useMutation({
    mutationFn: (appointment: AppointmentWithPatient) =>
      opdService.createEncounter({
        patient_id: appointment.patient_id,
        department_id: appointment.department_id,
        doctor_id: appointment.doctor_id,
        appointment_id: appointment.id,
        visit_type: appointmentVisitType(appointment.appointment_type),
        notes: appointment.reason ?? undefined,
      }),
    onSuccess: (result, appointment) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const protectedName = fieldAccessText(patientNameAccess, appointment.patient_name, "name");
      const patientName = protectedName === "—" ? t("queueFallback.patient") : protectedName;
      toast.success(t("notify.appointmentAddedToOpdQueue", { patient: patientName }), {
        title: t("notify.appointmentMovedToOpd"),
      });
      emit("opd.encounter.created", {
        appointment_id: appointment.id,
        department_id: result.encounter.department_id,
        doctor_id: result.encounter.doctor_id,
        encounter_id: result.encounter.id,
        patient_id: result.encounter.patient_id,
        queue_entry_id: result.queue.id,
        token_number: result.queue.token_number,
        visit_type: result.encounter.visit_type,
      });
    },
    onError: () => {
      toast.error(t("notify.appointmentMoveBlocked"), {
        title: t("notify.unableToMoveAppointment"),
      });
    },
  });

  /**
   * Every queue action reports failure, and refetches when it fails.
   *
   * All four of these ran without an `onError`. The server guards each
   * transition on the row's current status — `call` updates only where the
   * status is still `waiting` — and returns 404 when it does not match, so a
   * row somebody else already called made the button do nothing at all, with
   * no message and no change on screen. The operator pressed it again.
   *
   * The refetch is the actual repair: the usual cause is a stale row, and
   * re-reading the queue shows its real status instead of leaving the screen
   * asserting something the server has already rejected.
   */
  const onQueueActionError = (error: Error) => {
    void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
    toast.error(isStaleRowError(error) ? t("notify.queueRowMoved") : error.message, {
      title: t("notify.queueActionFailed"),
    });
  };

  const callMutation = useMutation({
    mutationFn: (row: QueueEntry) => opdService.callQueueEntry(row.id),
    onSuccess: (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("opd.queue.called", queueEntryEventPayload(row));
    },
    onError: onQueueActionError,
  });
  const startMutation = useMutation({
    mutationFn: (row: QueueEntry) => opdService.startConsultation(row.id),
    onSuccess: (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("opd.consultation.started", queueEntryEventPayload(row));
    },
    onError: onQueueActionError,
  });
  const completeMutation = useMutation({
    mutationFn: (row: QueueEntry) => opdService.completeQueueEntry(row.id),
    onSuccess: (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("opd.encounter.completed", queueEntryEventPayload(row));
    },
    onError: onQueueActionError,
  });
  const noShowMutation = useMutation({
    mutationFn: (id: string) => opdService.markNoShow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
    },
    onError: onQueueActionError,
  });
  const queueActionPermissions: OpdQueueRowActionPermissions = {
    canManageToken,
    canOpenVisit: canViewQueue,
    canRecordVitals,
  };

  const renderQueueAction = (action: ResolvedOpdQueueRowAction, row: QueueEntry) => {
    if (!action.visible) return null;

    const actionLabel = queueActionLabel(t, action.id);
    const tooltipLabel = action.enabled ? actionLabel : queueActionDisabledReason(t, action);
    const disabled = !action.enabled;
    const iconButton = (() => {
      switch (action.id) {
        case "record_vitals":
          return (
            <IconButton
              tone="primary"
              disabled={disabled}
              onClick={() => {
                if (action.enabled) navigate(`/opd/queue/${row.id}/vitals`);
              }}
              aria-label={actionLabel}
            >
              <IconHeartbeat size={16} />
            </IconButton>
          );
        case "open_visit":
          return (
            <IconButton
              disabled={disabled}
              onClick={() => {
                if (action.enabled) {
                  navigate(`/opd/encounters/${row.encounter_id}#consultation`);
                }
              }}
              aria-label={actionLabel}
            >
              <IconEye size={16} />
            </IconButton>
          );
        case "call_patient":
          return (
            <IconButton
              disabled={disabled}
              onClick={() => {
                if (action.enabled) callMutation.mutate(row);
              }}
              aria-label={actionLabel}
            >
              <IconPhone size={16} />
            </IconButton>
          );
        case "start_consultation":
          return (
            <IconButton
              disabled={disabled}
              onClick={() => {
                if (action.enabled) startMutation.mutate(row);
              }}
              aria-label={actionLabel}
            >
              <IconPlayerPlay size={16} />
            </IconButton>
          );
        case "complete_visit":
          return (
            <IconButton
              tone="success"
              disabled={disabled}
              onClick={() => {
                if (action.enabled) completeMutation.mutate(row);
              }}
              aria-label={actionLabel}
            >
              <IconCheck size={16} />
            </IconButton>
          );
        case "mark_no_show":
          return (
            <IconButton
              tone="danger"
              disabled={disabled}
              onClick={() => {
                if (action.enabled) noShowMutation.mutate(row.id);
              }}
              aria-label={actionLabel}
            >
              <IconUserOff size={16} />
            </IconButton>
          );
      }
    })();

    return (
      <Tooltip key={action.id} label={tooltipLabel}>
        <span>{iconButton}</span>
      </Tooltip>
    );
  };
  const columns = [
    {
      key: "token_number",
      label: t("queueColumns.token"),
      sortable: true,
      searchable: true,
      // Sort on the queue's own integer, which is monotonic within the day and
      // is what ORDER BY on the server uses. The displayed code is shared
      // across a visit, so sorting by it would interleave modules.
      sortValue: (row: QueueEntry) => row.token_number,
      accessor: (row: QueueEntry) => queueTokenLabel(row),
      render: (row: QueueEntry) => (
        <OperationalSignal
          label={t("queueSignals.token")}
          shape="token"
          tone={queueStatusTone(row.status)}
          value={queueTokenLabel(row)}
        />
      ),
    },
    {
      key: "token_room",
      label: t("queueColumns.room", "Room"),
      sortable: true,
      sortValue: (row: QueueEntry) => row.token_counter_label ?? row.token_room ?? "",
      accessor: (row: QueueEntry) => row.token_counter_label ?? row.token_room ?? "",
      // Where they were actually called to wins over the queue they belong to:
      // "Cardiology" tells a patient which corridor, "OPD Counter 3" tells them
      // which door.
      render: (row: QueueEntry) => {
        const room = row.token_counter_label ?? row.token_room;
        return room ? (
          <Text size="sm">{room}</Text>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        );
      },
    },
    {
      key: "patient_name",
      label: t("queueColumns.patient"),
      sortable: true,
      searchable: true,
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: QueueEntry) => row.patient_name ?? row.uhid,
      fieldKind: "name",
      hiddenLabel: t("queue.restricted.patient"),
      render: (row: QueueEntry) => <QueuePatientCell access={patientIdentityAccess} row={row} />,
    },
    {
      key: "visit_type",
      label: t("queueColumns.visit"),
      render: (row: QueueEntry) => <QueueVisitTypeBadge row={row} />,
    },
    {
      key: "chief_complaint",
      label: t("queueColumns.complaint"),
      searchable: true,
      accessor: (row: QueueEntry) => row.chief_complaint ?? "",
      render: (row: QueueEntry) =>
        row.chief_complaint ? (
          <Text size="sm" lineClamp={2}>
            {row.chief_complaint}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            {t("queue.noComplaint")}
          </Text>
        ),
    },
    {
      key: "status",
      label: t("queueColumns.status"),
      render: (row: QueueEntry) => (
        <OperationalSignal
          icon={queueStatusIcon(row.status)}
          label={queueStatusLabel(t, row.status)}
          shape={queueStatusShape(row.status)}
          tone={queueStatusTone(row.status)}
        />
      ),
    },
    {
      key: "appointment",
      label: t("queueColumns.appointment"),
      render: (row: QueueEntry) => <QueueAppointmentMarker row={row} />,
    },
    {
      key: "queue_date",
      label: t("queueColumns.date"),
      sortable: true,
      accessor: (row: QueueEntry) => row.queue_date,
      render: (row: QueueEntry) => <Text size="sm">{row.queue_date}</Text>,
    },
    {
      key: "actions",
      label: t("queueColumns.actions"),
      requiredPermissions: [P.OPD.QUEUE_VIEW, P.OPD.VISIT_UPDATE, P.OPD.VITALS.CREATE],
      permissionMode: "any",
      render: (row: QueueEntry) => (
        <Group gap="xs">
          {resolveOpdQueueRowActions(row, queueActionPermissions).map((action) =>
            renderQueueAction(action, row),
          )}
        </Group>
      ),
    },
  ] satisfies Column<QueueEntry>[];

  const queueFilters: DataTableFilter<QueueEntry>[] = [
    {
      key: "status",
      label: t("queueColumns.status"),
      options: queueStatusOptions,
      matches: (row, value) => row.status === value,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("title.opd")}
        subtitle={t("subtitle.outpatientDepartmentQueue")}
        icon={<IconStethoscope size={20} stroke={1.5} />}
        color="primary"
        actions={
          <Group gap="sm">
            <OpdRegistrationPolicyToggle />
            {canCreate ? (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={() => navigate("/opd/new")}
              >
                {t("action.newVisit")}
              </Button>
            ) : null}
          </Group>
        }
      />

      <Tabs defaultValue="queue">
        <Tabs.List mb="md">
          <Tabs.Tab value="queue" leftSection={<IconUsers size={16} />}>
            {t("queue")}
          </Tabs.Tab>
          <Tabs.Tab value="vitals-counter" leftSection={<IconDeviceHeartMonitor size={16} />}>
            {t("vitalsCounter.tab")}
          </Tabs.Tab>
          <Tabs.Tab value="referral-tracking" leftSection={<IconTransferIn size={16} />}>
            {t("referralTracking")}
          </Tabs.Tab>
          <Tabs.Tab value="followup-compliance" leftSection={<IconCalendarStats size={16} />}>
            {t("followUpCompliance")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="queue">
          <Stack gap="md" mb="md">
            <Group align="end">
              <TextInput
                placeholder={t("queueFilters.search")}
                leftSection={<IconSearch size={16} />}
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.currentTarget.value)}
                w={280}
              />
              <TextInput
                placeholder={t("placeholder.date")}
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.currentTarget.value)}
                w={170}
              />
              <Select
                placeholder={t("placeholder.status")}
                data={queueStatusOptions}
                value={filterStatus}
                onChange={setFilterStatus}
                clearable
                w={170}
              />
              <Select
                placeholder={t("placeholder.department")}
                data={deptOptions}
                value={filterDeptId}
                onChange={setFilterDeptId}
                clearable
                searchable
                w={200}
              />
              <div style={{ width: 240 }}>
                <DoctorSearchSelect
                  label={t("label.doctor")}
                  placeholder={t("queueFilters.doctor")}
                  value={filterDoctorId ?? ""}
                  onChange={(value) => {
                    setFilterDoctorId(value || null);
                    if (value) {
                      setMyPatientsOnly(false);
                    }
                  }}
                />
              </div>
              <Switch
                label={t("label.myPatients")}
                checked={myPatientsOnly}
                onChange={(e) => {
                  setMyPatientsOnly(e.currentTarget.checked);
                  if (e.currentTarget.checked) {
                    setFilterDoctorId(null);
                  }
                }}
              />
              <WaitTimeBadge
                departmentId={filterDeptId ?? undefined}
                doctorId={
                  filterDoctorId ?? (myPatientsOnly && currentUser ? currentUser.id : undefined)
                }
              />
            </Group>
          </Stack>
          <TodayAppointmentsPanel
            appointments={todayAppointments}
            appointmentDate={appointmentDate}
            loading={loadingAppointments}
            canCheckIn={canCreate}
            checkingInId={appointmentCheckInMutation.variables?.id}
            isCheckingIn={appointmentCheckInMutation.isPending}
            patientNameAccess={patientNameAccess}
            onCheckIn={(appointment) => appointmentCheckInMutation.mutate(appointment)}
          />
          <Tabs value={queueVisitTypeTab} onChange={setQueueVisitTypeTab} mb="xs">
            <Tabs.List>
              {queueVisitTypeTabs.map((tab) => (
                <Tabs.Tab key={tab.value} value={tab.value}>
                  {tab.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          {/* A failed read must not be drawn as an empty waiting room. The
              table renders its empty state for any zero-row list, and on an
              outage `queue` is [] — so without this the busiest screen on the
              path tells the desk that nobody is waiting. */}
          {queueFailed && <Alert tone="danger">{t("queue.unavailable")}</Alert>}
          <DataTable
            columns={columns}
            data={queue}
            loading={isLoading}
            rowKey={(row) => row.id}
            searchable
            searchPlaceholder={t("queue.searchPlaceholder", "Search patient or token")}
            filters={queueFilters}
            exportable
            exportFileName="opd-queue"
            virtualized="auto"
            virtualizeAt={40}
            virtualRowHeight={58}
            tableMaxHeight="calc(100vh - 410px)"
          />
        </Tabs.Panel>

        <Tabs.Panel value="vitals-counter">
          <OpdVitalsCounter
            departmentId={filterDeptId || undefined}
            date={filterDate || undefined}
          />
        </Tabs.Panel>

        <Tabs.Panel value="referral-tracking">
          <ReferralTrackingTab />
        </Tabs.Panel>

        <Tabs.Panel value="followup-compliance">
          <FollowupComplianceTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
