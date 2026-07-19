import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import type { OpdQueueVisitFormInput } from "@medbrains/schemas";
import { opdQueueVisitFormSchema } from "@medbrains/schemas";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  AppointmentWithPatient,
  Camp,
  Consultation,
  CreateEncounterResponse,
  CreateVitalRequest,
  DepartmentRow,
  Diagnosis,
  FieldAccessLevel,
  LabTestCatalog,
  Patient,
  PatientAllergy,
  PatientDiagnosisRow,
  PrescriptionWithItems,
  QueueEntry,
  Vital,
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
  IconCalendarPlus,
  IconCalendarStats,
  IconCertificate,
  IconChartLine,
  IconCheck,
  IconChevronDown,
  IconClipboardList,
  IconClock,
  IconDotsVertical,
  IconEye,
  IconFileCheck,
  IconFlask,
  IconHeartbeat,
  IconHistory,
  IconMedicalCross,
  IconMessage,
  IconNotebook,
  IconPhone,
  IconPill,
  IconPlayerPlay,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconShieldCheck,
  IconStar,
  IconStethoscope,
  IconTimeline,
  IconTransferIn,
  IconUserOff,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ClinicalEventProvider,
  type Column,
  DataTable,
  type DataTableFilter,
  DoctorSearchSelect,
  OperationalSignal,
  type OperationalSignalShape,
  type OperationalSignalTone,
  PageHeader,
  PatientSearchSelect,
  useClinicalEmit,
  useProtectedFieldAccess,
  VisitSummaryPrint,
  VitalsRecorder,
} from "@/components";
import { PatientBillingModal } from "@/components/Billing/PatientBillingModal";
import { CampRegistrationModal } from "@/components/Camp/CampRegistrationModal";
import { EmergencyVisitModal } from "@/components/Emergency/EmergencyVisitModal";
import { OrderBasketChip } from "@/components/OrderBasket/OrderBasketChip";
import {
  type OrderBasketTab,
  OrderBasketWorkspace,
} from "@/components/OrderBasket/OrderBasketWorkspace";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientContextSummary } from "@/components/Patient/PatientContextSummary";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import {
  DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
  OPD_VISIT_TYPE_OPTIONS,
  toCreateEncounterRequest,
} from "@/forms/opd.form";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { todayDateString } from "@/lib/date-utils";
import { campService } from "@/services/camp.service";
import { ipdService } from "@/services/ipd.service";
import { mrdService } from "@/services/mrd.service";
import { opdService } from "@/services/opd.service";
import { AdmitToIpdButton } from "./opd/admit-to-ipd-button";
import { ConsultationTab } from "./opd/consultation";
import { DiagnosesTab } from "./opd/diagnoses";
import { HistoryTab, PhysicalExamTab, ROSTab } from "./opd/documentation-tabs";
import { FollowUpTab } from "./opd/follow-up";
import { GroupAppointmentModal } from "./opd/group-appointment-modal";
import { InvestigationsTab } from "./opd/investigations";
import { PharmacyDispatchTab } from "./opd/pharmacy-dispatch";
import { PrescriptionsTab } from "./opd/prescriptions";
import { VitalsTab } from "./opd/vitals";
import {
  CertificatesTab,
  ChartsTab,
  ConsentsTab,
  DocketTab,
  FeedbackTab,
  FollowupComplianceTab,
  PreAuthTab,
  ProceduresTab,
  ReferralsTab,
  ReferralTrackingTab,
  RemindersTab,
  RxHistoryTab,
  TimelineTab,
  WaitTimeBadge,
} from "./opd/workflow-tabs";
import railStyles from "./opd-encounter.module.scss";
import {
  type OpdQueueRowActionId,
  type OpdQueueRowActionPermissions,
  type ResolvedOpdQueueRowAction,
  resolveOpdQueueRowActions,
} from "./opd-queue-actions";
import {
  activeOpdPharmacyOrderIdForJourney,
  activeOpdPharmacyRxQueueIdForJourney,
  deriveOpdJourneyCompletedEvents,
  isOpdEncounterTabValue,
  OPD_ENCOUNTER_TAB_VALUES,
  opdEncounterOrderBasketRoute,
  opdEncounterTabForOrderBasket,
  opdEncounterWorkspaceTabRoute,
  opdOrderBasketTabFromSearchParams,
} from "./opd-workspace";

type OpdTranslate = ReturnType<typeof useTranslation>["t"];

function humanizeWorkflowValue(value: string): string {
  return value.replace(/_/g, " ");
}

function queueStatusLabel(t: OpdTranslate, status: string): string {
  return t(`queueStatus.${status}`, { defaultValue: humanizeWorkflowValue(status) });
}

function queueStatusTone(status: string): OperationalSignalTone {
  switch (status) {
    case "completed":
      return "ready";
    case "no_show":
      return "risk";
    case "called":
    case "in_consultation":
      return "active";
    case "waiting":
      return "blocked";
    default:
      return "neutral";
  }
}

function queueStatusShape(status: string): OperationalSignalShape {
  switch (status) {
    case "called":
    case "in_consultation":
    case "no_show":
      return "diamond";
    case "waiting":
      return "token";
    default:
      return "pill";
  }
}

function queueStatusIcon(status: string) {
  switch (status) {
    case "waiting":
      return IconClock;
    case "called":
      return IconPhone;
    case "in_consultation":
      return IconStethoscope;
    case "completed":
      return IconCheck;
    case "no_show":
      return IconUserOff;
    default:
      return undefined;
  }
}

function appointmentStatusLabel(t: OpdTranslate, status: string): string {
  return t(`appointmentStatus.${status}`, { defaultValue: humanizeWorkflowValue(status) });
}

function appointmentStatusTone(status: string): OperationalSignalTone {
  switch (status) {
    case "completed":
      return "ready";
    case "cancelled":
    case "no_show":
      return "risk";
    case "checked_in":
    case "in_consultation":
      return "active";
    case "scheduled":
    case "confirmed":
      return "blocked";
    default:
      return "neutral";
  }
}

function appointmentStatusShape(status: string): OperationalSignalShape {
  switch (status) {
    case "checked_in":
    case "in_consultation":
    case "cancelled":
    case "no_show":
      return "diamond";
    case "scheduled":
    case "confirmed":
      return "token";
    default:
      return "pill";
  }
}

function appointmentTypeLabel(t: OpdTranslate, appointmentType: string): string {
  return t(`appointmentType.${appointmentType}`, {
    defaultValue: humanizeWorkflowValue(appointmentType),
  });
}

function queueVisitTypeLabel(t: OpdTranslate, visitType: string): string {
  return t(`queueVisitType.${visitType}`, { defaultValue: humanizeWorkflowValue(visitType) });
}

function queueVisitTypeTone(visitType: string): OperationalSignalTone {
  switch (visitType) {
    case "emergency":
      return "risk";
    case "camp":
    case "referral":
      return "active";
    case "booked":
    case "follow_up":
      return "blocked";
    default:
      return "neutral";
  }
}

function queueVisitTypeShape(visitType: string): OperationalSignalShape {
  switch (visitType) {
    case "emergency":
    case "referral":
      return "diamond";
    case "booked":
    case "follow_up":
    case "camp":
      return "token";
    default:
      return "pill";
  }
}

function todayIsoDate(): string {
  return todayDateString();
}

function appointmentVisitType(appointmentType: AppointmentWithPatient["appointment_type"]): string {
  return appointmentType === "follow_up" ? "follow_up" : "booked";
}

function appointmentSlotLabel(
  appointment: {
    appointment_date?: string | null;
    slot_start?: string | null;
    slot_end?: string | null;
    appointment_slot_start?: string | null;
    appointment_slot_end?: string | null;
  },
  noSlotLabel = "No slot",
): string {
  const start = appointment.slot_start ?? appointment.appointment_slot_start;
  const end = appointment.slot_end ?? appointment.appointment_slot_end;
  return start && end ? `${start} - ${end}` : (appointment.appointment_date ?? noSlotLabel);
}

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

interface OpdVisitFormProps {
  initialPatientId?: string;
  onCancel: () => void;
  onCreated: (result: CreateEncounterResponse) => void;
}

function OpdVisitForm({ initialPatientId = "", onCancel, onCreated }: OpdVisitFormProps) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OpdQueueVisitFormInput>({
    resolver: zodResolver(opdQueueVisitFormSchema),
    defaultValues: {
      ...DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
      patient_id: initialPatientId,
    },
  });
  const visitType = watch("visit_type");
  const selectedPatientId = watch("patient_id");

  // An admitted patient can't start a new OPD visit (admission from OPD stays allowed).
  const { data: activeAdmissions } = useQuery({
    queryKey: ["patient-active-admissions", selectedPatientId],
    queryFn: () => ipdService.listAdmissions({ patient_id: selectedPatientId, status: "admitted" }),
    enabled: Boolean(selectedPatientId),
  });
  const hasActiveAdmission = (activeAdmissions?.admissions ?? []).length > 0;

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentOptions = (departments as DepartmentRow[])
    .filter((department) =>
      ["clinical", "para_clinical"].includes(department.department_type ?? ""),
    )
    .map((department) => ({ value: department.id, label: department.name }));

  const { data: campOptionsSource = [] } = useQuery<Camp[]>({
    queryKey: ["camps", "active-for-opd"],
    queryFn: () => campService.listCamps({ status: "active" }),
    staleTime: 300_000,
  });
  const activeCampOptions = useMemo(
    () =>
      campOptionsSource.map((camp) => ({
        value: camp.id,
        label: `${camp.camp_code} - ${camp.name}`,
      })),
    [campOptionsSource],
  );

  const createMutation = useMutation({
    mutationFn: (values: OpdQueueVisitFormInput) =>
      opdService.createEncounter(toCreateEncounterRequest(values)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      toast.success("Patient added to queue", { title: "Visit created" });
      emit("opd.encounter.created", {
        encounter_id: result.encounter.id,
        patient_id: result.encounter.patient_id,
        department_id: result.encounter.department_id,
        doctor_id: result.encounter.doctor_id,
        queue_entry_id: result.queue.id,
        token_number: result.queue.token_number,
        visit_type: result.encounter.visit_type,
      });
      reset({
        ...DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
        patient_id: initialPatientId,
      });
      onCreated(result);
    },
    onError: () => {
      toast.error("Failed to create visit", { title: "Error" });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => createMutation.mutate(values))}>
      {hasActiveAdmission && (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          This patient has an active IPD admission. A new OPD visit can't be created while admitted
          — use the admission's encounter (or discharge first).
        </Alert>
      )}
      <Controller
        control={control}
        name="visit_type"
        render={({ field }) => (
          <Select
            label="Visit Type"
            data={OPD_VISIT_TYPE_OPTIONS}
            value={field.value}
            onChange={(value) => {
              const nextValue = value ?? "walk_in";
              field.onChange(nextValue);
              if (nextValue !== "camp") {
                setValue("camp_id", null, { shouldValidate: true });
              }
            }}
            error={errors.visit_type?.message}
            required
          />
        )}
      />
      {visitType === "camp" && (
        <Controller
          control={control}
          name="camp_id"
          render={({ field }) => (
            <Select
              label="Camp"
              placeholder="Select active camp"
              data={activeCampOptions}
              value={field.value ?? null}
              onChange={(value) => field.onChange(value ?? null)}
              error={errors.camp_id?.message}
              searchable
              required
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="patient_id"
        render={({ field }) => (
          <PatientSearchSelect
            value={field.value}
            onChange={field.onChange}
            error={errors.patient_id?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="department_id"
        render={({ field }) => (
          <Select
            label="Department"
            placeholder="Select department"
            data={departmentOptions}
            value={field.value ?? ""}
            onChange={(value) => field.onChange(value || null)}
            error={errors.department_id?.message}
            searchable
            required
          />
        )}
      />
      <Controller
        control={control}
        name="doctor_id"
        render={({ field }) => (
          <DoctorSearchSelect
            value={field.value ?? ""}
            onChange={(value) => field.onChange(value || null)}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea label="Notes" placeholder="Visit notes" {...field} />}
      />
      <Group justify="flex-end">
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          tone="primary"
          type="submit"
          loading={createMutation.isPending}
          disabled={hasActiveAdmission}
        >
          Create Visit
        </Button>
      </Group>
    </Stack>
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

function TodayAppointmentsPanel({
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

export function EncounterDetail({
  encounterId,
  patientId,
  patientName,
  uhid,
  doctorId,
  departmentId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  patientName: string;
  uhid: string;
  doctorId: string | null;
  departmentId: string;
  canUpdate: boolean;
}) {
  const canOrder = useHasPermission(P.ORDER_BASKET.SIGN);
  const canGenerateMrdCaseSheet = useHasPermission(P.MRD.CASE_SHEETS_GENERATE);
  const canViewMrdCaseSheets = useHasPermission(P.MRD.CASE_SHEETS_VIEW);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const orderBasketDeepLinkTab = opdOrderBasketTabFromSearchParams(searchParams);
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);
  // Controlled so the Patient Flow "IPD" chip can open the same Admit modal.
  const admitControl = useDisclosure(false);
  const billingControl = useDisclosure(false);
  const emergencyControl = useDisclosure(false);
  const campControl = useDisclosure(false);
  const [patientPeekOpened, patientPeek] = useDisclosure(false);
  const [activeEncounterTab, setActiveEncounterTab] = useHashTabs(
    "consultation",
    OPD_ENCOUNTER_TAB_VALUES,
  );
  const activeWorkspaceTab = isOpdEncounterTabValue(activeEncounterTab)
    ? activeEncounterTab
    : "consultation";
  const basketOpened = orderBasketDeepLinkTab !== null;
  const basketTab = orderBasketDeepLinkTab ?? "drug";

  function openOrderBasket(tab: OrderBasketTab = "drug") {
    setActiveEncounterTab(opdEncounterTabForOrderBasket(tab));
    navigate(opdEncounterOrderBasketRoute(encounterId, tab));
  }

  function changeOrderBasketTab(tab: OrderBasketTab) {
    setActiveEncounterTab(opdEncounterTabForOrderBasket(tab));
    navigate(opdEncounterOrderBasketRoute(encounterId, tab), { replace: true });
  }

  function closeOrderBasket() {
    navigate(opdEncounterWorkspaceTabRoute(encounterId, activeWorkspaceTab), { replace: true });
  }

  // Fetch all data for visit summary print
  const { data: vitals = [] } = useQuery({
    queryKey: ["vitals", encounterId],
    queryFn: () => opdService.listVitals(encounterId),
  });
  const { data: consultation } = useQuery<Consultation | null>({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });
  const { data: diagnoses = [] } = useQuery({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => opdService.listDiagnoses(encounterId),
  });
  const { data: prescriptions = [] } = useQuery<PrescriptionWithItems[]>({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => opdService.listPrescriptions(encounterId),
  });
  const { data: labOrdersResponse } = useQuery({
    queryKey: ["lab-orders", encounterId],
    queryFn: () => opdService.listLabOrders({ encounter_id: encounterId }),
  });
  const { data: labCatalog = [] } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => opdService.listLabCatalog(),
  });
  const { data: hospitalSettings = [] } = useQuery({
    queryKey: ["tenant-settings", "general"],
    queryFn: () => opdService.getTenantSettings("general"),
    staleTime: 600_000,
  });
  const { data: mrdCaseSheetPackets = [] } = useQuery({
    queryKey: ["mrd-case-sheets", "opd", encounterId],
    queryFn: () =>
      mrdService.listMrdCaseSheetPackets({
        encounter_id: encounterId,
        packet_type: "opd",
      }),
    enabled: canViewMrdCaseSheets,
    staleTime: 60_000,
  });
  const latestMrdCaseSheet = mrdCaseSheetPackets[0];
  const encounterLabOrders = useMemo(() => labOrdersResponse?.orders ?? [], [labOrdersResponse]);
  const journeyCompletedEvents = useMemo(
    () => deriveOpdJourneyCompletedEvents(prescriptions, encounterLabOrders, mrdCaseSheetPackets),
    [encounterLabOrders, mrdCaseSheetPackets, prescriptions],
  );
  const activePharmacyOrderId = activeOpdPharmacyOrderIdForJourney(prescriptions);
  const activePharmacyRxQueueId = activeOpdPharmacyRxQueueIdForJourney(prescriptions);

  const generateMrdCaseSheetMutation = useMutation({
    mutationFn: () => mrdService.generateOpdCaseSheetPacket(encounterId),
    onSuccess: (packet) => {
      emit("mrd.case_sheet.generated", {
        packet_id: packet.id,
        packet_number: packet.packet_number,
        packet_type: packet.packet_type,
        patient_id: packet.patient_id,
        encounter_id: packet.encounter_id,
        source_record_id: packet.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["mrd-case-sheets"] });
      toast.success(`${packet.packet_number} is available in MRD case sheets`, {
        title: "Sent to MRD",
      });
    },
    onError: () => {
      toast.error("Unable to generate the OPD case-sheet packet", {
        title: "MRD handoff failed",
      });
    },
  });

  // Allergy data
  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", patientId],
    queryFn: () => opdService.listPatientAllergies(patientId),
  });
  const activeAllergies = (allergies as PatientAllergy[]).filter((a) => a.is_active);

  // Chronic conditions (unresolved diagnoses from past encounters)
  const { data: patientDiagnoses = [] } = useQuery({
    queryKey: ["patient-diagnoses", patientId],
    queryFn: () => opdService.listPatientDiagnoses(patientId),
    staleTime: 120_000,
  });
  const chronicConditions = useMemo(() => {
    const dx = patientDiagnoses as PatientDiagnosisRow[];
    // Show unresolved diagnoses from previous encounters
    return dx.filter((d) => !d.resolved_date && d.encounter_id !== encounterId);
  }, [patientDiagnoses, encounterId]);
  const getSetting = (key: string) => {
    const row = hospitalSettings.find((s) => s.key === key);
    return row ? String(row.value) : undefined;
  };

  return (
    <>
      {summaryOpened && (
        <VisitSummaryPrint
          opened={summaryOpened}
          onClose={closeSummary}
          patientName={patientName}
          uhid={uhid}
          visitDate={new Date().toISOString()}
          hospitalName={getSetting("hospital_name")}
          hospitalAddress={getSetting("hospital_address")}
          hospitalPhone={getSetting("hospital_phone")}
          vitals={vitals as Vital[]}
          consultation={consultation as Consultation | null}
          diagnoses={diagnoses as Diagnosis[]}
          prescriptions={prescriptions}
          labOrders={encounterLabOrders}
          labCatalog={labCatalog as LabTestCatalog[]}
        />
      )}

      <PatientContextBanner patientId={patientId} hideLoadingState surface="detail" />
      <PatientFlowNavigator
        patientId={patientId}
        active="opd"
        activeEncounterId={encounterId}
        activePharmacyOrderId={activePharmacyOrderId}
        activePharmacyRxQueueId={activePharmacyRxQueueId}
        completedEvents={journeyCompletedEvents}
        compact
        onStageAction={(stage) => {
          // Reuse the encounter's own modals/drawers instead of navigating away.
          if (stage === "pharmacy" && canOrder) {
            openOrderBasket("drug");
            return true;
          }
          if (stage === "ipd") {
            admitControl[1].open();
            return true;
          }
          if (stage === "billing") {
            billingControl[1].open();
            return true;
          }
          if (stage === "patient") {
            patientPeek.open();
            return true;
          }
          if (stage === "emergency") {
            emergencyControl[1].open();
            return true;
          }
          if (stage === "camp") {
            campControl[1].open();
            return true;
          }
          return false;
        }}
        actions={
          <>
            {canOrder && <OrderBasketChip onClick={() => openOrderBasket("drug")} />}
            {canOrder && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconFlask size={14} />}
                onClick={() => openOrderBasket("lab")}
              >
                Lab
              </Button>
            )}
            {canOrder && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconEye size={14} />}
                onClick={() => openOrderBasket("radiology")}
              >
                Imaging
              </Button>
            )}
            <Menu shadow="md" width={224} position="bottom-start" keepMounted>
              <Menu.Target>
                <Button
                  tone="secondary"
                  size="xs"
                  rightSection={<IconChevronDown size={14} />}
                  leftSection={<IconDotsVertical size={14} />}
                >
                  Actions
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <AdmitToIpdButton
                  encounterId={encounterId}
                  patientName={patientName}
                  asMenuItem
                  control={admitControl}
                />
                <GroupAppointmentModal patientId={patientId} asMenuItem />
                <Menu.Item leftSection={<IconPrinter size={14} />} onClick={openSummary}>
                  Print
                </Menu.Item>
                {canGenerateMrdCaseSheet && (
                  <Menu.Item
                    leftSection={<IconClipboardList size={14} />}
                    onClick={() => generateMrdCaseSheetMutation.mutate()}
                    disabled={generateMrdCaseSheetMutation.isPending}
                  >
                    {latestMrdCaseSheet ? "Update MRD" : "Send to MRD"}
                  </Menu.Item>
                )}
                {canViewMrdCaseSheets && latestMrdCaseSheet && (
                  <Menu.Item
                    leftSection={<IconArrowRight size={14} />}
                    onClick={() =>
                      navigate(`/mrd?packet_type=opd&encounter_id=${encounterId}#case-sheets`)
                    }
                  >
                    MRD Packet
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </>
        }
      />
      <PatientBillingModal
        patientId={patientId}
        encounterId={encounterId}
        control={billingControl}
      />
      <EmergencyVisitModal patientId={patientId} control={emergencyControl} />
      <CampRegistrationModal
        patientId={patientId}
        patientName={patientName}
        control={campControl}
      />
      <Modal opened={patientPeekOpened} onClose={patientPeek.close} title="Patient" size="lg">
        <Stack gap="sm">
          <PatientContextSummary patientId={patientId} />
          <Button
            tone="primary"
            size="xs"
            onClick={() => {
              patientPeek.close();
              navigate(`/patients/${patientId}`);
            }}
          >
            Open full patient record
          </Button>
        </Stack>
      </Modal>

      <Tabs
        value={activeEncounterTab}
        onChange={setActiveEncounterTab}
        keepMounted={false}
        orientation="vertical"
        classNames={{
          tab: railStyles.railTab,
          tabSection: railStyles.railTabSection,
          tabLabel: railStyles.railTabLabel,
        }}
        style={{ display: "flex", height: "100%", width: "100%", minWidth: 0, minHeight: 0 }}
      >
        {/* ── Left Sidebar: Patient + Nav ── */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            minHeight: 0,
            overflowY: "auto",
            borderRight: "1px solid var(--mb-border-subtle)",
            padding: "10px 10px 28px",
            background: "var(--mb-bg-subtle)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Allergies */}
          {activeAllergies.length > 0 && (
            <Card padding="xs" mb="xs" radius="sm" style={{ background: "var(--mb-danger-bg)" }}>
              <Group gap={4} mb={4}>
                <IconAlertTriangle size={14} color="var(--mb-danger-fg)" />
                <Text size="xs" fw={700} c="danger">
                  Allergies
                </Text>
              </Group>
              <Group gap={4} wrap="wrap">
                {activeAllergies.map((a) => (
                  <Badge key={a.id} tone="danger" variant="filled" size="xs">
                    {a.allergen_name}
                  </Badge>
                ))}
              </Group>
            </Card>
          )}

          {/* Chronic Conditions */}
          {chronicConditions.length > 0 && (
            <Card padding="xs" mb="xs" radius="sm" style={{ background: "#fff" }}>
              <Group gap={4} mb={4}>
                <IconHeartbeat size={14} />
                <Text size="xs" fw={700} c="orange">
                  Conditions
                </Text>
              </Group>
              <Stack gap={2}>
                {chronicConditions.slice(0, 5).map((d) => (
                  <Text key={d.id} size="xs" c="dimmed">
                    {d.description}
                  </Text>
                ))}
              </Stack>
            </Card>
          )}

          {/* Clinical tabs — grouped for doctor workflow without hiding HMS modules */}
          <div
            style={{
              borderTop: "1px solid var(--mb-border-subtle)",
              paddingTop: 8,
              flex: 1,
              overflowY: "auto",
            }}
          >
            {[
              {
                label: "Clinical workup",
                tabs: [
                  { value: "vitals", icon: <IconHeartbeat size={14} />, label: "Vitals" },
                  {
                    value: "consultation",
                    icon: <IconNotebook size={14} />,
                    label: "Consultation",
                  },
                  { value: "history", icon: <IconHistory size={14} />, label: "History" },
                  { value: "ros", icon: <IconClipboardList size={14} />, label: "ROS" },
                  {
                    value: "physical-exam",
                    icon: <IconStethoscope size={14} />,
                    label: "Physical Exam",
                  },
                ],
              },
              {
                label: "Assessment & orders",
                tabs: [
                  { value: "diagnoses", icon: <IconStar size={14} />, label: "Diagnoses" },
                  {
                    value: "investigations",
                    icon: <IconFlask size={14} />,
                    label: "Investigations",
                  },
                  {
                    value: "procedures",
                    icon: <IconMedicalCross size={14} />,
                    label: "Procedures",
                  },
                  { value: "prescriptions", icon: <IconPill size={14} />, label: "Prescriptions" },
                  { value: "referrals", icon: <IconArrowRight size={14} />, label: "Referrals" },
                ],
              },
              {
                label: "Patient context",
                tabs: [
                  {
                    value: "rx-history",
                    icon: <IconClipboardList size={14} />,
                    label: "Rx History",
                  },
                  { value: "charts", icon: <IconChartLine size={14} />, label: "Charts" },
                  { value: "timeline", icon: <IconTimeline size={14} />, label: "Timeline" },
                ],
              },
              {
                label: "Closure",
                tabs: [
                  {
                    value: "certificates",
                    icon: <IconCertificate size={14} />,
                    label: "Certificates",
                  },
                  { value: "followup", icon: <IconCalendarPlus size={14} />, label: "Follow-up" },
                  { value: "reminders", icon: <IconNotebook size={14} />, label: "Reminders" },
                  { value: "consents", icon: <IconFileCheck size={14} />, label: "Consents" },
                ],
              },
              {
                label: "Support / admin",
                tabs: [
                  { value: "pre-auth", icon: <IconShieldCheck size={14} />, label: "Pre-Auth" },
                  { value: "docket", icon: <IconStar size={14} />, label: "Docket" },
                  {
                    value: "pharmacy-dispatch",
                    icon: <IconPill size={14} />,
                    label: "Pharmacy Dispatch",
                  },
                  { value: "feedback", icon: <IconMessage size={14} />, label: "Feedback" },
                ],
              },
            ].map((section) => (
              <div key={section.label} style={{ marginBottom: 6 }}>
                <Text
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  mb={2}
                  px={4}
                  style={{ fontSize: 10, letterSpacing: "0.06em" }}
                >
                  {section.label}
                </Text>
                <Tabs.List
                  style={{ border: "none", display: "flex", flexDirection: "column", gap: 2 }}
                >
                  {section.tabs.map((tab) => (
                    <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                      {tab.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Content panels ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px 24px",
          }}
        >
          <Tabs.Panel value="vitals">
            <VitalsTab encounterId={encounterId} patientId={patientId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="consultation">
            <ConsultationTab
              encounterId={encounterId}
              patientId={patientId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="history">
            <HistoryTab encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="ros">
            <ROSTab encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="physical-exam">
            <PhysicalExamTab encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="diagnoses">
            <DiagnosesTab encounterId={encounterId} patientId={patientId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="investigations">
            <InvestigationsTab
              encounterId={encounterId}
              patientId={patientId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="procedures">
            <ProceduresTab encounterId={encounterId} patientId={patientId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="prescriptions">
            <PrescriptionsTab
              encounterId={encounterId}
              patientId={patientId}
              patientName={patientName}
              uhid={uhid}
              canUpdate={canUpdate}
              allergies={activeAllergies.map((a) => a.allergen_name)}
            />
          </Tabs.Panel>
          <Tabs.Panel value="referrals">
            <ReferralsTab
              patientId={patientId}
              encounterId={encounterId}
              departmentId={departmentId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="rx-history">
            <RxHistoryTab patientId={patientId} />
          </Tabs.Panel>
          <Tabs.Panel value="charts">
            <ChartsTab patientId={patientId} />
          </Tabs.Panel>
          <Tabs.Panel value="timeline">
            <TimelineTab patientId={patientId} />
          </Tabs.Panel>
          <Tabs.Panel value="certificates">
            <CertificatesTab
              patientId={patientId}
              encounterId={encounterId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="followup">
            <FollowUpTab
              patientId={patientId}
              doctorId={doctorId}
              departmentId={departmentId}
              canUpdate={canUpdate}
            />
          </Tabs.Panel>
          <Tabs.Panel value="reminders">
            <RemindersTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="feedback">
            <FeedbackTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="consents">
            <ConsentsTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="pre-auth">
            <PreAuthTab patientId={patientId} encounterId={encounterId} canUpdate={canUpdate} />
          </Tabs.Panel>
          <Tabs.Panel value="docket">
            <DocketTab />
          </Tabs.Panel>
          <Tabs.Panel value="pharmacy-dispatch">
            <PharmacyDispatchTab encounterId={encounterId} />
          </Tabs.Panel>
        </div>
      </Tabs>
      <OrderBasketWorkspace
        opened={basketOpened}
        onClose={closeOrderBasket}
        encounterId={encounterId}
        patientId={patientId}
        activeTab={basketTab}
        onActiveTabChange={changeOrderBasketTab}
        onSigned={() => {
          void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
          void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
          void queryClient.invalidateQueries({ queryKey: ["opd-pharmacy-dispatch", encounterId] });
          void queryClient.invalidateQueries({ queryKey: ["patient-invoices", patientId] });
          void queryClient.invalidateQueries({ queryKey: ["patient-dicom-studies", patientId] });
        }}
      />
    </>
  );
}
