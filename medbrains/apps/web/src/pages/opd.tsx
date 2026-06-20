import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Timeline,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import type {
  OpdFollowUpAppointmentFormInput,
  OpdLabOrderFormInput,
  OpdQueueVisitFormInput,
} from "@medbrains/schemas";
import {
  opdFollowUpAppointmentFormSchema,
  opdLabOrderFormSchema,
  opdQueueVisitFormSchema,
} from "@medbrains/schemas";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  AdmitFromOpdRequest,
  AppointmentWithPatient,
  AvailableSlot,
  BookAppointmentGroupRequest,
  BookAppointmentRequest,
  Camp,
  Consultation,
  ConsultationTemplate,
  CreateConsultationRequest,
  CreateDiagnosisRequest,
  CreateEncounterResponse,
  CreatePrescriptionRequest,
  CreateVitalRequest,
  DepartmentRow,
  Diagnosis,
  DuplicateOrderInfo,
  FieldAccessLevel,
  LabOrder,
  LabOrderListResponse,
  LabResult,
  LabTestCatalog,
  Patient,
  PatientAllergy,
  PatientConsultationHistoryRow,
  PatientDiagnosisRow,
  PatientLabOrderRow,
  PharmacyDispatchStatus as PharmacyDispatchStatusRow,
  PrescriptionHistoryItem,
  PrescriptionWithItems,
  QueueEntry,
  RadiologyDicomStudy,
  UpdateConsultationRequest,
  UpdateDiagnosisRequest,
  UpdatePrescriptionRequest,
  Vital,
  VitalHistoryPoint,
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
  IconTrash,
  IconUserOff,
  IconUsers,
  IconX,
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
  DiagnosisPanel,
  DoctorSearchSelect,
  OperationalSignal,
  type OperationalSignalShape,
  type OperationalSignalTone,
  PageHeader,
  PatientSearchSelect,
  PrescriptionPrint,
  PrescriptionViews,
  PrescriptionWriter,
  SOAPNotes,
  useClinicalEmit,
  useProtectedFieldAccess,
  VisitSummaryPrint,
  VitalsRecorder,
} from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { OrderBasketChip } from "@/components/OrderBasket/OrderBasketChip";
import {
  type OrderBasketTab,
  OrderBasketWorkspace,
} from "@/components/OrderBasket/OrderBasketWorkspace";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table, toast } from "@/components/ui";
import {
  DEFAULT_OPD_FOLLOW_UP_FORM_VALUES,
  DEFAULT_OPD_LAB_ORDER_FORM_VALUES,
  DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
  OPD_LAB_PRIORITY_OPTIONS,
  OPD_VISIT_TYPE_OPTIONS,
  toBookFollowUpAppointmentRequest,
  toCreateEncounterRequest,
  toCreateLabOrderRequest,
} from "@/forms/opd.form";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { useVitalsSource } from "@/hooks/useVitalsSource";
import { toDateString, todayDateString } from "@/lib/date-utils";
import { statusColor } from "@/lib/status-colors";
import { campService } from "@/services/camp.service";
import { mrdService } from "@/services/mrd.service";
import { opdService } from "@/services/opd.service";
import { toCreateConsultationPayload } from "./opd/consultation-utils";
import { HistoryTab, PhysicalExamTab, ROSTab } from "./opd/documentation-tabs";
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
import railStyles from "./opd-encounter.module.scss";

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
        <Button tone="primary" type="submit" loading={createMutation.isPending}>
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
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate("/opd/new")}
            >
              {t("action.newVisit")}
            </Button>
          ) : undefined
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
        <Table verticalSpacing="xs" withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("appointments.time")}</Table.Th>
              <Table.Th>{t("appointments.patient")}</Table.Th>
              <Table.Th>{t("appointments.doctor")}</Table.Th>
              <Table.Th>{t("appointments.type")}</Table.Th>
              <Table.Th>{t("appointments.status")}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {appointments.map((appointment) => {
              const isFutureAppointment = appointment.appointment_date > today;
              const canMoveToOpd =
                !appointment.encounter_id &&
                !isFutureAppointment &&
                ["scheduled", "confirmed", "checked_in"].includes(appointment.status);
              const statusLabel = appointmentStatusLabel(t, appointment.status);
              const protectedName = fieldAccessText(
                patientNameAccess,
                appointment.patient_name,
                "name",
              );
              const patientName =
                protectedName === "—" ? t("queueFallback.patient") : protectedName;
              return (
                <Table.Tr key={appointment.id}>
                  <Table.Td>
                    <Text size="sm">{appointmentSlotLabel(appointment, t("queue.noSlot"))}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {patientName}
                    </Text>
                    {appointment.reason && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {appointment.reason}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{appointment.doctor_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <OperationalSignal
                      label={appointmentTypeLabel(t, appointment.appointment_type)}
                      shape="token"
                      size="xs"
                      tone="active"
                    />
                  </Table.Td>
                  <Table.Td>
                    <OperationalSignal
                      label={statusLabel}
                      shape={appointmentStatusShape(appointment.status)}
                      size="xs"
                      tone={appointmentStatusTone(appointment.status)}
                    />
                  </Table.Td>
                  <Table.Td>
                    {appointment.status === "completed" ? (
                      <OperationalSignal
                        label={t("appointmentHandoff.carriedOut")}
                        shape="pill"
                        size="xs"
                        tone="ready"
                      />
                    ) : appointment.encounter_id ? (
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
                        loading={isCheckingIn && checkingInId === appointment.id}
                        onClick={() => onCheckIn(appointment)}
                      >
                        {t("appointmentHandoff.sendToOpd")}
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
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

  // Current medications (from most recent prescription)
  const { data: rxHistory = [] } = useQuery({
    queryKey: ["patient-rx-history", patientId],
    queryFn: () => opdService.listPatientPrescriptions(patientId),
    staleTime: 120_000,
  });
  const currentMeds = useMemo(() => {
    const history = rxHistory as PrescriptionHistoryItem[];
    const latest = history[0];
    if (!latest) return [];
    return latest.items;
  }, [rxHistory]);

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

      <PatientContextBanner patientId={patientId} hideLoadingState />
      <PatientFlowNavigator
        patientId={patientId}
        active="opd"
        activeEncounterId={encounterId}
        activePharmacyOrderId={activePharmacyOrderId}
        activePharmacyRxQueueId={activePharmacyRxQueueId}
        completedEvents={journeyCompletedEvents}
        compact
      />

      {/* Encounter action toolbar — lives in the header, above the rail/content split. */}
      <Group
        gap="xs"
        wrap="wrap"
        style={{
          padding: "10px 0 12px",
          marginTop: 4,
          borderTop: "1px solid var(--mb-border-subtle)",
        }}
      >
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
        {/* Secondary actions collapsed into a single menu. keepMounted so the
            Admit/Group modal components inside stay mounted when it closes. */}
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
            <AdmitToIpdButton encounterId={encounterId} patientName={patientName} asMenuItem />
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
      </Group>

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
            <Card
              padding="xs"
              mb="xs"
              withBorder
              style={{
                background: "var(--mb-danger-bg)",
                borderColor: "var(--mb-danger-border)",
              }}
            >
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

          {/* Current Medications */}
          {currentMeds.length > 0 && (
            <Card padding="xs" mb="xs" withBorder>
              <Group gap={4} mb={4}>
                <IconPill size={14} />
                <Text size="xs" fw={700} c="primary">
                  Medications
                </Text>
              </Group>
              <Stack gap={2}>
                {currentMeds.slice(0, 6).map((m) => (
                  <Text key={m.id} size="xs" c="dimmed">
                    {m.drug_name} — {m.dosage}
                  </Text>
                ))}
              </Stack>
            </Card>
          )}

          {/* Chronic Conditions */}
          {chronicConditions.length > 0 && (
            <Card padding="xs" mb="xs" withBorder>
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

// ── Pharmacy Dispatch Status ──────────────────────────────

function PharmacyDispatchTab({ encounterId }: { encounterId: string }) {
  const { data: dispatch = [], isLoading } = useQuery({
    queryKey: ["opd-pharmacy-dispatch", encounterId],
    queryFn: () => opdService.opdPharmacyDispatchStatus(encounterId),
  });

  const dispatchStatusColors: Record<string, BadgeTone> = {
    pending: "neutral",
    partial: "warning",
    dispensed: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "drug_name",
      label: "Drug",
      render: (row: PharmacyDispatchStatusRow) => (
        <Text size="sm" fw={500}>
          {row.drug_name}
        </Text>
      ),
    },
    {
      key: "quantity_ordered",
      label: "Ordered",
      render: (row: PharmacyDispatchStatusRow) => <Text size="sm">{row.quantity_ordered}</Text>,
    },
    {
      key: "quantity_dispensed",
      label: "Dispensed",
      render: (row: PharmacyDispatchStatusRow) => <Text size="sm">{row.quantity_dispensed}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyDispatchStatusRow) => (
        <Badge tone={dispatchStatusColors[row.status] ?? "neutral"} variant="filled" size="sm">
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Text fw={600} size="sm">
        Pharmacy dispatch status for this visit
      </Text>
      <DataTable
        columns={columns}
        data={dispatch}
        loading={isLoading}
        rowKey={(row) => `${row.prescription_id}-${row.drug_name}`}
      />
      {!isLoading && dispatch.length === 0 && (
        <Text size="sm" c="dimmed">
          No prescriptions dispatched for this visit.
        </Text>
      )}
    </Stack>
  );
}

// ── Vitals ───────────────────────────────────────────────

function VitalsTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const [formOpened, formHandlers] = useDisclosure(false);

  // Mode (REST vs CRDT) is read from <TenantConfigProvider>. Flips
  // automatically when a tenant turns on tenant_settings.clinical.
  // offline_mode + provides an edge_url. No code change here.
  const { records: vitals, append, unsyncedOps } = useVitalsSource({ encounterId });
  const { data: patientVitals = [] } = useQuery({
    queryKey: ["patient-vitals-history", patientId, "timeline"],
    queryFn: () => opdService.listPatientVitalsHistory(patientId),
  });
  const patientVitalsTimeline = useMemo(
    () =>
      [...patientVitals].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).slice(0, 12),
    [patientVitals],
  );

  const handleSubmit = (data: CreateVitalRequest) => {
    append(data);
    emit("opd.vitals.recorded", { encounter_id: encounterId, patient_id: patientId, ...data });
    formHandlers.close();
  };

  return (
    <Stack>
      {canUpdate && !formOpened && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
            Record Vitals
          </Button>
        </Group>
      )}
      {formOpened && (
        <VitalsRecorder
          onSubmit={handleSubmit}
          isSubmitting={unsyncedOps > 0}
          onCancel={formHandlers.close}
        />
      )}
      {vitals.length > 0 && (
        <Timeline
          active={0}
          bulletSize={32}
          lineWidth={2}
          color="primary"
          styles={{ item: { marginBottom: 8 } }}
        >
          {vitals.map((v: Vital, idx: number) => {
            const prev = vitals[idx + 1] as Vital | undefined;
            const trend = (curr: number | null, prevVal: number | null) => {
              if (!curr || !prevVal) return "";
              if (curr > prevVal) return " ↑";
              if (curr < prevVal) return " ↓";
              return " →";
            };
            return (
              <Timeline.Item
                key={v.id}
                bullet={<IconHeartbeat size={16} />}
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {new Date(v.created_at).toLocaleString()}
                    </Text>
                    {idx === 0 && (
                      <Badge size="sm" tone="success">
                        Latest
                      </Badge>
                    )}
                  </Group>
                }
              >
                <Group gap="md" mt={4} wrap="wrap">
                  {v.temperature != null && (
                    <Badge tone={Number(v.temperature) > 37.5 ? "danger" : "primary"} size="md">
                      🌡 {v.temperature}°C
                      {trend(
                        Number(v.temperature),
                        prev?.temperature ? Number(prev.temperature) : null,
                      )}
                    </Badge>
                  )}
                  {v.pulse != null && (
                    <Badge
                      tone={
                        Number(v.pulse) > 100
                          ? "danger"
                          : Number(v.pulse) < 60
                            ? "warning"
                            : "primary"
                      }
                      size="md"
                    >
                      ❤ {v.pulse} bpm
                      {trend(Number(v.pulse), prev?.pulse ? Number(prev.pulse) : null)}
                    </Badge>
                  )}
                  {v.systolic_bp != null && v.diastolic_bp != null && (
                    <Badge
                      tone={
                        Number(v.systolic_bp) > 140
                          ? "danger"
                          : Number(v.systolic_bp) < 90
                            ? "warning"
                            : "primary"
                      }
                      size="md"
                    >
                      🩸 {v.systolic_bp}/{v.diastolic_bp} mmHg
                    </Badge>
                  )}
                  {v.spo2 != null && (
                    <Badge tone={Number(v.spo2) < 94 ? "danger" : "primary"} size="md">
                      💨 SpO₂ {v.spo2}%
                    </Badge>
                  )}
                  {v.respiratory_rate != null && (
                    <Badge size="sm">🫁 RR {v.respiratory_rate}</Badge>
                  )}
                  {v.weight_kg != null && (
                    <Badge variant="outline" size="md">
                      ⚖ {v.weight_kg} kg
                    </Badge>
                  )}
                  {v.bmi != null && (
                    <Badge variant="outline" size="md">
                      BMI {v.bmi}
                    </Badge>
                  )}
                </Group>
                {v.notes && (
                  <Text size="sm" c="dimmed" fs="italic" mt={6} pr="lg">
                    {v.notes}
                  </Text>
                )}
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}
      {patientVitalsTimeline.length > 0 && (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Patient vitals timeline
          </Text>
          <Timeline active={0} bulletSize={28} lineWidth={2} color="teal">
            {patientVitalsTimeline.map((v: VitalHistoryPoint) => (
              <Timeline.Item
                key={v.id}
                bullet={<IconHeartbeat size={14} />}
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {new Date(v.recorded_at).toLocaleString()}
                    </Text>
                    {v.encounter_id === encounterId && (
                      <Badge size="xs" tone="primary">
                        Current encounter
                      </Badge>
                    )}
                  </Group>
                }
              >
                <Group gap="xs" mt={4} wrap="wrap">
                  {v.temperature != null && (
                    <Badge tone={Number(v.temperature) > 37.5 ? "danger" : "primary"}>
                      Temp {v.temperature}°C
                    </Badge>
                  )}
                  {v.pulse != null && (
                    <Badge tone={v.pulse > 100 ? "danger" : v.pulse < 60 ? "warning" : "primary"}>
                      Pulse {v.pulse}
                    </Badge>
                  )}
                  {v.systolic_bp != null && v.diastolic_bp != null && (
                    <Badge>
                      BP {v.systolic_bp}/{v.diastolic_bp}
                    </Badge>
                  )}
                  {v.spo2 != null && (
                    <Badge tone={v.spo2 < 94 ? "danger" : "primary"}>SpO₂ {v.spo2}%</Badge>
                  )}
                  {v.weight_kg != null && <Badge variant="outline">Weight {v.weight_kg} kg</Badge>}
                  {v.bmi != null && <Badge variant="outline">BMI {v.bmi}</Badge>}
                </Group>
              </Timeline.Item>
            ))}
          </Timeline>
        </Stack>
      )}
    </Stack>
  );
}

// ── Consultation ─────────────────────────────────────────

function ConsultationTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState<string | null>(null);

  const { data: consultation } = useQuery<Consultation | null>({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });

  const { data: templates = [] } = useQuery<ConsultationTemplate[]>({
    queryKey: ["consultation-templates"],
    queryFn: () => opdService.listConsultationTemplates(),
    staleTime: 300_000,
  });

  const { data: consultationHistory = [], isLoading: loadingConsultationHistory } = useQuery<
    PatientConsultationHistoryRow[]
  >({
    queryKey: ["patient-consultations", patientId],
    queryFn: () => opdService.listPatientConsultations(patientId),
    enabled: patientId.length > 0,
    staleTime: 60_000,
  });

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: `${t.name}${t.specialty ? ` (${t.specialty})` : ""}`,
  }));

  const selectedTemplate = useMemo(() => {
    if (!templateId) return null;
    return templates.find((t) => t.id === templateId) ?? null;
  }, [templates, templateId]);

  const templateDefaults = useMemo((): Partial<Consultation> | undefined => {
    if (!selectedTemplate || consultation) return undefined;
    return {
      chief_complaint: selectedTemplate.chief_complaints.join(", ") || null,
      plan: selectedTemplate.default_plan ?? null,
    };
  }, [selectedTemplate, consultation]);

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      opdService.createConsultation(encounterId, data),
    onSuccess: (consultation) => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["patient-consultations", patientId] });
      emit("opd.consultation.saved", {
        consultation_id: consultation.id,
        encounter_id: consultation.encounter_id,
        patient_id: patientId,
        source_record_id: consultation.id,
      });
    },
  });

  const handleSubmit = (data: CreateConsultationRequest | UpdateConsultationRequest) => {
    createMutation.mutate(toCreateConsultationPayload(data));
  };

  if (!canUpdate && !consultation) {
    return (
      <Text c="dimmed" size="sm">
        No consultation recorded yet.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {!consultation && canUpdate && templateOptions.length > 0 && (
        <Select
          label="Load from template"
          placeholder="Select a consultation template..."
          data={templateOptions}
          value={templateId}
          onChange={setTemplateId}
          clearable
          searchable
          size="xs"
          maw={400}
        />
      )}
      <SOAPNotes
        key={consultation?.updated_at ?? templateId ?? "default"}
        onSubmit={handleSubmit}
        defaultValues={consultation ?? templateDefaults}
        editorDefaultValues={templateDefaults}
        historyNotes={consultationHistory}
        isHistoryLoading={loadingConsultationHistory}
        submitLabel="Save Note"
        isSubmitting={createMutation.isPending}
        readOnly={!canUpdate}
      />
    </Stack>
  );
}

// ── Diagnoses ────────────────────────────────────────────

function DiagnosesTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();

  const { data: diagnoses = [] } = useQuery<Diagnosis[]>({
    queryKey: ["diagnoses", encounterId],
    queryFn: () => opdService.listDiagnoses(encounterId),
  });

  const { data: patientDiagnoses = [] } = useQuery<PatientDiagnosisRow[]>({
    queryKey: ["patient-diagnoses", patientId],
    queryFn: () => opdService.listPatientDiagnoses(patientId),
    staleTime: 120_000,
  });

  const invalidateDiagnosisQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["diagnoses", encounterId] });
    void queryClient.invalidateQueries({ queryKey: ["patient-diagnoses", patientId] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateDiagnosisRequest) => opdService.createDiagnosis(encounterId, data),
    onSuccess: invalidateDiagnosisQueries,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      diagnosisEncounterId,
      diagnosisId,
      data,
    }: {
      diagnosisEncounterId: string;
      diagnosisId: string;
      data: UpdateDiagnosisRequest;
    }) => opdService.updateDiagnosis(diagnosisEncounterId, diagnosisId, data),
    onSuccess: invalidateDiagnosisQueries,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => opdService.deleteDiagnosis(encounterId, id),
    onSuccess: invalidateDiagnosisQueries,
  });

  return (
    <DiagnosisPanel
      encounterId={encounterId}
      diagnoses={diagnoses}
      patientDiagnoses={patientDiagnoses}
      canCreate={canUpdate}
      canUpdate={canUpdate}
      canDelete={canUpdate}
      onAdd={(data) => createMutation.mutate(data)}
      onUpdate={(diagnosisEncounterId, diagnosisId, data) =>
        updateMutation.mutate({ diagnosisEncounterId, diagnosisId, data })
      }
      onDelete={(id) => deleteMutation.mutate(id)}
      isAdding={createMutation.isPending}
      isUpdating={updateMutation.isPending}
    />
  );
}

// ── Investigations ───────────────────────────────────────

const LAB_STATUS_COLORS: Record<string, BadgeTone> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "warning",
  completed: "success",
  verified: "success",
  cancelled: "danger",
};

const LAB_RESULT_FLAG_COLORS: Record<string, BadgeTone> = {
  normal: "success",
  low: "warning",
  high: "warning",
  critical_low: "danger",
  critical_high: "danger",
  abnormal: "warning",
};

const STATUS_COLOR_TO_BADGE_TONE: Record<string, BadgeTone> = {
  slate: "neutral",
  gray: "neutral",
  green: "success",
  teal: "success",
  success: "success",
  yellow: "warning",
  orange: "warning",
  warning: "warning",
  red: "danger",
  danger: "danger",
  blue: "info",
  info: "info",
  primary: "primary",
  violet: "accent",
  grape: "accent",
};

function priorityBadgeTone(color: string | null | undefined): BadgeTone {
  return (color ? STATUS_COLOR_TO_BADGE_TONE[color] : undefined) ?? "neutral";
}

function InvestigationsTab({
  encounterId,
  patientId,
  canUpdate,
}: {
  encounterId: string;
  patientId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [labDupeWarning, setLabDupeWarning] = useState<DuplicateOrderInfo[]>([]);
  const [selectedLabReportId, setSelectedLabReportId] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<OpdLabOrderFormInput>({
    resolver: zodResolver(opdLabOrderFormSchema),
    defaultValues: DEFAULT_OPD_LAB_ORDER_FORM_VALUES,
    mode: "onTouched",
  });
  const selectedTestId = watch("test_id");

  const { data: catalog = [] } = useQuery<LabTestCatalog[]>({
    queryKey: ["lab-catalog"],
    queryFn: () => opdService.listLabCatalog(),
  });

  const { data: ordersResponse } = useQuery<LabOrderListResponse>({
    queryKey: ["lab-orders", encounterId],
    queryFn: () => opdService.listLabOrders({ encounter_id: encounterId }),
  });
  const orders = ordersResponse?.orders ?? [];

  const { data: patientLabOrders = [] } = useQuery<PatientLabOrderRow[]>({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => opdService.listPatientLabOrders(patientId),
  });

  const { data: imagingStudies = [] } = useQuery<RadiologyDicomStudy[]>({
    queryKey: ["patient-dicom-studies", patientId],
    queryFn: () => opdService.getPriorRadiologyDicomStudies(patientId),
  });

  const { data: selectedLabReport, isLoading: selectedLabReportLoading } = useQuery({
    queryKey: ["lab-order-detail", selectedLabReportId],
    queryFn: () => opdService.getLabOrder(selectedLabReportId ?? ""),
    enabled: selectedLabReportId !== null,
  });

  const recentLabReports = patientLabOrders
    .filter((order) => (order.result_count ?? 0) > 0 || order.status === "verified")
    .slice(0, 5);

  const recentImagingStudies = imagingStudies.slice(0, 5);

  const testOptions = catalog
    .filter((test) => test.is_active)
    .map((test) => ({
      value: test.id,
      label: `${test.code} — ${test.name}${test.sample_type ? ` (${test.sample_type})` : ""}`,
    }));

  const createMutation = useMutation({
    mutationFn: opdService.createLabOrder,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      toast.success("Lab order placed successfully", { title: "Investigation ordered" });
      emit("order.created", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        order_type: "lab",
        patient_id: result.patient_id,
        priority: result.priority,
        test_id: result.test_id,
      });
      reset(DEFAULT_OPD_LAB_ORDER_FORM_VALUES);
      setLabDupeWarning([]);
      formHandlers.close();
    },
    onError: () => {
      toast.error("Failed to place lab order", { title: "Error" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => opdService.cancelLabOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      toast.warning("Lab order has been cancelled", { title: "Order cancelled" });
    },
  });

  const handleOrder = handleSubmit((values) => {
    createMutation.mutate(toCreateLabOrderRequest(values, patientId, encounterId));
  });

  const getTestName = (testId: string) => {
    const test = catalog.find((t: LabTestCatalog) => t.id === testId);
    return test ? `${test.code} — ${test.name}` : testId;
  };

  return (
    <Stack>
      {canUpdate && !formOpened && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
            Order Investigation
          </Button>
        </Group>
      )}

      {formOpened && (
        <Card padding="sm" radius="md" withBorder>
          <Stack gap="xs">
            <Controller
              control={control}
              name="test_id"
              render={({ field }) => (
                <Select
                  label="Lab Test"
                  placeholder="Search tests..."
                  data={testOptions}
                  value={field.value}
                  onChange={async (testId) => {
                    field.onChange(testId);
                    setLabDupeWarning([]);
                    if (testId) {
                      try {
                        const dupes = await opdService.checkDuplicateOrders({
                          patient_id: patientId,
                          test_id: testId,
                        });
                        if (dupes.length > 0) setLabDupeWarning(dupes);
                      } catch {
                        /* ignore */
                      }
                    }
                  }}
                  searchable
                  nothingFoundMessage="No tests found"
                  error={errors.test_id?.message}
                  required
                />
              )}
            />
            {labDupeWarning.length > 0 && (
              <Alert
                icon={<IconAlertTriangle size={14} />}
                tone="warning"
                title="Duplicate Warning"
              >
                <Text size="xs">
                  This test was already ordered {labDupeWarning.length} time(s) in the last 24
                  hours. ({labDupeWarning.map((d) => d.status).join(", ")})
                </Text>
              </Alert>
            )}
            <Group gap="xs" grow>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select
                    label="Priority"
                    data={OPD_LAB_PRIORITY_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.priority?.message}
                  />
                )}
              />
            </Group>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <Textarea
                  label="Clinical Notes"
                  placeholder="Reason for investigation, clinical context..."
                  value={field.value}
                  onChange={field.onChange}
                  autosize
                  minRows={2}
                  maxRows={4}
                />
              )}
            />
            <Group justify="flex-end" gap="xs">
              <Button
                tone="ghost"
                size="sm"
                onClick={() => {
                  formHandlers.close();
                  reset(DEFAULT_OPD_LAB_ORDER_FORM_VALUES);
                }}
              >
                Cancel
              </Button>
              <Button
                tone="primary"
                size="sm"
                leftSection={<IconFlask size={14} />}
                onClick={handleOrder}
                loading={createMutation.isPending}
                disabled={!selectedTestId}
              >
                Place Order
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Text fw={600}>Reports & Imaging</Text>
            <Text size="xs" c="dimmed">
              Doctor view for completed lab reports and X-ray/CT/MRI prior imaging.
            </Text>
          </div>
          <Badge tone="primary">Patient history</Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Card padding="xs" radius="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Lab Reports
                </Text>
                <Badge size="xs" tone="info">
                  {recentLabReports.length}
                </Badge>
              </Group>
              {recentLabReports.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Tbody>
                    {recentLabReports.map((report) => (
                      <Table.Tr key={report.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {report.test_name ?? "Lab test"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {new Date(report.updated_at).toLocaleString()} ·{" "}
                            {report.result_count ?? 0} result(s)
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" tone={LAB_STATUS_COLORS[report.status] ?? "neutral"}>
                            {report.status.replace(/_/g, " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            tone="secondary"
                            size="xs"
                            leftSection={<IconEye size={14} />}
                            onClick={() => setSelectedLabReportId(report.id)}
                          >
                            View
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="sm" c="dimmed">
                  No completed lab reports yet.
                </Text>
              )}
            </Stack>
          </Card>

          <Card padding="xs" radius="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Imaging
                </Text>
                <Badge size="xs" tone="accent">
                  {recentImagingStudies.length}
                </Badge>
              </Group>
              {recentImagingStudies.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Tbody>
                    {recentImagingStudies.map((study) => (
                      <Table.Tr key={study.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Badge size="xs">{study.modality}</Badge>
                            <div>
                              <Text size="sm" fw={500}>
                                {study.study_description ?? "Imaging study"}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {study.study_date
                                  ? new Date(study.study_date).toLocaleDateString()
                                  : "No date"}{" "}
                                · {study.series_count} series / {study.instance_count} images
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap" justify="flex-end">
                            {study.viewer_url ? (
                              <Button
                                tone="secondary"
                                component="a"
                                href={study.viewer_url}
                                target="_blank"
                                rel="noreferrer"
                                size="xs"
                                leftSection={<IconEye size={14} />}
                              >
                                Viewer
                              </Button>
                            ) : null}
                            {study.pacs_url ? (
                              <Button
                                tone="ghost"
                                component="a"
                                href={study.pacs_url}
                                target="_blank"
                                rel="noreferrer"
                                size="xs"
                              >
                                DICOM
                              </Button>
                            ) : null}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="sm" c="dimmed">
                  No X-ray, CT, MRI or ultrasound studies linked yet.
                </Text>
              )}
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>

      {orders.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Test</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order: LabOrder) => (
              <Table.Tr key={order.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {getTestName(order.test_id)}
                  </Text>
                  {order.notes && (
                    <Text size="xs" c="dimmed">
                      {order.notes}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" tone={priorityBadgeTone(statusColor(order.priority))}>
                    {order.priority.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" tone={LAB_STATUS_COLORS[order.status] ?? "neutral"}>
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {new Date(order.created_at).toLocaleString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {canUpdate &&
                    (order.status === "ordered" || order.status === "sample_collected") && (
                      <Tooltip label="Cancel order">
                        <IconButton
                          tone="danger"
                          size="xs"
                          onClick={() => cancelMutation.mutate(order.id)}
                          loading={cancelMutation.isPending}
                          aria-label="Cancel order"
                        >
                          <IconX size={12} />
                        </IconButton>
                      </Tooltip>
                    )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {!formOpened && orders.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No investigations ordered yet.
        </Text>
      )}

      <Modal
        opened={selectedLabReportId !== null}
        onClose={() => setSelectedLabReportId(null)}
        title="Lab Report"
        size="lg"
      >
        {selectedLabReportLoading ? (
          <Loader size="sm" />
        ) : selectedLabReport?.results.length ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Parameter</Table.Th>
                <Table.Th>Result</Table.Th>
                <Table.Th>Range</Table.Th>
                <Table.Th>Flag</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {selectedLabReport.results.map((result: LabResult) => (
                <Table.Tr key={result.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {result.parameter_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {result.value}
                      {result.unit ? ` ${result.unit}` : ""}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {result.normal_range ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {result.flag ? (
                      <Badge size="xs" tone={LAB_RESULT_FLAG_COLORS[result.flag] ?? "neutral"}>
                        {result.flag.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            No structured result values are available for this report.
          </Text>
        )}
      </Modal>
    </Stack>
  );
}

// ── Follow-up Scheduling ─────────────────────────────────

function FollowUpTab({
  patientId,
  doctorId,
  departmentId,
  canUpdate,
}: {
  patientId: string;
  doctorId: string | null;
  departmentId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [booked, setBooked] = useState(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OpdFollowUpAppointmentFormInput>({
    resolver: zodResolver(opdFollowUpAppointmentFormSchema),
    defaultValues: DEFAULT_OPD_FOLLOW_UP_FORM_VALUES,
  });

  const selectedDate = watch("appointment_date");
  const selectedSlot = watch("slot");
  const selectedDateValue = selectedDate ?? "";

  // Get available slots when date is set and doctor is known
  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ["available-slots", doctorId, selectedDateValue],
    queryFn: () =>
      doctorId ? opdService.getAvailableSlots(doctorId, selectedDateValue) : Promise.resolve([]),
    enabled: Boolean(doctorId) && Boolean(selectedDateValue),
  });

  const availableSlots = slots.filter((s: AvailableSlot) => s.is_available);
  const slotOptions = availableSlots.map((s: AvailableSlot) => ({
    value: `${s.start_time}|${s.end_time}`,
    label: `${s.start_time} – ${s.end_time} (${s.max_patients - s.booked_count} available)`,
  }));

  const bookMutation = useMutation({
    mutationFn: (data: BookAppointmentRequest) => opdService.bookAppointment(data),
    onSuccess: (appointment) => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      toast.success(`Appointment booked for ${appointment.appointment_date}`, {
        title: "Follow-up scheduled",
      });
      emit("opd.followup.scheduled", {
        appointment_date: appointment.appointment_date,
        appointment_id: appointment.id,
        department_id: appointment.department_id,
        doctor_id: appointment.doctor_id,
        patient_id: appointment.patient_id,
        source_record_id: appointment.id,
      });
      reset(DEFAULT_OPD_FOLLOW_UP_FORM_VALUES);
      setBooked(true);
    },
    onError: () => {
      toast.error("Failed to book follow-up", { title: "Error" });
    },
  });

  const handleBook = (values: OpdFollowUpAppointmentFormInput) => {
    if (!doctorId) return;
    bookMutation.mutate(
      toBookFollowUpAppointmentRequest(values, patientId, doctorId, departmentId),
    );
  };

  // Calculate min date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = toDateString(tomorrow);

  if (!doctorId) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No doctor assigned to this encounter. Assign a doctor to enable follow-up scheduling.
      </Text>
    );
  }

  if (booked) {
    return (
      <Card padding="md" radius="md" withBorder>
        <Stack align="center" gap="sm" py="md">
          <IconCheck size={40} color="var(--mantine-color-green-6)" />
          <Text fw={600} size="lg">
            Follow-up Scheduled
          </Text>
          <Text size="sm" c="dimmed">
            Appointment was added to the appointment list and OPD handoff panel.
          </Text>
          <Button
            tone="ghost"
            size="sm"
            onClick={() => {
              setBooked(false);
              reset(DEFAULT_OPD_FOLLOW_UP_FORM_VALUES);
            }}
          >
            Schedule Another
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack>
      {canUpdate ? (
        <Card
          component="form"
          onSubmit={handleSubmit(handleBook)}
          padding="sm"
          radius="md"
          withBorder
        >
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              Schedule Follow-up Appointment
            </Text>
            <Controller
              control={control}
              name="appointment_date"
              render={({ field }) => (
                <TextInput
                  label="Follow-up Date"
                  type="date"
                  value={field.value ?? ""}
                  onChange={(event) => {
                    field.onChange(event.currentTarget.value);
                    setValue("slot", null, { shouldValidate: true });
                  }}
                  min={minDate}
                  error={errors.appointment_date?.message}
                  required
                />
              )}
            />
            {selectedDate &&
              (loadingSlots ? (
                <Text size="sm" c="dimmed">
                  Loading available slots...
                </Text>
              ) : slotOptions.length > 0 ? (
                <Controller
                  control={control}
                  name="slot"
                  render={({ field }) => (
                    <Select
                      label="Available Slot"
                      placeholder="Select a time slot"
                      data={slotOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.slot?.message}
                      required
                    />
                  )}
                />
              ) : (
                <Text size="sm" c="orange">
                  No available slots on this date. Try a different date.
                </Text>
              ))}
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <Textarea
                  label="Reason for Follow-up"
                  placeholder="Post-op review, lab result review, medication adjustment..."
                  autosize
                  minRows={2}
                  maxRows={3}
                  {...field}
                />
              )}
            />
            <Group justify="flex-end">
              <Button
                tone="primary"
                type="submit"
                size="sm"
                leftSection={<IconCalendarPlus size={14} />}
                loading={bookMutation.isPending}
                disabled={!selectedDate || !selectedSlot}
              >
                Book Follow-up
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          You do not have permission to schedule follow-up appointments.
        </Text>
      )}
    </Stack>
  );
}

// ── Prescriptions ────────────────────────────────────────

function PrescriptionsTab({
  encounterId,
  patientId,
  patientName,
  uhid,
  canUpdate,
  allergies = [],
}: {
  encounterId: string;
  patientId: string;
  patientName: string;
  uhid: string;
  canUpdate: boolean;
  allergies?: string[];
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [printRx, setPrintRx] = useState<PrescriptionWithItems | null>(null);

  const { data: prescriptions = [] } = useQuery({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => opdService.listPrescriptions(encounterId),
  });

  const { data: hospitalSettings = [] } = useQuery({
    queryKey: ["tenant-settings", "general"],
    queryFn: () => opdService.getTenantSettings("general"),
    staleTime: 600_000,
  });

  const getSetting = (key: string) => {
    const row = hospitalSettings.find((s) => s.key === key);
    return row ? String(row.value) : undefined;
  };

  const createMutation = useMutation({
    mutationFn: (data: CreatePrescriptionRequest) =>
      opdService.createPrescription(encounterId, data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      emit("order.created", {
        encounter_id: result.prescription.encounter_id,
        item_count: variables.items.length,
        items: result.items.map((item) => ({
          catalog_item_id: item.catalog_item_id,
          drug_name: item.drug_name,
          item_id: item.id,
        })),
        order_id: result.prescription.id,
        order_type: "prescription",
        patient_id: patientId,
        prescription_id: result.prescription.id,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      prescriptionId,
      data,
    }: {
      prescriptionId: string;
      data: UpdatePrescriptionRequest;
    }) => opdService.updatePrescription(prescriptionId, data),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      emit("opd.prescription.updated", {
        encounter_id: result.prescription.encounter_id,
        item_count: variables.data.items.length,
        patient_id: patientId,
        prescription_id: variables.prescriptionId,
        source_record_id: variables.prescriptionId,
      });
      toast.success("Pharmacy review and billing will use the revised prescription", {
        title: "Prescription updated",
      });
    },
  });

  return (
    <>
      <PrescriptionWriter
        encounterId={encounterId}
        patientId={patientId}
        prescriptions={prescriptions as PrescriptionWithItems[]}
        canUpdate={canUpdate}
        onSave={(data) => createMutation.mutate(data)}
        onUpdate={(prescriptionId, data) => updateMutation.mutate({ prescriptionId, data })}
        isSaving={createMutation.isPending}
        isUpdating={updateMutation.isPending}
        onPrint={(rx) => setPrintRx(rx)}
      />
      {/* 4-view prescription display — Prose, Timeline, Dose Calc, Rules */}
      {(prescriptions as PrescriptionWithItems[]).length > 0 && (
        <PrescriptionViews
          prescriptions={prescriptions as PrescriptionWithItems[]}
          patientName={patientName}
          uhid={uhid}
          allergies={allergies}
        />
      )}
      {printRx && (
        <PrescriptionPrint
          opened={Boolean(printRx)}
          onClose={() => setPrintRx(null)}
          prescription={printRx}
          patientName={patientName}
          uhid={uhid}
          hospitalName={getSetting("hospital_name")}
          hospitalAddress={getSetting("hospital_address")}
          hospitalPhone={getSetting("hospital_phone")}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Admit to IPD Modal
// ══════════════════════════════════════════════════════════

function AdmitToIpdButton({
  encounterId,
  patientName,
  asMenuItem = false,
}: {
  encounterId: string;
  patientName: string;
  asMenuItem?: boolean;
}) {
  const { t } = useTranslation("opd");
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [wardId, setWardId] = useState<string | null>(null);
  const [bedId, setBedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const emit = useClinicalEmit();

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
  });

  const { data: wards = [] } = useQuery({
    queryKey: ["ipd-wards"],
    queryFn: () => opdService.listWards(),
    enabled: opened,
  });

  const deptOptions = departments.map((d: DepartmentRow) => ({ value: d.id, label: d.name }));
  const wardOptions = (wards as Array<{ id: string; name: string }>).map((w) => ({
    value: w.id,
    label: w.name,
  }));

  const admitMutation = useMutation({
    mutationFn: (data: AdmitFromOpdRequest) => opdService.admitFromOpd(encounterId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      emit("ipd.admission.created", {
        admission_id: result.admission.id,
        patient_id: result.admission.patient_id,
        opd_encounter_id: encounterId,
        encounter_id: result.admission.encounter_id,
        department_id: result.ipd_encounter.department_id,
        ward_id: result.admission.ward_id,
        bed_id: result.admission.bed_id,
        source_record_id: result.admission.id,
      });
      if (result.admission.bed_id) {
        emit("bed.assigned", {
          admission_id: result.admission.id,
          patient_id: result.admission.patient_id,
          opd_encounter_id: encounterId,
          encounter_id: result.admission.encounter_id,
          department_id: result.ipd_encounter.department_id,
          ward_id: result.admission.ward_id,
          bed_id: result.admission.bed_id,
          source_record_id: result.admission.id,
        });
      }
      toast.success(
        t("notify.patientAdmittedToIpdDetail", {
          diagnoses: result.diagnoses_copied,
          patient: patientName,
          prescriptions: result.prescriptions_copied,
          vitals: result.vitals_copied,
        }),
        { title: t("notify.patientAdmittedToIpd") },
      );
      close();
    },
    onError: () => {
      toast.error(t("notify.admissionFailed"), { title: t("notify.error") });
    },
  });

  const handleAdmit = () => {
    if (!deptId) return;
    admitMutation.mutate({
      department_id: deptId,
      ward_id: wardId ?? undefined,
      bed_id: bedId ?? undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <>
      {asMenuItem ? (
        <Menu.Item leftSection={<IconMedicalCross size={14} />} onClick={open}>
          {t("admission.admitToIpd")}
        </Menu.Item>
      ) : (
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconMedicalCross size={14} />}
          onClick={open}
        >
          {t("admission.admitToIpd")}
        </Button>
      )}
      <Modal
        opened={opened}
        onClose={close}
        title={t("admission.modalTitle", { patient: patientName })}
        size="md"
      >
        <Stack gap="sm">
          <Select
            label={t("label.department")}
            placeholder={t("placeholder.selectDepartment")}
            data={deptOptions}
            value={deptId}
            onChange={setDeptId}
            searchable
            required
          />
          <Select
            label={t("label.ward")}
            placeholder={t("placeholder.selectWard(optional)")}
            data={wardOptions}
            value={wardId}
            onChange={(val) => {
              setWardId(val);
              setBedId(null);
            }}
            searchable
            clearable
          />
          <BedSelect
            label={t("label.bed")}
            placeholder={t("placeholder.selectAvailableBed")}
            value={bedId ?? ""}
            onChange={(nextBedId) => setBedId(nextBedId || null)}
            clearable
            enabled={opened}
            wardId={wardId ?? undefined}
          />
          <Textarea
            label={t("label.notes")}
            placeholder={t("placeholder.admissionNotes")}
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              {t("cancel")}
            </Button>
            <Button
              tone="primary"
              onClick={handleAdmit}
              loading={admitMutation.isPending}
              disabled={!deptId}
            >
              {t("admission.admitPatient")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

interface GroupSlotRow {
  id: string;
  doctorId: string;
  departmentId: string;
  date: string;
  slotStart: string;
  slotEnd: string;
  notes: string;
}

type GroupSlotEditableField = Exclude<keyof GroupSlotRow, "id">;

let groupSlotRowSequence = 0;

function createGroupSlotRow(): GroupSlotRow {
  groupSlotRowSequence += 1;
  return {
    id: `group-slot-${groupSlotRowSequence}`,
    doctorId: "",
    departmentId: "",
    date: "",
    slotStart: "",
    slotEnd: "",
    notes: "",
  };
}

function GroupAppointmentModal({
  patientId,
  asMenuItem = false,
}: {
  patientId: string;
  asMenuItem?: boolean;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<GroupSlotRow[]>([createGroupSlotRow(), createGroupSlotRow()]);

  const { data: allDoctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => opdService.listDoctors(),
    staleTime: 600_000,
    enabled: opened,
  });

  const { data: groupDepts = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });

  const doctorOptions = useMemo(
    () =>
      allDoctors.map((u) => ({
        value: u.id,
        label: `${u.full_name}${u.specialization ? ` (${u.specialization})` : ""}`,
      })),
    [allDoctors],
  );

  const groupDeptOptions = useMemo(
    () => (groupDepts as DepartmentRow[]).map((d) => ({ value: d.id, label: d.name })),
    [groupDepts],
  );

  const updateRow = (idx: number, field: GroupSlotEditableField, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createGroupSlotRow()]);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const bookGroupMutation = useMutation({
    mutationFn: (data: BookAppointmentGroupRequest) => opdService.bookAppointmentGroup(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      toast.success(`${result.length} appointments created`, {
        title: "Group appointment booked",
      });
      close();
      setRows([createGroupSlotRow(), createGroupSlotRow()]);
    },
    onError: () => {
      toast.error("Failed to book group appointment", { title: "Error" });
    },
  });

  const canSubmit = rows.every(
    (r) => r.doctorId && r.departmentId && r.date && r.slotStart && r.slotEnd,
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    const slotRequests: BookAppointmentGroupRequest["slot_requests"] = rows.map((r) => ({
      doctor_id: r.doctorId,
      department_id: r.departmentId,
      appointment_date: r.date,
      slot_start: r.slotStart,
      slot_end: r.slotEnd,
      appointment_type: "consultation",
      notes: r.notes.trim() || undefined,
    }));

    bookGroupMutation.mutate({
      patient_id: patientId,
      slot_requests: slotRequests,
    });
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = toDateString(tomorrow);

  return (
    <>
      {asMenuItem ? (
        <Menu.Item leftSection={<IconUsers size={14} />} onClick={open}>
          Group Appointment
        </Menu.Item>
      ) : (
        <Button tone="secondary" size="xs" leftSection={<IconUsers size={14} />} onClick={open}>
          Group Appointment
        </Button>
      )}
      <Modal opened={opened} onClose={close} title="Book Multi-Doctor Appointment" size="lg">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Book appointments with multiple doctors in a single group. The patient will see all
            listed doctors.
          </Text>
          {rows.map((row, idx) => (
            <Card key={row.id} padding="xs" radius="sm" withBorder>
              <Group gap="xs" align="flex-end" wrap="nowrap">
                <Select
                  label={`Doctor ${idx + 1}`}
                  placeholder="Select doctor"
                  data={doctorOptions}
                  value={row.doctorId}
                  onChange={(val) => updateRow(idx, "doctorId", val ?? "")}
                  searchable
                  w={180}
                  size="xs"
                />
                <Select
                  label="Dept"
                  placeholder="Department"
                  data={groupDeptOptions}
                  value={row.departmentId}
                  onChange={(val) => updateRow(idx, "departmentId", val ?? "")}
                  searchable
                  w={150}
                  size="xs"
                />
                <TextInput
                  label="Date"
                  type="date"
                  value={row.date}
                  onChange={(e) => updateRow(idx, "date", e.currentTarget.value)}
                  min={minDate}
                  w={140}
                  size="xs"
                />
                <TextInput
                  label="Start"
                  type="time"
                  value={row.slotStart}
                  onChange={(e) => updateRow(idx, "slotStart", e.currentTarget.value)}
                  w={100}
                  size="xs"
                />
                <TextInput
                  label="End"
                  type="time"
                  value={row.slotEnd}
                  onChange={(e) => updateRow(idx, "slotEnd", e.currentTarget.value)}
                  w={100}
                  size="xs"
                />
                <TextInput
                  label="Notes"
                  placeholder="Optional"
                  value={row.notes}
                  onChange={(e) => updateRow(idx, "notes", e.currentTarget.value)}
                  style={{ flex: 1 }}
                  size="xs"
                />
                {rows.length > 2 && (
                  <IconButton
                    tone="danger"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    mt={18}
                    aria-label="Delete"
                  >
                    <IconTrash size={14} />
                  </IconButton>
                )}
              </Group>
            </Card>
          ))}
          <Button tone="ghost" size="xs" leftSection={<IconPlus size={14} />} onClick={addRow}>
            Add Another Doctor
          </Button>
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              onClick={handleSubmit}
              loading={bookGroupMutation.isPending}
              disabled={!canSubmit}
            >
              Book {rows.length} Appointments
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
