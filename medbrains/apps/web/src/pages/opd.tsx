import {
  Card,
  Group,
  Loader,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  AppointmentWithPatient,
  CreateVitalRequest,
  DepartmentRow,
  FieldAccessLevel,
  Patient,
  QueueEntry,
} from "@medbrains/types";
import {
  P,
  PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendarStats,
  IconCheck,
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
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  type DataTableFilter,
  DoctorSearchSelect,
  OperationalSignal,
  PageHeader,
  useClinicalEmit,
  useProtectedFieldAccess,
  VitalsRecorder,
} from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { opdService } from "@/services/opd.service";
import { EncounterDetail } from "./opd/encounter-detail";
import { TodayAppointmentsPanel } from "./opd/today-appointments-panel";

export { EncounterDetail } from "./opd/encounter-detail";

import type { OpdTranslate } from "./opd/shared";
import {
  appointmentSlotLabel,
  appointmentStatusLabel,
  appointmentStatusShape,
  appointmentStatusTone,
  appointmentTypeLabel,
  appointmentVisitType,
  queueStatusIcon,
  queueStatusLabel,
  queueStatusShape,
  queueStatusTone,
  queueVisitTypeLabel,
  queueVisitTypeShape,
  queueVisitTypeTone,
  todayIsoDate,
} from "./opd/shared";
import { OpdVisitForm } from "./opd/visit-form";
import { FollowupComplianceTab, ReferralTrackingTab, WaitTimeBadge } from "./opd/workflow-tabs";
import {
  type OpdQueueRowActionId,
  type OpdQueueRowActionPermissions,
  type ResolvedOpdQueueRowAction,
  resolveOpdQueueRowActions,
} from "./opd-queue-actions";

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

export function OpdPage() {
  useRequirePermission(P.OPD.QUEUE_LIST);

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode="opd-queue">
      <OpdPageInner />
    </ClinicalEventProvider>
  );
}

export function OpdEncounterPage() {
  useRequirePermission(P.OPD.QUEUE_VIEW);
  const { encounterId } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const requestedEncounterId = encounterId ?? "";

  const { data: encounter, isLoading: encounterLoading } = useQuery({
    queryKey: ["opd-encounter", requestedEncounterId],
    queryFn: () => opdService.getEncounter(requestedEncounterId),
    enabled: requestedEncounterId.length > 0,
  });
  const patientId = encounter?.patient_id ?? "";

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => opdService.getPatient(patientId),
    enabled: patientId.length > 0,
  });

  const loading = encounterLoading || patientLoading;

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading OPD visit...</Text>
      </Stack>
    );
  }

  if (!encounter || !patient) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">OPD visit not found.</Text>
        <Button tone="secondary" onClick={() => navigate("/opd")}>
          Back to OPD queue
        </Button>
      </Stack>
    );
  }

  const patientName = formatPatientName(patient);
  const displayPatientName = protectedPatientName(patientName, patientNameAccess);
  const displayUhid = protectedPatientIdentifier(patient.uhid, uhidAccess);

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode={`opd-encounter-${encounter.id}`}>
      <Stack gap="xs" h="calc(100vh - 96px)">
        <Group justify="space-between" align="center">
          <Group gap="xs" align="baseline">
            <Text size="md" fw={700}>
              OPD Visit
            </Text>
            <Badge tone="primary" size="sm" tt="capitalize">
              {encounter.status.replace(/_/g, " ")}
            </Badge>
          </Group>
          <Button
            tone="ghost"
            size="xs"
            leftSection={<IconArrowRight size={14} style={{ transform: "rotate(180deg)" }} />}
            onClick={() => navigate("/opd")}
          >
            Back to Queue
          </Button>
        </Group>

        <Card withBorder p={0} style={{ flex: 1, overflow: "hidden" }}>
          <EncounterDetail
            encounterId={encounter.id}
            patientId={patient.id}
            patientName={displayPatientName}
            uhid={displayUhid}
            doctorId={encounter.doctor_id}
            departmentId={encounter.department_id ?? ""}
            canUpdate={canUpdate}
          />
        </Card>
      </Stack>
    </ClinicalEventProvider>
  );
}

export function OpdNewVisitPage() {
  useRequirePermission(P.OPD.VISIT_CREATE);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode="opd-new-visit">
      <Stack>
        <PageHeader
          title="New OPD visit"
          subtitle="Register a patient into the OPD queue and open the consultation workspace."
          icon={<IconStethoscope size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/opd")}>
              Back to OPD
            </Button>
          }
        />
        {initialPatientId && <PatientContextBanner patientId={initialPatientId} />}
        <Card withBorder radius="md" p="md">
          <OpdVisitForm
            key={initialPatientId}
            initialPatientId={initialPatientId}
            onCancel={() => navigate("/opd")}
            onCreated={(result) => navigate(`/opd/encounters/${result.encounter.id}#consultation`)}
          />
        </Card>
      </Stack>
    </ClinicalEventProvider>
  );
}

export function OpdVitalsPage() {
  useRequirePermission(P.OPD.QUEUE_VIEW);

  const { t } = useTranslation("opd");
  const navigate = useNavigate();
  const { queueEntryId } = useParams<{ queueEntryId: string }>();
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const canRecordNurseVitals = useHasPermission(P.NURSE.VITALS_RECORD);
  const canRecordVitals = canRecordNurseVitals || canUpdate;
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const requestedQueueEntryId = queueEntryId ?? "";

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["opd-queue", "vitals-route"],
    queryFn: () => opdService.listQueue(),
    enabled: requestedQueueEntryId.length > 0,
  });
  const entry = queue.find((row) => row.id === requestedQueueEntryId);
  const entryIdentity = entry
    ? protectedOpdQueueIdentity(
        entry,
        { name: patientNameAccess, uhid: uhidAccess },
        { patient: t("queueFallback.patient"), uhid: t("queueFallback.uhid") },
      )
    : null;

  const vitalsMutation = useMutation({
    mutationFn: (data: CreateVitalRequest) => {
      if (!entry) {
        throw new Error(t("vitals.error.queueEntryNotLoaded"));
      }
      return canRecordNurseVitals
        ? opdService.createNurseVital({ ...data, encounter_id: entry.encounter_id })
        : opdService.createVital(entry.encounter_id, data);
    },
    onSuccess: (vital) => {
      if (!entry) return;
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["vitals", entry.encounter_id] });
      void queryClient.invalidateQueries({
        queryKey: ["patient-vitals-history", entry.patient_id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["patient-vitals-history", entry.patient_id, "timeline"],
      });
      emit("opd.vitals.recorded", {
        encounter_id: entry.encounter_id,
        patient_id: entry.patient_id,
        source_record_id: vital.id,
        vital_id: vital.id,
      });
      toast.success(
        t("vitals.notify.saved", {
          patient: entryIdentity?.name ?? t("queueFallback.patient"),
        }),
        { title: t("vitals.notify.recorded") },
      );
      navigate("/opd");
    },
    onError: () => {
      toast.error(t("vitals.notify.permissionCheck"), {
        title: t("vitals.notify.unableToRecord"),
      });
    },
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">{t("vitals.loadingQueueEntry")}</Text>
      </Stack>
    );
  }

  if (!entry) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">{t("vitals.queueEntryNotFound")}</Text>
        <Button tone="secondary" onClick={() => navigate("/opd")}>
          {t("vitals.backToOpd")}
        </Button>
      </Stack>
    );
  }

  const vitalsAllowed = canRecordVitals && canRecordVitalsFromQueue(entry);
  const identity =
    entryIdentity ??
    protectedOpdQueueIdentity(
      entry,
      { name: patientNameAccess, uhid: uhidAccess },
      { patient: t("queueFallback.patient"), uhid: t("queueFallback.uhid") },
    );

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode={`opd-vitals-${entry.id}`}>
      <Stack>
        <PageHeader
          title={t("vitals.recordOpdVitals")}
          subtitle={t("vitals.subtitle", { patient: identity.name, token: identity.token })}
          icon={<IconHeartbeat size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/opd")}>
              {t("vitals.backToOpd")}
            </Button>
          }
        />
        <Card withBorder p="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>{identity.name}</Text>
              <Text size="xs" c="dimmed">
                {t("vitals.identityLine", { token: identity.token, uhid: identity.uhid })}
              </Text>
            </Stack>
            <OperationalSignal
              icon={queueStatusIcon(entry.status)}
              label={queueStatusLabel(t, entry.status)}
              shape={queueStatusShape(entry.status)}
              tone={queueStatusTone(entry.status)}
            />
          </Group>
        </Card>
        {!vitalsAllowed ? (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            {t("vitals.permissionBlocked")}
          </Alert>
        ) : (
          <Card withBorder radius="md" p="md">
            <VitalsRecorder
              onSubmit={(data) => vitalsMutation.mutate(data)}
              isSubmitting={vitalsMutation.isPending}
              onCancel={() => navigate("/opd")}
            />
          </Card>
        )}
      </Stack>
    </ClinicalEventProvider>
  );
}

function formatPatientName(patient: Patient): string {
  return `${patient.first_name} ${patient.last_name}`.trim() || patient.uhid;
}

function formatQueueToken(tokenNumber: number): string {
  return `T${String(tokenNumber).padStart(3, "0")}`;
}

function protectedPatientName(
  patientName: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, patientName, "name");
  return displayValue === "—" ? "Patient" : displayValue;
}

function protectedPatientIdentifier(
  identifier: string | null | undefined,
  access: FieldAccessLevel,
): string {
  const displayValue = fieldAccessText(access, identifier, "identifier");
  return displayValue === "—" ? "No UHID" : displayValue;
}

function protectedOpdQueueIdentity(
  entry: QueueEntry,
  access: { name: FieldAccessLevel; uhid: FieldAccessLevel },
  fallback: { patient: string; uhid: string } = { patient: "Patient", uhid: "No UHID" },
): { name: string; token: string; uhid: string } {
  const name = fieldAccessText(access.name, entry.patient_name, "name");
  const uhid = fieldAccessText(access.uhid, entry.uhid, "identifier");

  return {
    name: name === "—" ? fallback.patient : name,
    token: formatQueueToken(entry.token_number),
    uhid: uhid === "—" ? fallback.uhid : uhid,
  };
}

const OPD_QUEUE_STATUS_ONLY_PERMISSIONS: OpdQueueRowActionPermissions = {
  canManageToken: true,
  canOpenVisit: true,
  canRecordVitals: true,
};

function queueActionLabel(t: OpdTranslate, actionId: OpdQueueRowActionId): string {
  return t(`queueAction.${actionId}.label`);
}

function queueActionDisabledReason(t: OpdTranslate, action: ResolvedOpdQueueRowAction): string {
  return t(`queueAction.${action.id}.disabled`, {
    defaultValue: action.disabledReasonText ?? queueActionLabel(t, action.id),
  });
}

function queueActionEnabled(row: QueueEntry, actionId: OpdQueueRowActionId): boolean {
  return (
    resolveOpdQueueRowActions(row, OPD_QUEUE_STATUS_ONLY_PERMISSIONS).find(
      (action) => action.id === actionId,
    )?.enabled ?? false
  );
}

function canRecordVitalsFromQueue(row: QueueEntry): boolean {
  return queueActionEnabled(row, "record_vitals");
}

function OpdRegistrationPolicyToggle() {
  const canManage = useHasPermission("admin.settings.general.manage");
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["opd-registration-policy"],
    queryFn: () => opdService.getRegistrationPolicy(),
    enabled: canManage,
  });
  const mutation = useMutation({
    mutationFn: (require_opd_registration: boolean) =>
      opdService.updateRegistrationPolicy({ require_opd_registration }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["opd-registration-policy"] }),
  });
  if (!canManage) return null;
  return (
    <Switch
      label="Lock records until OPD registered"
      checked={data?.require_opd_registration ?? false}
      onChange={(e) => mutation.mutate(e.currentTarget.checked)}
      disabled={mutation.isPending}
    />
  );
}

function OpdPageInner() {
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
  const [filterDate, setFilterDate] = useState("");
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

  const { data: queue = [], isLoading } = useQuery({
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

  const callMutation = useMutation({
    mutationFn: (row: QueueEntry) => opdService.callQueueEntry(row.id),
    onSuccess: (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("opd.queue.called", queueEntryEventPayload(row));
    },
  });
  const startMutation = useMutation({
    mutationFn: (row: QueueEntry) => opdService.startConsultation(row.id),
    onSuccess: (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("opd.consultation.started", queueEntryEventPayload(row));
    },
  });
  const completeMutation = useMutation({
    mutationFn: (row: QueueEntry) => opdService.completeQueueEntry(row.id),
    onSuccess: (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("opd.encounter.completed", queueEntryEventPayload(row));
    },
  });
  const noShowMutation = useMutation({
    mutationFn: (id: string) => opdService.markNoShow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
    },
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
      sortValue: (row: QueueEntry) => row.token_number,
      accessor: (row: QueueEntry) => formatQueueToken(row.token_number),
      render: (row: QueueEntry) => (
        <OperationalSignal
          label={t("queueSignals.token")}
          shape="token"
          tone={queueStatusTone(row.status)}
          value={formatQueueToken(row.token_number)}
        />
      ),
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

function QueuePatientCell({
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

function QueueAppointmentMarker({ row }: { row: QueueEntry }) {
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

function QueueVisitTypeBadge({ row }: { row: QueueEntry }) {
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
