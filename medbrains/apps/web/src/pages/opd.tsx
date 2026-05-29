import { zodResolver } from "@hookform/resolvers/zod";
import { LineChart } from "@mantine/charts";
import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { OpdFollowUpAppointmentFormInput, OpdQueueVisitFormInput } from "@medbrains/schemas";
import {
  opdFeedbackFormSchema,
  opdFollowUpAppointmentFormSchema,
  opdLabOrderFormSchema,
  opdProcedureConsentFormSchema,
  opdProcedureOrderFormSchema,
  opdQueueVisitFormSchema,
  opdReminderFormSchema,
} from "@medbrains/schemas";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type {
  AdmitFromOpdRequest,
  AppointmentWithPatient,
  AvailableBed,
  AvailableSlot,
  BookAppointmentGroupRequest,
  BookAppointmentRequest,
  Camp,
  CertificateType,
  ClinicalJourneyContext,
  Consultation,
  ConsultationTemplate,
  CreateConsultationRequest,
  CreateDiagnosisRequest,
  CreateEncounterResponse,
  CreateMedicalCertificateRequest,
  CreatePreAuthRequest,
  CreatePrescriptionRequest,
  CreateReferralRequest,
  CreateVitalRequest,
  DepartmentRow,
  Diagnosis,
  DoctorDocket,
  DuplicateOrderInfo,
  FamilyHistoryEntry,
  FollowupComplianceRow,
  LabOrder,
  LabOrderListResponse,
  LabResult,
  LabTestCatalog,
  MedicalCertificate,
  PastMedicalEntry,
  PastSurgicalEntry,
  Patient,
  PatientAllergy,
  PatientConsultationHistoryRow,
  PatientDiagnosisRow,
  PatientFeedback,
  PatientLabOrderRow,
  PatientReminder,
  PatientVisitRow,
  PharmacyDispatchStatus as PharmacyDispatchStatusRow,
  PhysicalExamination,
  PreAuthorizationRequest as PreAuthReqType,
  PrescriptionHistoryItem,
  PrescriptionWithItems,
  ProcedureCatalog,
  ProcedureConsent,
  ProcedureOrderWithName,
  QueueEntry,
  RadiologyDicomStudy,
  ReferralUrgency,
  ReferralWithNames,
  ReviewOfSystems as ROSType,
  SocialHistory,
  UpdateConsultationRequest,
  UpdateDiagnosisRequest,
  UpdatePrescriptionRequest,
  Vital,
  VitalHistoryPoint,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendarPlus,
  IconCalendarStats,
  IconCertificate,
  IconChartLine,
  IconCheck,
  IconClipboardList,
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
  IconUser,
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
  DiagnosisPanel,
  DoctorSearchSelect,
  PageHeader,
  PatientSearchSelect,
  PhysicalExamPanel,
  PrescriptionPrint,
  PrescriptionViews,
  PrescriptionWriter,
  ReviewOfSystems,
  SOAPNotes,
  StatusDot,
  StructuredHistory,
  useClinicalEmit,
  VisitSummaryPrint,
  VitalsRecorder,
} from "../components";
import { Icd11CodeSelect } from "../components/Clinical/Icd11CodeSelect";
import { OrderBasketChip } from "../components/OrderBasket/OrderBasketChip";
import {
  type OrderBasketTab,
  OrderBasketWorkspace,
} from "../components/OrderBasket/OrderBasketWorkspace";
import { PatientContextBanner } from "../components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "../components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "../components/Patient/PatientJourneyActions";
import {
  DEFAULT_OPD_CONSENT_FORM_VALUES,
  DEFAULT_OPD_FEEDBACK_FORM_VALUES,
  DEFAULT_OPD_FOLLOW_UP_FORM_VALUES,
  DEFAULT_OPD_LAB_ORDER_FORM_VALUES,
  DEFAULT_OPD_PROCEDURE_ORDER_FORM_VALUES,
  DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
  DEFAULT_OPD_REMINDER_FORM_VALUES,
  OPD_CONSENT_TYPE_OPTIONS,
  OPD_LAB_PRIORITY_OPTIONS,
  OPD_PROCEDURE_PRIORITY_OPTIONS,
  OPD_RATING_OPTIONS,
  OPD_REMINDER_PRIORITY_OPTIONS,
  OPD_REMINDER_TYPE_OPTIONS,
  OPD_VISIT_TYPE_OPTIONS,
  toBookFollowUpAppointmentRequest,
  toCreateConsentRequest,
  toCreateEncounterRequest,
  toCreateFeedbackRequest,
  toCreateLabOrderRequest,
  toCreateProcedureOrderRequest,
  toCreateReminderRequest,
} from "../forms/opd.form";
import { useHashTabs } from "../hooks/useHashTabs";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { useVitalsSource } from "../hooks/useVitalsSource";
import { toDateString, todayDateString } from "../lib/date-utils";
import { campService } from "../services/camp.service";
import { mrdService } from "../services/mrd.service";
import { opdService } from "../services/opd.service";

const statusColors: Record<string, string> = {
  waiting: "primary",
  called: "warning",
  in_consultation: "orange",
  completed: "success",
  no_show: "danger",
};

const appointmentStatusColors: Record<string, string> = {
  scheduled: "gray",
  confirmed: "primary",
  checked_in: "warning",
  in_consultation: "orange",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
};

const appointmentStatusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "In OPD",
  in_consultation: "Consulting",
  completed: "Carried out",
  cancelled: "Cancelled",
  no_show: "No show",
};

const OPD_ENCOUNTER_TAB_VALUES = [
  "vitals",
  "consultation",
  "history",
  "ros",
  "physical-exam",
  "diagnoses",
  "investigations",
  "procedures",
  "prescriptions",
  "referrals",
  "rx-history",
  "charts",
  "timeline",
  "certificates",
  "followup",
  "reminders",
  "feedback",
  "consents",
  "pre-auth",
  "docket",
  "pharmacy-dispatch",
] as const;

const appointmentTypeLabels: Record<string, string> = {
  new_visit: "Booked",
  follow_up: "Follow-up",
  consultation: "Consultation",
  procedure: "Procedure",
  walk_in: "Walk-in",
};

const queueVisitTypeLabels: Record<string, string> = {
  walk_in: "Walk-in",
  booked: "Booked",
  follow_up: "Follow-up",
  referral: "Referral",
  emergency: "Emergency",
  camp: "Camp",
};

const queueVisitTypeColors: Record<string, string> = {
  walk_in: "gray",
  booked: "primary",
  follow_up: "teal",
  referral: "orange",
  emergency: "danger",
  camp: "success",
};

function todayIsoDate(): string {
  return todayDateString();
}

function appointmentVisitType(appointmentType: AppointmentWithPatient["appointment_type"]): string {
  return appointmentType === "follow_up" ? "follow_up" : "booked";
}

function appointmentSlotLabel(appointment: {
  appointment_date?: string | null;
  slot_start?: string | null;
  slot_end?: string | null;
  appointment_slot_start?: string | null;
  appointment_slot_end?: string | null;
}): string {
  const start = appointment.slot_start ?? appointment.appointment_slot_start;
  const end = appointment.slot_end ?? appointment.appointment_slot_end;
  return start && end ? `${start} - ${end}` : (appointment.appointment_date ?? "No slot");
}

const referralUrgencyValues = [
  "routine",
  "urgent",
  "emergency",
] as const satisfies readonly ReferralUrgency[];

function toReferralUrgency(value: string | null): ReferralUrgency | undefined {
  return referralUrgencyValues.find((candidate) => candidate === value);
}

function toCreateConsultationPayload(data: UpdateConsultationRequest): CreateConsultationRequest {
  const { snomed_codes: _snomedCodes, ...payload } = data;
  return payload;
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
        <Button variant="light" onClick={() => navigate("/opd")}>
          Back to OPD queue
        </Button>
      </Stack>
    );
  }

  const patientName = formatPatientName(patient);

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode={`opd-encounter-${encounter.id}`}>
      <Stack gap="sm" h="calc(100vh - 112px)">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={700}>
              OPD Visit - {patientName}
            </Text>
            <Text size="sm" c="dimmed">
              UHID: {patient.uhid} | {encounter.status.replace(/_/g, " ")}
            </Text>
          </div>
          <Button
            variant="subtle"
            size="sm"
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
            patientName={patientName}
            uhid={patient.uhid}
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
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      notifications.show({
        title: "Visit created",
        message: "Patient added to queue",
        color: "success",
      });
      emit("opd.encounter.created", {
        encounter_id: result.encounter.id,
        patient_id: variables.patient_id,
        department_id: variables.department_id ?? "",
      });
      reset({
        ...DEFAULT_OPD_QUEUE_VISIT_FORM_VALUES,
        patient_id: initialPatientId,
      });
      onCreated(result);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create visit", color: "danger" });
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
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
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
            <Button variant="subtle" onClick={() => navigate("/opd")}>
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

  const navigate = useNavigate();
  const { queueEntryId } = useParams<{ queueEntryId: string }>();
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const canRecordNurseVitals = useHasPermission(P.NURSE.VITALS_RECORD);
  const canRecordVitals = canRecordNurseVitals || canUpdate;
  const requestedQueueEntryId = queueEntryId ?? "";

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["opd-queue", "vitals-route"],
    queryFn: () => opdService.listQueue(),
    enabled: requestedQueueEntryId.length > 0,
  });
  const entry = queue.find((row) => row.id === requestedQueueEntryId);

  const vitalsMutation = useMutation({
    mutationFn: (data: CreateVitalRequest) => {
      if (!entry) {
        throw new Error("OPD queue entry was not loaded");
      }
      return canRecordNurseVitals
        ? opdService.createNurseVital({ ...data, encounter_id: entry.encounter_id })
        : opdService.createVital(entry.encounter_id, data);
    },
    onSuccess: () => {
      if (!entry) return;
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["vitals", entry.encounter_id] });
      void queryClient.invalidateQueries({
        queryKey: ["patient-vitals-history", entry.patient_id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["patient-vitals-history", entry.patient_id, "timeline"],
      });
      emit("vitals.recorded", {
        encounter_id: entry.encounter_id,
        patient_id: entry.patient_id,
      });
      notifications.show({
        title: "Vitals recorded",
        message: `${entry.patient_name ?? "Patient"} vitals were saved`,
        color: "success",
      });
      navigate("/opd");
    },
    onError: () => {
      notifications.show({
        title: "Unable to record vitals",
        message: "Check vitals permission and try again.",
        color: "danger",
      });
    },
  });

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading queue entry...</Text>
      </Stack>
    );
  }

  if (!entry) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">OPD queue entry not found for today.</Text>
        <Button variant="light" onClick={() => navigate("/opd")}>
          Back to OPD
        </Button>
      </Stack>
    );
  }

  const vitalsAllowed = canRecordVitals && canRecordVitalsFromQueue(entry);

  return (
    <ClinicalEventProvider moduleCode="opd" contextCode={`opd-vitals-${entry.id}`}>
      <Stack>
        <PageHeader
          title="Record OPD vitals"
          subtitle={`${entry.patient_name ?? "Patient"} | Token T${String(entry.token_number).padStart(3, "0")}`}
          icon={<IconHeartbeat size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button variant="subtle" onClick={() => navigate("/opd")}>
              Back to OPD
            </Button>
          }
        />
        <Card withBorder p="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>{entry.patient_name ?? "Patient"}</Text>
              <Text size="xs" c="dimmed">
                {entry.uhid ?? "Masked"} | Token T{String(entry.token_number).padStart(3, "0")}
              </Text>
            </Stack>
            <Badge variant="light" color={statusColors[entry.status] ?? "slate"}>
              {entry.status.replace(/_/g, " ")}
            </Badge>
          </Group>
        </Card>
        {!vitalsAllowed ? (
          <Alert color="warning" icon={<IconAlertTriangle size={16} />}>
            Vitals can be recorded only for waiting, called, or in-consultation queue entries by
            staff with vitals permission.
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

const CLINICAL_DRAWER_QUEUE_STATUSES = new Set(["called", "in_consultation", "completed"]);
const VITALS_QUEUE_STATUSES = new Set(["waiting", "called", "in_consultation"]);

function canOpenClinicalDrawer(row: QueueEntry): boolean {
  return CLINICAL_DRAWER_QUEUE_STATUSES.has(row.status);
}

function canRecordVitalsFromQueue(row: QueueEntry): boolean {
  return VITALS_QUEUE_STATUSES.has(row.status);
}

function OpdPageInner() {
  const { t } = useTranslation("opd");
  const emit = useClinicalEmit();
  const navigate = useNavigate();
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canManageToken = useHasPermission(P.OPD.TOKEN_MANAGE);
  const canUpdate = useHasPermission(P.OPD.VISIT_UPDATE);
  const canRecordNurseVitals = useHasPermission(P.NURSE.VITALS_RECORD);
  const canRecordVitals = canRecordNurseVitals || canUpdate;
  const currentUser = useAuthStore((s) => s.user);

  const queryClient = useQueryClient();
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string | null>(null);
  const [filterDoctorId, setFilterDoctorId] = useState<string | null>(null);
  const [queueVisitTypeTab, setQueueVisitTypeTab] = useState<string | null>("all");
  const [myPatientsOnly, setMyPatientsOnly] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [debouncedQueueSearch] = useDebouncedValue(queueSearch.trim(), 250);

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
    onSuccess: (_result, appointment) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      notifications.show({
        title: "Appointment moved to OPD",
        message: `${appointment.patient_name} added to the OPD queue`,
        color: "success",
      });
      emit("appointment.checked_in_to_opd", {
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
      });
    },
    onError: () => {
      notifications.show({
        title: "Unable to move appointment",
        message: "Check whether this appointment is already closed or linked to OPD",
        color: "danger",
      });
    },
  });

  const callMutation = useMutation({
    mutationFn: (id: string) => opdService.callQueueEntry(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("patient.called", { queue_entry_id: id });
    },
  });
  const startMutation = useMutation({
    mutationFn: (id: string) => opdService.startConsultation(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("consultation.started", { queue_entry_id: id });
    },
  });
  const completeMutation = useMutation({
    mutationFn: (id: string) => opdService.completeQueueEntry(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
      emit("encounter.completed", { queue_entry_id: id });
    },
  });
  const noShowMutation = useMutation({
    mutationFn: (id: string) => opdService.markNoShow(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["opd-appointments"] });
    },
  });
  const columns = [
    {
      key: "token_number",
      label: "Token",
      render: (row: QueueEntry) => (
        <Text fw={700}>T{String(row.token_number).padStart(3, "0")}</Text>
      ),
    },
    {
      key: "patient_name",
      label: "Patient",
      fieldAccessKeys: ["patients.uhid", "patients.first_name", "patients.last_name"],
      accessor: (row: QueueEntry) => row.patient_name ?? row.uhid,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (row: QueueEntry) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {row.uhid}
          </Text>
        </Stack>
      ),
    },
    {
      key: "visit_type",
      label: "Visit",
      render: (row: QueueEntry) => <QueueVisitTypeBadge row={row} />,
    },
    {
      key: "status",
      label: "Status",
      render: (row: QueueEntry) => (
        <StatusDot
          color={statusColors[row.status] ?? "slate"}
          label={row.status.replace(/_/g, " ")}
        />
      ),
    },
    {
      key: "appointment",
      label: "Appointment",
      render: (row: QueueEntry) => <QueueAppointmentMarker row={row} />,
    },
    {
      key: "queue_date",
      label: "Date",
      render: (row: QueueEntry) => <Text size="sm">{row.queue_date}</Text>,
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [P.OPD.QUEUE_VIEW, P.OPD.VISIT_UPDATE, P.OPD.VITALS.CREATE],
      permissionMode: "any",
      render: (row: QueueEntry) => (
        <Group gap="xs">
          {canRecordVitals && canRecordVitalsFromQueue(row) && (
            <Tooltip label="Record vitals">
              <ActionIcon
                variant="subtle"
                color="primary"
                onClick={() => navigate(`/opd/queue/${row.id}/vitals`)}
                aria-label="Record vitals"
              >
                <IconHeartbeat size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip
            label={
              canOpenClinicalDrawer(row)
                ? "Open OPD visit"
                : "Call patient before opening OPD visit"
            }
          >
            <ActionIcon
              variant="subtle"
              disabled={!canOpenClinicalDrawer(row)}
              onClick={() => {
                if (canOpenClinicalDrawer(row)) {
                  navigate(`/opd/encounters/${row.encounter_id}#consultation`);
                }
              }}
              aria-label="Open OPD visit"
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canManageToken && row.status === "waiting" && (
            <Tooltip label="Call patient">
              <ActionIcon
                variant="subtle"
                color="warning"
                onClick={() => callMutation.mutate(row.id)}
              >
                <IconPhone size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canManageToken && row.status === "called" && (
            <Tooltip label="Start consultation">
              <ActionIcon
                variant="subtle"
                color="orange"
                onClick={() => startMutation.mutate(row.id)}
              >
                <IconPlayerPlay size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canManageToken && row.status === "in_consultation" && (
            <Tooltip label="Complete">
              <ActionIcon
                variant="subtle"
                color="success"
                onClick={() => completeMutation.mutate(row.id)}
              >
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canManageToken && (row.status === "waiting" || row.status === "called") && (
            <Tooltip label="No show">
              <ActionIcon
                variant="subtle"
                color="danger"
                onClick={() => noShowMutation.mutate(row.id)}
              >
                <IconUserOff size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ] satisfies Column<QueueEntry>[];

  return (
    <div>
      <PageHeader
        title={t("title.opd")}
        subtitle={t("subtitle.outpatientDepartmentQueue")}
        icon={<IconStethoscope size={20} stroke={1.5} />}
        color="primary"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => navigate("/opd/new")}>
              New Visit
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
                placeholder="Search token, patient, UHID, phone"
                leftSection={<IconSearch size={16} />}
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.currentTarget.value)}
                w={280}
              />
              <TextInput
                placeholder="Date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.currentTarget.value)}
                w={170}
              />
              <Select
                placeholder="Status"
                data={[
                  { value: "waiting", label: "Waiting" },
                  { value: "called", label: "Called" },
                  { value: "in_consultation", label: "In Consultation" },
                  { value: "completed", label: "Completed" },
                  { value: "no_show", label: "No Show" },
                ]}
                value={filterStatus}
                onChange={setFilterStatus}
                clearable
                w={170}
              />
              <Select
                placeholder="Department"
                data={deptOptions}
                value={filterDeptId}
                onChange={setFilterDeptId}
                clearable
                searchable
                w={200}
              />
              <div style={{ width: 240 }}>
                <DoctorSearchSelect
                  label="Doctor"
                  placeholder="Filter doctor"
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
                label="My Patients"
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
            onCheckIn={(appointment) => appointmentCheckInMutation.mutate(appointment)}
          />
          <Tabs value={queueVisitTypeTab} onChange={setQueueVisitTypeTab} mb="xs">
            <Tabs.List>
              <Tabs.Tab value="all">All</Tabs.Tab>
              <Tabs.Tab value="walk_in">Walk-in</Tabs.Tab>
              <Tabs.Tab value="booked">Appointments</Tabs.Tab>
              <Tabs.Tab value="follow_up">Follow-up</Tabs.Tab>
              <Tabs.Tab value="referral">Referral</Tabs.Tab>
              <Tabs.Tab value="emergency">Emergency</Tabs.Tab>
              <Tabs.Tab value="camp">Camp</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <DataTable
            columns={columns}
            data={queue}
            loading={isLoading}
            rowKey={(row) => row.id}
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

function QueueAppointmentMarker({ row }: { row: QueueEntry }) {
  if (!row.appointment_id) {
    return (
      <Badge size="sm" variant="light" color="gray">
        Walk-in
      </Badge>
    );
  }

  const typeLabel = appointmentTypeLabels[row.appointment_type ?? "new_visit"] ?? "Appointment";
  const status = row.appointment_status ?? row.status;
  const statusLabel = appointmentStatusLabels[status] ?? status.replace(/_/g, " ");

  return (
    <Stack gap={2}>
      <Group gap={4}>
        <Badge size="sm" variant="light" color="primary">
          {typeLabel}
        </Badge>
        <Badge size="sm" color={appointmentStatusColors[status] ?? "gray"}>
          {statusLabel}
        </Badge>
      </Group>
      <Text size="xs" c="dimmed">
        {appointmentSlotLabel(row)}
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
  const visitType = row.visit_type ?? (row.appointment_id ? "booked" : "walk_in");
  return (
    <Stack gap={2}>
      <Badge size="sm" variant="light" color={queueVisitTypeColors[visitType] ?? "gray"}>
        {queueVisitTypeLabels[visitType] ?? visitType.replace(/_/g, " ")}
      </Badge>
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
  onCheckIn,
}: {
  appointments: AppointmentWithPatient[];
  appointmentDate: string;
  loading: boolean;
  canCheckIn: boolean;
  checkingInId?: string;
  isCheckingIn: boolean;
  onCheckIn: (appointment: AppointmentWithPatient) => void;
}) {
  const today = todayIsoDate();

  return (
    <Card withBorder mb="md" p="sm">
      <Group justify="space-between" mb="xs">
        <div>
          <Text fw={600} size="sm">
            Booked and follow-up appointments
          </Text>
          <Text size="xs" c="dimmed">
            {appointmentDate} - move time-based appointments into OPD from here
          </Text>
        </div>
        <Badge variant="light" color="primary">
          {appointments.length}
        </Badge>
      </Group>

      {loading ? (
        <Group py="md" justify="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading appointments
          </Text>
        </Group>
      ) : appointments.length === 0 ? (
        <Text size="sm" c="dimmed" py="xs">
          No booked or follow-up appointments for this date.
        </Text>
      ) : (
        <Table verticalSpacing="xs" withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Patient</Table.Th>
              <Table.Th>Doctor</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
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
              const statusLabel =
                appointmentStatusLabels[appointment.status] ??
                appointment.status.replace(/_/g, " ");
              return (
                <Table.Tr key={appointment.id}>
                  <Table.Td>
                    <Text size="sm">{appointmentSlotLabel(appointment)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {appointment.patient_name}
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
                    <Badge size="sm" variant="light" color="primary">
                      {appointmentTypeLabels[appointment.appointment_type] ??
                        appointment.appointment_type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={appointmentStatusColors[appointment.status] ?? "gray"}>
                      {statusLabel}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {appointment.status === "completed" ? (
                      <Badge size="sm" color="success">
                        Carried out
                      </Badge>
                    ) : appointment.encounter_id ? (
                      <Badge size="sm" variant="light" color="warning">
                        In OPD
                      </Badge>
                    ) : isFutureAppointment ? (
                      <Badge size="sm" variant="light" color="gray">
                        Future slot
                      </Badge>
                    ) : (
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconPlayerPlay size={14} />}
                        disabled={!canCheckIn || !canMoveToOpd}
                        loading={isCheckingIn && checkingInId === appointment.id}
                        onClick={() => onCheckIn(appointment)}
                      >
                        Send to OPD
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
  const queryClient = useQueryClient();
  const emit = useClinicalEmit();
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);
  const [basketOpened, { open: openBasket, close: closeBasket }] = useDisclosure(false);
  const [basketTab, setBasketTab] = useState<OrderBasketTab>("drug");
  const [activeEncounterTab, setActiveEncounterTab] = useHashTabs(
    "consultation",
    OPD_ENCOUNTER_TAB_VALUES,
  );

  function openOrderBasket(tab: OrderBasketTab = "drug") {
    setBasketTab(tab);
    openBasket();
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
  const { data: prescriptions = [] } = useQuery({
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
      notifications.show({
        title: "Sent to MRD",
        message: `${packet.packet_number} is available in MRD case sheets`,
        color: "success",
      });
    },
    onError: () => {
      notifications.show({
        title: "MRD handoff failed",
        message: "Unable to generate the OPD case-sheet packet",
        color: "danger",
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
  const journeyContext: ClinicalJourneyContext = {
    patientId,
    activeEncounterId: encounterId,
    activeOrderContext: "opd",
  };

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
          prescriptions={prescriptions as PrescriptionWithItems[]}
          labOrders={labOrdersResponse?.orders ?? []}
          labCatalog={labCatalog as LabTestCatalog[]}
        />
      )}

      <PatientContextBanner patientId={patientId} hideLoadingState />
      <PatientFlowNavigator
        patientId={patientId}
        active="opd"
        activeEncounterId={encounterId}
        compact
      />
      <Card withBorder padding="sm">
        <Group justify="space-between" gap="sm" align="center">
          <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              Next actions
            </Text>
            <Text size="xs" c="dimmed">
              Available from the active OPD encounter, patient state, and permissions.
            </Text>
          </Stack>
          <PatientJourneyActions
            context={journeyContext}
            localOrderContext="opd"
            hiddenActionIds={["opd.open_visit"]}
            size="xs"
            onOpenOrderBasket={openOrderBasket}
          />
        </Group>
      </Card>

      <Tabs
        value={activeEncounterTab}
        onChange={setActiveEncounterTab}
        keepMounted={false}
        orientation="vertical"
        style={{ display: "flex", height: "100%" }}
      >
        {/* ── Left Sidebar: Patient + Nav ── */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            overflowY: "auto",
            borderRight: "1px solid var(--fc-rule, #e7ebe8)",
            padding: "12px",
            background: "var(--fc-panel, #f7f8f6)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Patient card */}
          <Card padding="sm" mb="xs" bg="var(--fc-canvas, #fff)" withBorder>
            <Group gap="sm">
              <ThemeIcon size="lg" radius="xl" color="primary" variant="light">
                <IconUser size={18} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={700}>
                  {patientName}
                </Text>
                <Text size="xs" c="dimmed" ff="var(--font-mono, monospace)">
                  {uhid}
                </Text>
              </div>
            </Group>
          </Card>

          {/* Allergies */}
          {activeAllergies.length > 0 && (
            <Card
              padding="xs"
              mb="xs"
              bg="var(--mb-danger-bg, #fff1f2)"
              withBorder
              style={{ borderColor: "var(--mb-danger-accent, #f43f5e)" }}
            >
              <Group gap={4} mb={4}>
                <IconAlertTriangle size={14} color="var(--mb-danger-accent, #f43f5e)" />
                <Text size="xs" fw={700} c="danger">
                  Allergies
                </Text>
              </Group>
              <Group gap={4} wrap="wrap">
                {activeAllergies.map((a) => (
                  <Badge key={a.id} color="danger" variant="filled" size="xs">
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

          {/* Quick Actions */}
          <Stack gap={4} mb="xs">
            <Button
              variant="light"
              size="xs"
              fullWidth
              leftSection={<IconPrinter size={14} />}
              onClick={openSummary}
            >
              Print Summary
            </Button>
            {canGenerateMrdCaseSheet && (
              <Button
                variant={latestMrdCaseSheet ? "subtle" : "light"}
                size="xs"
                fullWidth
                leftSection={<IconClipboardList size={14} />}
                onClick={() => generateMrdCaseSheetMutation.mutate()}
                loading={generateMrdCaseSheetMutation.isPending}
              >
                {latestMrdCaseSheet ? "Update MRD Case Sheet" : "Send Case Sheet to MRD"}
              </Button>
            )}
            {canViewMrdCaseSheets && latestMrdCaseSheet && (
              <Button
                variant="subtle"
                size="compact-xs"
                fullWidth
                leftSection={<IconArrowRight size={12} />}
                onClick={() =>
                  navigate(`/mrd?packet_type=opd&encounter_id=${encounterId}#case-sheets`)
                }
              >
                Open MRD Packet
              </Button>
            )}
            {canOrder && <OrderBasketChip onClick={() => openOrderBasket("drug")} />}
            {canOrder && (
              <Group gap={4} grow>
                <Button
                  variant="subtle"
                  size="compact-xs"
                  leftSection={<IconFlask size={12} />}
                  onClick={() => openOrderBasket("lab")}
                >
                  Lab
                </Button>
                <Button
                  variant="subtle"
                  size="compact-xs"
                  leftSection={<IconEye size={12} />}
                  onClick={() => openOrderBasket("radiology")}
                >
                  Imaging
                </Button>
              </Group>
            )}
            <AdmitToIpdButton encounterId={encounterId} patientName={patientName} />
            <GroupAppointmentModal patientId={patientId} />
          </Stack>

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
              borderTop: "1px solid var(--fc-rule, #e7ebe8)",
              paddingTop: 8,
              flex: 1,
              overflowY: "auto",
            }}
          >
            <Accordion multiple defaultValue={["clinical"]} variant="contained">
              <Accordion.Item value="patient-context">
                <Accordion.Control>Patient context</Accordion.Control>
                <Accordion.Panel>
                  <Tabs.List
                    style={{ border: "none", display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <Tabs.Tab value="rx-history" leftSection={<IconClipboardList size={14} />}>
                      Rx History
                    </Tabs.Tab>
                    <Tabs.Tab value="charts" leftSection={<IconChartLine size={14} />}>
                      Charts
                    </Tabs.Tab>
                    <Tabs.Tab value="timeline" leftSection={<IconTimeline size={14} />}>
                      Timeline
                    </Tabs.Tab>
                  </Tabs.List>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="clinical">
                <Accordion.Control>Clinical workup</Accordion.Control>
                <Accordion.Panel>
                  <Tabs.List
                    style={{ border: "none", display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <Tabs.Tab value="vitals" leftSection={<IconHeartbeat size={14} />}>
                      Vitals
                    </Tabs.Tab>
                    <Tabs.Tab value="consultation" leftSection={<IconNotebook size={14} />}>
                      Consultation
                    </Tabs.Tab>
                    <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
                      History
                    </Tabs.Tab>
                    <Tabs.Tab value="ros" leftSection={<IconClipboardList size={14} />}>
                      ROS
                    </Tabs.Tab>
                    <Tabs.Tab value="physical-exam" leftSection={<IconStethoscope size={14} />}>
                      Physical Exam
                    </Tabs.Tab>
                  </Tabs.List>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="orders">
                <Accordion.Control>Assessment & orders</Accordion.Control>
                <Accordion.Panel>
                  <Tabs.List
                    style={{ border: "none", display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <Tabs.Tab value="diagnoses" leftSection={<IconStar size={14} />}>
                      Diagnoses
                    </Tabs.Tab>
                    <Tabs.Tab value="investigations" leftSection={<IconFlask size={14} />}>
                      Investigations
                    </Tabs.Tab>
                    <Tabs.Tab value="procedures" leftSection={<IconMedicalCross size={14} />}>
                      Procedures
                    </Tabs.Tab>
                    <Tabs.Tab value="prescriptions" leftSection={<IconPill size={14} />}>
                      Prescriptions
                    </Tabs.Tab>
                    <Tabs.Tab value="referrals" leftSection={<IconArrowRight size={14} />}>
                      Referrals
                    </Tabs.Tab>
                  </Tabs.List>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="closure">
                <Accordion.Control>Closure</Accordion.Control>
                <Accordion.Panel>
                  <Tabs.List
                    style={{ border: "none", display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <Tabs.Tab value="certificates" leftSection={<IconCertificate size={14} />}>
                      Certificates
                    </Tabs.Tab>
                    <Tabs.Tab value="followup" leftSection={<IconCalendarPlus size={14} />}>
                      Follow-up
                    </Tabs.Tab>
                    <Tabs.Tab value="reminders" leftSection={<IconNotebook size={14} />}>
                      Reminders
                    </Tabs.Tab>
                    <Tabs.Tab value="consents" leftSection={<IconFileCheck size={14} />}>
                      Consents
                    </Tabs.Tab>
                  </Tabs.List>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="support">
                <Accordion.Control>Support / admin</Accordion.Control>
                <Accordion.Panel>
                  <Tabs.List
                    style={{ border: "none", display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <Tabs.Tab value="pre-auth" leftSection={<IconShieldCheck size={14} />}>
                      Pre-Auth
                    </Tabs.Tab>
                    <Tabs.Tab value="docket" leftSection={<IconStar size={14} />}>
                      Docket
                    </Tabs.Tab>
                    <Tabs.Tab value="pharmacy-dispatch" leftSection={<IconPill size={14} />}>
                      Pharmacy Dispatch
                    </Tabs.Tab>
                    <Tabs.Tab value="feedback" leftSection={<IconMessage size={14} />}>
                      Feedback
                    </Tabs.Tab>
                  </Tabs.List>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </div>
        </div>

        {/* ── Right: Content panels ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
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
        onClose={closeBasket}
        encounterId={encounterId}
        patientId={patientId}
        activeTab={basketTab}
        onActiveTabChange={setBasketTab}
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

  const dispatchStatusColors: Record<string, string> = {
    pending: "slate",
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
        <Badge color={dispatchStatusColors[row.status] ?? "slate"} variant="filled" size="sm">
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
    emit("vitals.recorded", { encounter_id: encounterId, ...data });
    formHandlers.close();
  };

  return (
    <Stack>
      {canUpdate && !formOpened && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.open}>
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
                      <Badge size="sm" color="success" variant="light">
                        Latest
                      </Badge>
                    )}
                  </Group>
                }
              >
                <Group gap="md" mt={4} wrap="wrap">
                  {v.temperature != null && (
                    <Badge
                      variant="light"
                      color={Number(v.temperature) > 37.5 ? "danger" : "primary"}
                      size="md"
                    >
                      🌡 {v.temperature}°C
                      {trend(
                        Number(v.temperature),
                        prev?.temperature ? Number(prev.temperature) : null,
                      )}
                    </Badge>
                  )}
                  {v.pulse != null && (
                    <Badge
                      variant="light"
                      color={
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
                      variant="light"
                      color={
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
                    <Badge
                      variant="light"
                      color={Number(v.spo2) < 94 ? "danger" : "primary"}
                      size="md"
                    >
                      💨 SpO₂ {v.spo2}%
                    </Badge>
                  )}
                  {v.respiratory_rate != null && (
                    <Badge variant="light" size="sm">
                      🫁 RR {v.respiratory_rate}
                    </Badge>
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
                      <Badge size="xs" color="primary" variant="light">
                        Current encounter
                      </Badge>
                    )}
                  </Group>
                }
              >
                <Group gap="xs" mt={4} wrap="wrap">
                  {v.temperature != null && (
                    <Badge
                      variant="light"
                      color={Number(v.temperature) > 37.5 ? "danger" : "primary"}
                    >
                      Temp {v.temperature}°C
                    </Badge>
                  )}
                  {v.pulse != null && (
                    <Badge
                      variant="light"
                      color={v.pulse > 100 ? "danger" : v.pulse < 60 ? "warning" : "primary"}
                    >
                      Pulse {v.pulse}
                    </Badge>
                  )}
                  {v.systolic_bp != null && v.diastolic_bp != null && (
                    <Badge variant="light">
                      BP {v.systolic_bp}/{v.diastolic_bp}
                    </Badge>
                  )}
                  {v.spo2 != null && (
                    <Badge variant="light" color={v.spo2 < 94 ? "danger" : "primary"}>
                      SpO₂ {v.spo2}%
                    </Badge>
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["patient-consultations", patientId] });
      emit("consultation.saved", { encounter_id: encounterId });
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

// ── Structured History ───────────────────────────────────

function HistoryTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      opdService.createConsultation(encounterId, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      opdService.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const handleUpdate = (data: Partial<UpdateConsultationRequest>) => {
    if (consultation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(toCreateConsultationPayload(data));
    }
  };

  const c = consultation as Consultation | null;

  return (
    <StructuredHistory
      hpi={c?.hpi ?? ""}
      pastMedical={(c?.past_medical_history as PastMedicalEntry[] | null) ?? []}
      pastSurgical={(c?.past_surgical_history as PastSurgicalEntry[] | null) ?? []}
      familyHistory={(c?.family_history as FamilyHistoryEntry[] | null) ?? []}
      socialHistory={(c?.social_history as SocialHistory | null) ?? {}}
      canUpdate={canUpdate}
      onUpdate={handleUpdate}
    />
  );
}

// ── Review of Systems ────────────────────────────────────

function ROSTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [localRos, setLocalRos] = useState<ROSType>({});
  const [dirty, setDirty] = useState(false);

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });

  // Sync server data to local state when loaded
  const c = consultation as Consultation | null;
  const serverRos = (c?.review_of_systems as ROSType | null) ?? {};

  // Initialize local state from server (only when not dirty)
  useState(() => {
    if (!dirty) setLocalRos(serverRos);
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      opdService.createConsultation(encounterId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      setDirty(false);
      notifications.show({ title: "Saved", message: "Review of Systems saved", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to save ROS", color: "danger" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      opdService.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      setDirty(false);
      notifications.show({
        title: "Saved",
        message: "Review of Systems updated",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to update ROS", color: "danger" }),
  });

  const handleChange = (ros: ROSType) => {
    setLocalRos(ros);
    setDirty(true);
  };

  const handleSave = () => {
    if (consultation) {
      updateMutation.mutate({ review_of_systems: localRos });
    } else {
      createMutation.mutate({ review_of_systems: localRos });
    }
  };

  return (
    <Stack>
      <ReviewOfSystems
        data={dirty ? localRos : serverRos}
        canUpdate={canUpdate}
        onUpdate={handleChange}
      />
      {canUpdate && (
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!dirty}
          >
            Save Review of Systems
          </Button>
        </Group>
      )}
    </Stack>
  );
}

// ── Physical Examination ─────────────────────────────────

function PhysicalExamTab({ encounterId, canUpdate }: { encounterId: string; canUpdate: boolean }) {
  const queryClient = useQueryClient();

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      opdService.createConsultation(encounterId, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      opdService.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const handleUpdate = (exam: PhysicalExamination, generalAppearance?: string) => {
    const data: UpdateConsultationRequest = { physical_examination: exam };
    if (generalAppearance !== undefined) data.general_appearance = generalAppearance;
    if (consultation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(toCreateConsultationPayload(data));
    }
  };

  const c = consultation as Consultation | null;

  return (
    <PhysicalExamPanel
      data={(c?.physical_examination as PhysicalExamination | null) ?? {}}
      generalAppearance={c?.general_appearance ?? ""}
      canUpdate={canUpdate}
      onUpdate={handleUpdate}
    />
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

const LAB_STATUS_COLORS: Record<string, string> = {
  ordered: "primary",
  sample_collected: "info",
  processing: "orange",
  completed: "success",
  verified: "teal",
  cancelled: "danger",
};

const LAB_PRIORITY_COLORS: Record<string, string> = {
  routine: "slate",
  urgent: "orange",
  stat: "danger",
};

const LAB_RESULT_FLAG_COLORS: Record<string, string> = {
  normal: "success",
  low: "orange",
  high: "orange",
  critical_low: "danger",
  critical_high: "danger",
  abnormal: "warning",
};

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
  } = useForm({
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      notifications.show({
        title: "Investigation ordered",
        message: "Lab order placed successfully",
        color: "success",
      });
      emit("lab.ordered", { encounter_id: encounterId, patient_id: patientId });
      reset(DEFAULT_OPD_LAB_ORDER_FORM_VALUES);
      setLabDupeWarning([]);
      formHandlers.close();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to place lab order", color: "danger" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => opdService.cancelLabOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-orders", encounterId] });
      notifications.show({
        title: "Order cancelled",
        message: "Lab order has been cancelled",
        color: "warning",
      });
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
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.open}>
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
                color="warning"
                variant="light"
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
                variant="subtle"
                size="sm"
                onClick={() => {
                  formHandlers.close();
                  reset(DEFAULT_OPD_LAB_ORDER_FORM_VALUES);
                }}
              >
                Cancel
              </Button>
              <Button
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
          <Badge variant="light" color="primary">
            Patient history
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Card padding="xs" radius="md" withBorder>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  Lab Reports
                </Text>
                <Badge size="xs" variant="light" color="info">
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
                          <Badge
                            size="xs"
                            variant="light"
                            color={LAB_STATUS_COLORS[report.status] ?? "slate"}
                          >
                            {report.status.replace(/_/g, " ")}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="light"
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
                <Badge size="xs" variant="light" color="violet">
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
                            <Badge size="xs" variant="light">
                              {study.modality}
                            </Badge>
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
                                component="a"
                                href={study.viewer_url}
                                target="_blank"
                                rel="noreferrer"
                                size="xs"
                                variant="light"
                                leftSection={<IconEye size={14} />}
                              >
                                Viewer
                              </Button>
                            ) : null}
                            {study.pacs_url ? (
                              <Button
                                component="a"
                                href={study.pacs_url}
                                target="_blank"
                                rel="noreferrer"
                                size="xs"
                                variant="subtle"
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
                  <Badge size="xs" color={LAB_PRIORITY_COLORS[order.priority] ?? "slate"}>
                    {order.priority.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="xs"
                    variant="light"
                    color={LAB_STATUS_COLORS[order.status] ?? "slate"}
                  >
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
                        <ActionIcon
                          variant="subtle"
                          color="danger"
                          size="xs"
                          onClick={() => cancelMutation.mutate(order.id)}
                          loading={cancelMutation.isPending}
                        >
                          <IconX size={12} />
                        </ActionIcon>
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
                      <Badge
                        size="xs"
                        variant="light"
                        color={LAB_RESULT_FLAG_COLORS[result.flag] ?? "slate"}
                      >
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
      notifications.show({
        title: "Follow-up scheduled",
        message: `Appointment booked for ${appointment.appointment_date}`,
        color: "success",
      });
      emit("followup.scheduled", { patient_id: patientId, date: appointment.appointment_date });
      reset(DEFAULT_OPD_FOLLOW_UP_FORM_VALUES);
      setBooked(true);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to book follow-up", color: "danger" });
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
            variant="subtle"
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
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      emit("prescription.created", {
        encounter_id: encounterId,
        item_count: variables.items.length,
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
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["prescriptions", encounterId] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-rx-queue"] });
      emit("prescription.updated_before_pharmacy_approval", {
        prescription_id: variables.prescriptionId,
        encounter_id: encounterId,
        item_count: variables.data.items.length,
      });
      notifications.show({
        title: "Prescription updated",
        message: "Pharmacy review and billing will use the revised prescription",
        color: "teal",
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

// ── Rx History ──────────────────────────────────────────

function RxHistoryTab({ patientId }: { patientId: string }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => opdService.listPatientPrescriptions(patientId),
  });

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading prescription history...
      </Text>
    );
  }

  if (history.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No previous prescriptions found for this patient.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {(history as PrescriptionHistoryItem[]).map((h) => (
        <Card key={h.prescription.id} padding="sm" radius="md" withBorder>
          <Group gap={8} mb="xs">
            <Badge size="xs" variant="light">
              {new Date(h.encounter_date).toLocaleDateString()}
            </Badge>
            {h.doctor_name && (
              <Text size="xs" c="dimmed">
                Dr. {h.doctor_name}
              </Text>
            )}
            {h.prescription.notes && (
              <Text size="xs" c="dimmed" fs="italic">
                — {h.prescription.notes}
              </Text>
            )}
          </Group>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Drug</Table.Th>
                <Table.Th>Dosage</Table.Th>
                <Table.Th>Freq</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Route</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {h.items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {item.drug_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>{item.dosage}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light">
                      {item.frequency}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{item.duration}</Table.Td>
                  <Table.Td>{item.route ?? "—"}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      ))}
    </Stack>
  );
}

// ── Medical Certificates ────────────────────────────────

const CERTIFICATE_TYPES: { value: CertificateType; label: string }[] = [
  { value: "medical", label: "Medical Certificate" },
  { value: "fitness", label: "Fitness Certificate" },
  { value: "sick_leave", label: "Sick Leave Certificate" },
  { value: "disability", label: "Disability Certificate" },
  { value: "death", label: "Death Certificate" },
  { value: "birth", label: "Birth Certificate" },
  { value: "custom", label: "Custom Certificate" },
];

function CertificatesTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [certType, setCertType] = useState<string | null>(null);
  const [issuedDate, setIssuedDate] = useState(() => todayDateString());
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["patient-certificates", patientId],
    queryFn: () => opdService.listCertificates(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMedicalCertificateRequest) => opdService.createCertificate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-certificates", patientId] });
      notifications.show({
        title: "Certificate created",
        message: "Medical certificate generated",
        color: "success",
      });
      closeCreate();
      resetForm();
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to create certificate",
        color: "danger",
      });
    },
  });

  const resetForm = () => {
    setCertType(null);
    setIssuedDate(todayDateString());
    setValidFrom("");
    setValidTo("");
    setDiagnosis("");
    setRemarks("");
  };

  const handleCreate = () => {
    if (!certType) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      certificate_type: certType as CertificateType,
      issued_date: issuedDate || undefined,
      valid_from: validFrom || undefined,
      valid_to: validTo || undefined,
      diagnosis: diagnosis.trim() || undefined,
      remarks: remarks.trim() || undefined,
      body: {},
    });
  };

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading certificates...
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New Certificate
          </Button>
        </Group>
      )}

      {(certificates as MedicalCertificate[]).map((cert) => (
        <Card key={cert.id} padding="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <IconCertificate size={16} color="var(--mantine-color-blue-5)" />
              <Badge size="sm" variant="light">
                {cert.certificate_type.replace(/_/g, " ")}
              </Badge>
              {cert.certificate_number && (
                <Text size="xs" c="dimmed" ff="monospace">
                  {cert.certificate_number}
                </Text>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {new Date(cert.issued_date).toLocaleDateString()}
            </Text>
          </Group>
          {cert.diagnosis && (
            <Text size="sm">
              <Text span fw={500}>
                Diagnosis:
              </Text>{" "}
              {cert.diagnosis}
            </Text>
          )}
          {(cert.valid_from || cert.valid_to) && (
            <Text size="xs" c="dimmed">
              {cert.valid_from ? `From: ${new Date(cert.valid_from).toLocaleDateString()}` : ""}
              {cert.valid_from && cert.valid_to ? " — " : ""}
              {cert.valid_to ? `To: ${new Date(cert.valid_to).toLocaleDateString()}` : ""}
            </Text>
          )}
          {cert.remarks && (
            <Text size="xs" c="dimmed" fs="italic" mt={4}>
              {cert.remarks}
            </Text>
          )}
        </Card>
      ))}

      {certificates.length === 0 && !createOpen && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No certificates issued for this patient.
        </Text>
      )}

      {/* Create certificate modal */}
      <Modal opened={createOpen} onClose={closeCreate} title="New Medical Certificate" size="md">
        <Stack gap="sm">
          <Select
            label="Certificate Type"
            placeholder="Select type"
            data={CERTIFICATE_TYPES}
            value={certType}
            onChange={setCertType}
            required
          />
          <TextInput
            label="Issued Date"
            type="date"
            value={issuedDate}
            onChange={(e) => setIssuedDate(e.currentTarget.value)}
          />
          <Group grow>
            <TextInput
              label="Valid From"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.currentTarget.value)}
            />
            <TextInput
              label="Valid To"
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Diagnosis"
            placeholder="Primary diagnosis for certificate"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Textarea
            label="Remarks"
            placeholder="Additional remarks or instructions"
            value={remarks}
            onChange={(e) => setRemarks(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!certType}
              leftSection={<IconCertificate size={14} />}
            >
              Create Certificate
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Vitals/Lab Trend Charts ─────────────────────────────

function ChartsTab({ patientId }: { patientId: string }) {
  const [metric, setMetric] = useState<string | null>("bp");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["patient-vitals-history", patientId],
    queryFn: () => opdService.listPatientVitalsHistory(patientId),
  });

  const chartData = useMemo(() => {
    return (history as VitalHistoryPoint[]).map((p) => ({
      date: new Date(p.recorded_at).toLocaleDateString(),
      Systolic: p.systolic_bp,
      Diastolic: p.diastolic_bp,
      Pulse: p.pulse,
      Temp: p.temperature ? Number(p.temperature) : null,
      SpO2: p.spo2,
      RR: p.respiratory_rate,
      Weight: p.weight_kg ? Number(p.weight_kg) : null,
      BMI: p.bmi ? Number(p.bmi) : null,
    }));
  }, [history]);

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading vitals history...
      </Text>
    );
  }

  if (chartData.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No vitals history available for trend charts.
      </Text>
    );
  }

  const bpSeries = [
    { name: "Systolic", color: "red.6" },
    { name: "Diastolic", color: "blue.6" },
  ];
  const pulseSeries = [{ name: "Pulse", color: "pink.6" }];
  const tempSeries = [{ name: "Temp", color: "orange.6" }];
  const spo2Series = [{ name: "SpO2", color: "teal.6" }];
  const weightSeries = [
    { name: "Weight", color: "primary.4" },
    { name: "BMI", color: "violet.6" },
  ];

  const seriesMap: Record<string, { name: string; color: string }[]> = {
    bp: bpSeries,
    pulse: pulseSeries,
    temp: tempSeries,
    spo2: spo2Series,
    weight: weightSeries,
  };

  const activeSeries = seriesMap[metric ?? "bp"] ?? bpSeries;

  return (
    <Stack gap="sm">
      <Group>
        <Select
          value={metric}
          onChange={setMetric}
          data={[
            { value: "bp", label: "Blood Pressure" },
            { value: "pulse", label: "Pulse" },
            { value: "temp", label: "Temperature" },
            { value: "spo2", label: "SpO2" },
            { value: "weight", label: "Weight & BMI" },
          ]}
          w={200}
          size="sm"
        />
      </Group>
      <LineChart
        h={300}
        data={chartData}
        dataKey="date"
        series={activeSeries}
        curveType="monotone"
        connectNulls
        withLegend
        withTooltip
        tooltipAnimationDuration={200}
      />
    </Stack>
  );
}

// ── Patient Timeline ────────────────────────────────────

function TimelineTab({ patientId }: { patientId: string }) {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { data: visits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: () => opdService.listPatientVisits(patientId),
  });
  const { data: rxHistory = [] } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => opdService.listPatientPrescriptions(patientId),
  });
  const { data: labOrders = [] } = useQuery({
    queryKey: ["patient-lab-orders", patientId],
    queryFn: () => opdService.listPatientLabOrders(patientId),
  });
  const { data: certificates = [] } = useQuery({
    queryKey: ["patient-certificates", patientId],
    queryFn: () => opdService.listCertificates(patientId),
  });

  // Merge into unified timeline
  const timelineItems = useMemo(() => {
    const items: {
      key: string;
      date: string;
      type: string;
      title: string;
      detail: string;
      color: string;
      icon: React.ReactNode;
      counts?: string;
    }[] = [];

    for (const v of visits as PatientVisitRow[]) {
      const counts = [
        v.diagnosis_count ? `${v.diagnosis_count} dx` : null,
        v.prescription_count ? `${v.prescription_count} rx` : null,
        v.lab_order_count ? `${v.lab_order_count} labs` : null,
      ]
        .filter(Boolean)
        .join(", ");
      items.push({
        key: `visit-${v.id}`,
        date: v.encounter_date ?? v.created_at,
        type: "visit",
        title: `${v.encounter_type.toUpperCase()} visit — ${v.status}`,
        detail: [
          v.department_name,
          v.doctor_name ? `Dr. ${v.doctor_name}` : null,
          v.chief_complaint,
        ]
          .filter(Boolean)
          .join(" · "),
        counts: counts || undefined,
        color: "primary",
        icon: <IconStethoscope size={12} />,
      });
    }

    for (const rx of rxHistory as PrescriptionHistoryItem[]) {
      items.push({
        key: `prescription-${rx.prescription.id}`,
        date: rx.encounter_date ?? rx.prescription.created_at,
        type: "prescription",
        title: `Prescription (${rx.items.length} items)`,
        detail: rx.items.map((i) => `${i.drug_name} ${i.dosage} ${i.frequency}`).join(" | "),
        color: "success",
        icon: <IconPill size={12} />,
      });
    }

    for (const lo of labOrders) {
      items.push({
        key: `lab-${lo.id}`,
        date: lo.created_at,
        type: "lab",
        title: `Lab: ${lo.test_name ?? "Test"}`,
        detail: `${lo.status} · ${lo.priority}`,
        color: "info",
        icon: <IconFlask size={12} />,
      });
    }

    for (const cert of certificates as MedicalCertificate[]) {
      items.push({
        key: `certificate-${cert.id}`,
        date: cert.created_at,
        type: "certificate",
        title: `${cert.certificate_type.replace(/_/g, " ")} certificate`,
        detail: cert.certificate_number ?? "",
        color: "violet",
        icon: <IconCertificate size={12} />,
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  }, [visits, rxHistory, labOrders, certificates]);

  const filteredItems = useMemo(
    () =>
      (typeFilter ? timelineItems.filter((i) => i.type === typeFilter) : timelineItems).slice(
        0,
        50,
      ),
    [timelineItems, typeFilter],
  );

  if (loadingVisits) {
    return (
      <Text size="sm" c="dimmed">
        Loading timeline...
      </Text>
    );
  }

  if (timelineItems.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        No clinical history found for this patient.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Select
          placeholder="Filter by type"
          data={[
            { value: "visit", label: "Visits" },
            { value: "prescription", label: "Prescriptions" },
            { value: "lab", label: "Lab Orders" },
            { value: "certificate", label: "Certificates" },
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          size="xs"
          w={180}
        />
        <Text size="xs" c="dimmed">
          {filteredItems.length} of {timelineItems.length} items
        </Text>
      </Group>
      <Timeline active={-1} bulletSize={24} lineWidth={2}>
        {filteredItems.map((item) => (
          <Timeline.Item
            key={item.key}
            bullet={item.icon}
            color={item.color}
            title={
              <Group gap={8}>
                <Text size="sm" fw={500}>
                  {item.title}
                </Text>
                <Text size="xs" c="dimmed">
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </Group>
            }
          >
            <Text size="xs" c="dimmed">
              {item.detail}
            </Text>
            {item.counts && (
              <Group gap={4} mt={2}>
                {item.counts.split(", ").map((c) => (
                  <Badge key={c} size="xs" variant="dot" color="primary">
                    {c}
                  </Badge>
                ))}
              </Group>
            )}
          </Timeline.Item>
        ))}
      </Timeline>
    </Stack>
  );
}

// ── Procedures Tab ──────────────────────────────────────

const PROC_STATUS_COLORS: Record<string, string> = {
  ordered: "primary",
  scheduled: "info",
  in_progress: "orange",
  completed: "success",
  cancelled: "danger",
};

function ProceduresTab({
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
  const [dupeWarning, setDupeWarning] = useState<DuplicateOrderInfo[]>([]);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(opdProcedureOrderFormSchema),
    defaultValues: DEFAULT_OPD_PROCEDURE_ORDER_FORM_VALUES,
    mode: "onTouched",
  });
  const selectedProcId = watch("procedure_id");

  const { data: catalog = [] } = useQuery<ProcedureCatalog[]>({
    queryKey: ["procedure-catalog"],
    queryFn: () => opdService.listProcedureCatalog(),
    staleTime: 300_000,
  });

  const { data: orders = [] } = useQuery<ProcedureOrderWithName[]>({
    queryKey: ["procedure-orders", encounterId],
    queryFn: () => opdService.listProcedureOrders(encounterId),
  });

  const procOptions = catalog.map((procedure) => ({
    value: procedure.id,
    label: `${procedure.code} — ${procedure.name}${
      procedure.category ? ` (${procedure.category})` : ""
    }`,
  }));

  // Duplicate check on procedure selection
  const handleProcSelect = async (
    procId: string | null,
    onChange: (value: string | null) => void,
  ) => {
    onChange(procId);
    setDupeWarning([]);
    if (procId) {
      try {
        const dupes = await opdService.checkDuplicateOrders({
          patient_id: patientId,
          procedure_id: procId,
        });
        if (dupes.length > 0) setDupeWarning(dupes);
      } catch {
        /* ignore check failure */
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: opdService.createProcedureOrder,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["procedure-orders", encounterId] });
      notifications.show({
        title: "Procedure ordered",
        message: "Procedure order placed",
        color: "success",
      });
      emit("procedure.ordered", { encounter_id: encounterId, patient_id: patientId });
      reset(DEFAULT_OPD_PROCEDURE_ORDER_FORM_VALUES);
      setDupeWarning([]);
      formHandlers.close();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to order procedure", color: "danger" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => opdService.cancelProcedureOrder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["procedure-orders", encounterId] });
      notifications.show({
        title: "Cancelled",
        message: "Procedure order cancelled",
        color: "warning",
      });
    },
  });

  const handleOrder = handleSubmit((values) => {
    createMutation.mutate(toCreateProcedureOrderRequest(values, patientId, encounterId));
  });

  return (
    <Stack>
      {canUpdate && !formOpened && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.open}>
            Order Procedure
          </Button>
        </Group>
      )}

      {formOpened && (
        <Card padding="sm" radius="md" withBorder>
          <Stack gap="xs">
            <Controller
              control={control}
              name="procedure_id"
              render={({ field }) => (
                <Select
                  label="Procedure"
                  placeholder="Search procedures..."
                  data={procOptions}
                  value={field.value}
                  onChange={(value) => void handleProcSelect(value, field.onChange)}
                  searchable
                  nothingFoundMessage="No procedures found"
                  error={errors.procedure_id?.message}
                  required
                />
              )}
            />
            {dupeWarning.length > 0 && (
              <Alert
                icon={<IconAlertTriangle size={14} />}
                color="warning"
                variant="light"
                title="Duplicate Warning"
              >
                <Text size="xs">
                  This procedure was already ordered {dupeWarning.length} time(s) in the last 24
                  hours. ({dupeWarning.map((d) => d.status).join(", ")})
                </Text>
              </Alert>
            )}
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select
                  label="Priority"
                  data={OPD_PROCEDURE_PRIORITY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.priority?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <Textarea
                  label="Notes"
                  placeholder="Clinical notes for procedure..."
                  value={field.value}
                  onChange={field.onChange}
                  autosize
                  minRows={2}
                />
              )}
            />
            <Group justify="flex-end" gap="xs">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  formHandlers.close();
                  reset(DEFAULT_OPD_PROCEDURE_ORDER_FORM_VALUES);
                  setDupeWarning([]);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                leftSection={<IconMedicalCross size={14} />}
                onClick={handleOrder}
                loading={createMutation.isPending}
                disabled={!selectedProcId}
              >
                Place Order
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {orders.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ordered</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {orders.map((order) => (
              <Table.Tr key={order.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {order.procedure_name ?? order.procedure_code}
                  </Text>
                  {order.notes && (
                    <Text size="xs" c="dimmed">
                      {order.notes}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" color={LAB_PRIORITY_COLORS[order.priority] ?? "slate"}>
                    {order.priority.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="xs"
                    variant="light"
                    color={PROC_STATUS_COLORS[order.status] ?? "slate"}
                  >
                    {order.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {new Date(order.created_at).toLocaleString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {canUpdate && (order.status === "ordered" || order.status === "scheduled") && (
                    <Tooltip label="Cancel">
                      <ActionIcon
                        variant="subtle"
                        color="danger"
                        size="xs"
                        onClick={() => cancelMutation.mutate(order.id)}
                      >
                        <IconX size={12} />
                      </ActionIcon>
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
          No procedures ordered yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Referrals Tab ───────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  routine: "primary",
  urgent: "orange",
  emergency: "danger",
};

const REFERRAL_STATUS_COLORS: Record<string, string> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  completed: "teal",
  cancelled: "slate",
};

function ReferralsTab({
  patientId,
  encounterId,
  departmentId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  departmentId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [toDeptId, setToDeptId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<string | null>("routine");
  const [reason, setReason] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["patient-referrals", patientId],
    queryFn: () => opdService.listPatientReferrals(patientId),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });

  const deptOptions = (departments as DepartmentRow[])
    .filter(
      (d) =>
        d.id !== departmentId &&
        (d.department_type === "clinical" || d.department_type === "para_clinical"),
    )
    .map((d) => ({ value: d.id, label: d.name }));

  const createMutation = useMutation({
    mutationFn: (data: CreateReferralRequest) => opdService.createReferral(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-referrals", patientId] });
      notifications.show({
        title: "Referral created",
        message: "Patient referred successfully",
        color: "success",
      });
      closeCreate();
      setToDeptId(null);
      setUrgency("routine");
      setReason("");
      setClinicalNotes("");
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create referral", color: "danger" });
    },
  });

  const handleCreate = () => {
    if (!toDeptId || !reason.trim()) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      to_department_id: toDeptId,
      urgency: toReferralUrgency(urgency),
      reason: reason.trim(),
      clinical_notes: clinicalNotes.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading referrals...
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New Referral
          </Button>
        </Group>
      )}

      {(referrals as ReferralWithNames[]).map((ref) => (
        <Card key={ref.id} padding="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <IconArrowRight size={16} color="var(--mantine-color-blue-5)" />
              <Text size="sm" fw={500}>
                {ref.from_department_name ?? "—"} → {ref.to_department_name ?? "—"}
              </Text>
              <Badge size="xs" color={URGENCY_COLORS[ref.urgency] ?? "slate"}>
                {ref.urgency}
              </Badge>
              <Badge
                size="xs"
                variant="light"
                color={REFERRAL_STATUS_COLORS[ref.status] ?? "slate"}
              >
                {ref.status}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {new Date(ref.created_at).toLocaleDateString()}
            </Text>
          </Group>
          <Text size="sm">
            <Text span fw={500}>
              Reason:
            </Text>{" "}
            {ref.reason}
          </Text>
          {ref.from_doctor_name && (
            <Text size="xs" c="dimmed">
              From: Dr. {ref.from_doctor_name}
            </Text>
          )}
          {ref.to_doctor_name && (
            <Text size="xs" c="dimmed">
              To: Dr. {ref.to_doctor_name}
            </Text>
          )}
          {ref.clinical_notes && (
            <Text size="xs" c="dimmed" mt={4}>
              {ref.clinical_notes}
            </Text>
          )}
          {ref.response_notes && (
            <Alert color="success" variant="light" mt="xs" title="Response">
              <Text size="xs">{ref.response_notes}</Text>
            </Alert>
          )}
        </Card>
      ))}

      {referrals.length === 0 && !createOpen && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No referrals for this patient.
        </Text>
      )}

      {/* Create referral modal */}
      <Modal opened={createOpen} onClose={closeCreate} title="New Referral" size="md">
        <Stack gap="sm">
          <Select
            label="Refer to Department"
            placeholder="Select department"
            data={deptOptions}
            value={toDeptId}
            onChange={setToDeptId}
            searchable
            required
          />
          <Select
            label="Urgency"
            data={[
              { value: "routine", label: "Routine" },
              { value: "urgent", label: "Urgent" },
              { value: "emergency", label: "Emergency" },
            ]}
            value={urgency}
            onChange={setUrgency}
          />
          <Textarea
            label="Reason for Referral"
            placeholder="Clinical reason for referring this patient"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            autosize
            minRows={2}
            required
          />
          <Textarea
            label="Clinical Notes"
            placeholder="Additional clinical context, findings, suspected diagnosis..."
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!toDeptId || !reason.trim()}
              leftSection={<IconArrowRight size={14} />}
            >
              Create Referral
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Reminders ─────────────────────────────────────────────

function RemindersTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(opdReminderFormSchema),
    defaultValues: DEFAULT_OPD_REMINDER_FORM_VALUES,
    mode: "onTouched",
  });
  const reminderValues = watch();

  const { data: reminders = [] } = useQuery<PatientReminder[]>({
    queryKey: ["reminders", patientId],
    queryFn: () => opdService.listReminders({ patient_id: patientId }),
  });

  const createMutation = useMutation({
    mutationFn: opdService.createReminder,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["reminders", patientId] });
      notifications.show({ title: "Reminder created", message: variables.title, color: "success" });
      formHandlers.close();
      reset(DEFAULT_OPD_REMINDER_FORM_VALUES);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create reminder", color: "danger" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => opdService.completeReminder(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reminders", patientId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => opdService.cancelReminder(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reminders", patientId] }),
  });

  const handleCreate = handleSubmit((values) => {
    createMutation.mutate(toCreateReminderRequest(values, patientId, encounterId));
  });

  const closeForm = () => {
    formHandlers.close();
    reset(DEFAULT_OPD_REMINDER_FORM_VALUES);
  };

  const priorityColors: Record<string, string> = {
    low: "slate",
    normal: "primary",
    high: "orange",
    urgent: "danger",
  };

  const statusColors: Record<string, string> = {
    pending: "primary",
    sent: "info",
    acknowledged: "teal",
    completed: "success",
    cancelled: "slate",
    overdue: "danger",
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.open}>
            Add Reminder
          </Button>
        </Group>
      )}

      {reminders.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No reminders yet.
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Priority</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {reminders.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{r.title}</Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {r.reminder_type.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>{r.reminder_date}</Table.Td>
                <Table.Td>
                  <Badge color={priorityColors[r.priority] ?? "primary"} size="sm">
                    {r.priority}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[r.status] ?? "slate"} size="sm">
                    {r.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {r.status === "pending" && canUpdate && (
                    <Group gap={4}>
                      <Tooltip label="Complete">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="success"
                          onClick={() => completeMutation.mutate(r.id)}
                        >
                          <IconCheck size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Cancel">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="danger"
                          onClick={() => cancelMutation.mutate(r.id)}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={formOpened} onClose={closeForm} title="New Reminder" size="md">
        <Stack gap="sm">
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <TextInput label="Title" error={errors.title?.message} required {...field} />
            )}
          />
          <Controller
            control={control}
            name="reminder_type"
            render={({ field }) => (
              <Select
                label="Type"
                data={OPD_REMINDER_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.reminder_type?.message}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="reminder_date"
            render={({ field }) => (
              <TextInput
                label="Reminder Date"
                type="date"
                error={errors.reminder_date?.message}
                required
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select
                label="Priority"
                data={OPD_REMINDER_PRIORITY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.priority?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field }) => <Textarea label="Description" autosize minRows={2} {...field} />}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!reminderValues.title.trim() || !reminderValues.reminder_date}
            >
              Create Reminder
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Feedback ──────────────────────────────────────────────

function FeedbackTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(opdFeedbackFormSchema),
    defaultValues: DEFAULT_OPD_FEEDBACK_FORM_VALUES,
    mode: "onTouched",
  });

  const { data: feedback = [] } = useQuery<PatientFeedback[]>({
    queryKey: ["feedback", patientId],
    queryFn: () => opdService.listPatientFeedback(patientId),
  });

  const createMutation = useMutation({
    mutationFn: opdService.createFeedback,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feedback", patientId] });
      notifications.show({
        title: "Feedback recorded",
        message: "Thank you for the feedback",
        color: "success",
      });
      formHandlers.close();
      reset(DEFAULT_OPD_FEEDBACK_FORM_VALUES);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to submit feedback", color: "danger" });
    },
  });

  const handleCreate = handleSubmit((values) => {
    createMutation.mutate(toCreateFeedbackRequest(values, patientId, encounterId));
  });

  const closeForm = () => {
    formHandlers.close();
    reset(DEFAULT_OPD_FEEDBACK_FORM_VALUES);
  };

  const ratingColor = (val: number | null) => {
    if (!val) return "gray";
    if (val >= 4) return "success";
    if (val >= 3) return "warning";
    return "danger";
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.open}>
            Collect Feedback
          </Button>
        </Group>
      )}

      {feedback.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No feedback collected yet.
        </Text>
      ) : (
        <Stack gap="sm">
          {feedback.map((fb) => (
            <Card key={fb.id} padding="sm" radius="md" withBorder>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  {new Date(fb.submitted_at).toLocaleDateString()}
                </Text>
                {fb.is_anonymous && (
                  <Badge size="xs" variant="light">
                    Anonymous
                  </Badge>
                )}
              </Group>
              <Group gap="md" mb="xs">
                {fb.rating != null && (
                  <Badge
                    color={ratingColor(fb.rating)}
                    size="sm"
                    leftSection={<IconStar size={10} />}
                  >
                    Overall: {fb.rating}/5
                  </Badge>
                )}
                {fb.wait_time_rating != null && (
                  <Badge color={ratingColor(fb.wait_time_rating)} variant="light" size="sm">
                    Wait: {fb.wait_time_rating}/5
                  </Badge>
                )}
                {fb.staff_rating != null && (
                  <Badge color={ratingColor(fb.staff_rating)} variant="light" size="sm">
                    Staff: {fb.staff_rating}/5
                  </Badge>
                )}
                {fb.cleanliness_rating != null && (
                  <Badge color={ratingColor(fb.cleanliness_rating)} variant="light" size="sm">
                    Clean: {fb.cleanliness_rating}/5
                  </Badge>
                )}
              </Group>
              {fb.overall_experience && <Text size="sm">{fb.overall_experience}</Text>}
              {fb.suggestions && (
                <Text size="sm" c="dimmed" fs="italic">
                  Suggestion: {fb.suggestions}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      )}

      <Modal opened={formOpened} onClose={closeForm} title="Collect Patient Feedback" size="md">
        <Stack gap="sm">
          <Controller
            control={control}
            name="rating"
            render={({ field }) => (
              <Select
                label="Overall Rating"
                data={OPD_RATING_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.rating?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="wait_time_rating"
            render={({ field }) => (
              <Select
                label="Wait Time"
                data={OPD_RATING_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.wait_time_rating?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="staff_rating"
            render={({ field }) => (
              <Select
                label="Staff Courtesy"
                data={OPD_RATING_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.staff_rating?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="cleanliness_rating"
            render={({ field }) => (
              <Select
                label="Cleanliness"
                data={OPD_RATING_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.cleanliness_rating?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="overall_experience"
            render={({ field }) => (
              <Textarea label="Overall Experience" autosize minRows={2} {...field} />
            )}
          />
          <Controller
            control={control}
            name="suggestions"
            render={({ field }) => <Textarea label="Suggestions" autosize minRows={2} {...field} />}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createMutation.isPending}>
              Submit Feedback
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Consents ──────────────────────────────────────────────

function ConsentsTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(opdProcedureConsentFormSchema),
    defaultValues: DEFAULT_OPD_CONSENT_FORM_VALUES,
    mode: "onTouched",
  });
  const procedureName = watch("procedure_name");

  const { data: consents = [] } = useQuery<ProcedureConsent[]>({
    queryKey: ["consents", patientId],
    queryFn: () => opdService.listProcedureConsents(patientId),
  });

  const createMutation = useMutation({
    mutationFn: opdService.createProcedureConsent,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      notifications.show({
        title: "Consent created",
        message: variables.procedure_name,
        color: "success",
      });
      formHandlers.close();
      reset(DEFAULT_OPD_CONSENT_FORM_VALUES);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create consent", color: "danger" });
    },
  });

  const signMutation = useMutation({
    mutationFn: (id: string) => opdService.signProcedureConsent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consents", patientId] });
      notifications.show({
        title: "Consent signed",
        message: "Consent has been signed",
        color: "success",
      });
    },
  });

  const handleCreate = handleSubmit((values) => {
    createMutation.mutate(toCreateConsentRequest(values, patientId, encounterId));
  });

  const closeForm = () => {
    formHandlers.close();
    reset(DEFAULT_OPD_CONSENT_FORM_VALUES);
  };

  const consentStatusColors: Record<string, string> = {
    pending: "warning",
    signed: "success",
    refused: "danger",
    withdrawn: "slate",
    expired: "orange",
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={formHandlers.open}>
            New Consent
          </Button>
        </Group>
      )}

      {consents.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No consents recorded.
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Procedure</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Consented By</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {consents.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.procedure_name}</Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">
                    {c.consent_type.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={consentStatusColors[c.status] ?? "slate"} size="sm">
                    {c.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{c.consented_by_name ?? "—"}</Table.Td>
                <Table.Td>{new Date(c.created_at).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  {c.status === "pending" && canUpdate && (
                    <Tooltip label="Sign Consent">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="success"
                        onClick={() => signMutation.mutate(c.id)}
                      >
                        <IconFileCheck size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={formOpened} onClose={closeForm} title="New Procedure Consent" size="lg">
        <Stack gap="sm">
          <Controller
            control={control}
            name="procedure_name"
            render={({ field }) => (
              <TextInput
                label="Procedure Name"
                error={errors.procedure_name?.message}
                required
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="consent_type"
            render={({ field }) => (
              <Select
                label="Consent Type"
                data={OPD_CONSENT_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.consent_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="risks_explained"
            render={({ field }) => (
              <Textarea label="Risks Explained" autosize minRows={2} {...field} />
            )}
          />
          <Controller
            control={control}
            name="alternatives_explained"
            render={({ field }) => (
              <Textarea label="Alternatives Explained" autosize minRows={2} {...field} />
            )}
          />
          <Controller
            control={control}
            name="benefits_explained"
            render={({ field }) => (
              <Textarea label="Benefits Explained" autosize minRows={2} {...field} />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="consented_by_name"
              render={({ field }) => <TextInput label="Consented By (Name)" {...field} />}
            />
            <Controller
              control={control}
              name="consented_by_relation"
              render={({ field }) => <TextInput label="Relation to Patient" {...field} />}
            />
          </Group>
          <Controller
            control={control}
            name="witness_name"
            render={({ field }) => <TextInput label="Witness Name" {...field} />}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!procedureName.trim()}
              leftSection={<IconFileCheck size={14} />}
            >
              Create Consent
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Doctor Docket ─────────────────────────────────────────

function DocketTab() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => todayDateString());

  const { data: docket, isLoading } = useQuery({
    queryKey: ["docket", selectedDate],
    queryFn: () => opdService.getDoctorDocket(selectedDate || undefined),
    enabled: Boolean(selectedDate),
  });

  const generateMutation = useMutation({
    mutationFn: (date?: string) => opdService.generateDoctorDocket(date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["docket", selectedDate] });
      notifications.show({
        title: "Docket generated",
        message: `Summary for ${selectedDate}`,
        color: "success",
      });
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to generate docket", color: "danger" });
    },
  });

  const d = docket as DoctorDocket | null | undefined;

  return (
    <Stack>
      <Group>
        <TextInput
          label="Date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.currentTarget.value)}
          style={{ width: 200 }}
        />
        <Button
          mt={24}
          size="sm"
          variant="light"
          onClick={() => generateMutation.mutate(selectedDate || undefined)}
          loading={generateMutation.isPending}
        >
          Generate / Refresh
        </Button>
      </Group>

      {isLoading ? (
        <Text size="sm" c="dimmed">
          Loading...
        </Text>
      ) : d ? (
        <Card padding="md" radius="md" withBorder>
          <Text size="lg" fw={600} mb="sm">
            Daily Docket — {d.docket_date}
          </Text>
          <Table withTableBorder>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td fw={500}>Total Patients</Table.Td>
                <Table.Td>
                  <Badge size="lg">{d.total_patients}</Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>New Patients</Table.Td>
                <Table.Td>
                  <Badge color="primary" size="lg">
                    {d.new_patients}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Follow-ups</Table.Td>
                <Table.Td>
                  <Badge color="teal" size="lg">
                    {d.follow_ups}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Referrals Made</Table.Td>
                <Table.Td>
                  <Badge color="orange" size="lg">
                    {d.referrals_made}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Procedures Done</Table.Td>
                <Table.Td>
                  <Badge color="violet" size="lg">
                    {d.procedures_done}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" mt="sm">
            Generated at: {new Date(d.generated_at).toLocaleString()}
          </Text>
        </Card>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No docket for this date. Click &quot;Generate / Refresh&quot; to create one.
        </Text>
      )}
    </Stack>
  );
}

// ── Pre-Authorization Tab ───────────────────────────────

function PreAuthTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [insurer, setInsurer] = useState("");
  const [policyNo, setPolicyNo] = useState("");
  const [procCodes, setProcCodes] = useState("");
  const [diagCodes, setDiagCodes] = useState("");
  const [selectedDiagCode, setSelectedDiagCode] = useState("");
  const [estCost, setEstCost] = useState("");
  const [notes, setNotes] = useState("");

  const { data: requests = [] } = useQuery({
    queryKey: ["pre-auth", patientId],
    queryFn: () => opdService.listPreAuthRequests(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePreAuthRequest) => opdService.createPreAuthRequest(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pre-auth", patientId] });
      notifications.show({
        title: "Submitted",
        message: "Pre-authorization request submitted",
        color: "success",
      });
      close();
      setInsurer("");
      setPolicyNo("");
      setProcCodes("");
      setDiagCodes("");
      setSelectedDiagCode("");
      setEstCost("");
      setNotes("");
    },
  });

  const addDiagnosisCode = (code: string) => {
    const existing = diagCodes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!existing.some((item) => item.toLowerCase() === code.toLowerCase())) {
      setDiagCodes([...existing, code].join(", "));
    }
  };

  const handleCreate = () => {
    if (!insurer.trim()) return;
    createMutation.mutate({
      patient_id: patientId,
      encounter_id: encounterId,
      insurance_provider: insurer.trim(),
      policy_number: policyNo.trim() || undefined,
      procedure_codes: procCodes.trim() ? procCodes.split(",").map((s) => s.trim()) : undefined,
      diagnosis_codes: diagCodes.trim() ? diagCodes.split(",").map((s) => s.trim()) : undefined,
      estimated_cost: estCost ? Number(estCost) : undefined,
      notes: notes.trim() || undefined,
    });
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved":
        return "success";
      case "denied":
        return "danger";
      case "submitted":
        return "primary";
      case "expired":
        return "gray";
      default:
        return "warning";
    }
  };

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
            New Pre-Auth Request
          </Button>
        </Group>
      )}

      {requests.length > 0 ? (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Insurance</Table.Th>
              <Table.Th>Policy #</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Auth #</Table.Th>
              <Table.Th>Approved Amt</Table.Th>
              <Table.Th>Valid Until</Table.Th>
              <Table.Th>Created</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(requests as PreAuthReqType[]).map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {r.insurance_provider}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.policy_number ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColor(r.status)} size="sm">
                    {r.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.auth_number ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.approved_amount ? `₹${r.approved_amount}` : "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{r.valid_until ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {new Date(r.created_at).toLocaleDateString()}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No pre-authorization requests for this patient
        </Text>
      )}

      <Modal opened={opened} onClose={close} title="New Pre-Authorization Request" size="md">
        <Stack gap="sm">
          <TextInput
            label="Insurance Provider"
            placeholder="e.g. Star Health"
            value={insurer}
            onChange={(e) => setInsurer(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Policy Number"
            placeholder="Optional"
            value={policyNo}
            onChange={(e) => setPolicyNo(e.currentTarget.value)}
          />
          <TextInput
            label="Procedure Codes"
            placeholder="Comma-separated"
            value={procCodes}
            onChange={(e) => setProcCodes(e.currentTarget.value)}
          />
          <Icd11CodeSelect
            label="Add ICD-11 diagnosis"
            value={selectedDiagCode || null}
            onChange={(value) => {
              setSelectedDiagCode(value ?? "");
              if (value) addDiagnosisCode(value);
            }}
          />
          <TextInput
            label="Diagnosis codes"
            placeholder="ICD-11 codes selected for claim/pre-auth"
            value={diagCodes}
            onChange={(e) => setDiagCodes(e.currentTarget.value)}
          />
          <TextInput
            label="Estimated Cost (₹)"
            placeholder="Optional"
            value={estCost}
            onChange={(e) => setEstCost(e.currentTarget.value)}
          />
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!insurer.trim()}
            >
              Submit Request
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Wait Time Badge (queue estimate)
// ══════════════════════════════════════════════════════════

// ── Referral Tracking Sub-View ─────────────────────────

function ReferralTrackingTab() {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["opd-referral-tracking", filterStatus],
    queryFn: () =>
      opdService.opdReferralTracking(filterStatus ? { status: filterStatus } : undefined),
  });

  const refStatusColors: Record<string, string> = {
    pending: "warning",
    accepted: "primary",
    declined: "danger",
    completed: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "patient_id",
      label: "Patient ID",
      render: (row: ReferralWithNames) => <Text size="sm">{row.patient_id.slice(0, 8)}</Text>,
    },
    {
      key: "from_department_name",
      label: "From Dept",
      render: (row: ReferralWithNames) => (
        <Text size="sm">{row.from_department_name ?? row.from_department_id.slice(0, 8)}</Text>
      ),
    },
    {
      key: "to_department_name",
      label: "To Dept",
      render: (row: ReferralWithNames) => (
        <Text size="sm">{row.to_department_name ?? row.to_department_id.slice(0, 8)}</Text>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: ReferralWithNames) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: ReferralWithNames) => (
        <Badge color={refStatusColors[row.status] ?? "slate"} variant="filled" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "urgency",
      label: "Urgency",
      render: (row: ReferralWithNames) => <Badge variant="light">{row.urgency}</Badge>,
    },
    {
      key: "responded_at",
      label: "Responded",
      render: (row: ReferralWithNames) => (
        <Text size="sm">
          {row.responded_at ? new Date(row.responded_at).toLocaleString() : "---"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group mb="md">
        <Select
          placeholder="Filter by status"
          data={[
            { value: "pending", label: "Pending" },
            { value: "accepted", label: "Accepted" },
            { value: "declined", label: "Declined" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={180}
        />
      </Group>
      <DataTable columns={columns} data={referrals} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ── Follow-up Compliance Sub-View ──────────────────────

function FollowupComplianceTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["opd-followup-compliance"],
    queryFn: () => opdService.opdFollowupCompliance(),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row: FollowupComplianceRow) => (
        <Text size="sm" fw={500}>
          {row.patient_name}
        </Text>
      ),
    },
    {
      key: "department",
      label: "Department",
      render: (row: FollowupComplianceRow) => <Text size="sm">{row.department}</Text>,
    },
    {
      key: "last_visit_date",
      label: "Last Visit",
      render: (row: FollowupComplianceRow) => (
        <Text size="sm">{new Date(row.last_visit_date).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "follow_up_date",
      label: "Scheduled Follow-up",
      render: (row: FollowupComplianceRow) => (
        <Text size="sm">{new Date(row.follow_up_date).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "days_overdue",
      label: "Days Overdue",
      render: (row: FollowupComplianceRow) => (
        <Badge
          color={row.days_overdue > 14 ? "danger" : row.days_overdue > 7 ? "orange" : "warning"}
          variant="filled"
          size="sm"
        >
          {row.days_overdue} days
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Patients with overdue follow-up appointments
      </Text>
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row) => `${row.patient_id}-${row.follow_up_date}`}
      />
    </Stack>
  );
}

function WaitTimeBadge({ departmentId, doctorId }: { departmentId?: string; doctorId?: string }) {
  const { data: estimate } = useQuery({
    queryKey: ["wait-estimate", departmentId, doctorId],
    queryFn: () => opdService.getWaitEstimate({ department_id: departmentId, doctor_id: doctorId }),
    refetchInterval: 60_000,
  });

  if (!estimate || estimate.queue_position === 0) return null;

  return (
    <Badge size="lg" variant="light" color="orange" radius="sm">
      ~{estimate.estimated_minutes} min wait ({estimate.queue_position} in queue)
    </Badge>
  );
}

// ══════════════════════════════════════════════════════════
//  Admit to IPD Modal
// ══════════════════════════════════════════════════════════

function AdmitToIpdButton({
  encounterId,
  patientName,
}: {
  encounterId: string;
  patientName: string;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const [deptId, setDeptId] = useState<string | null>(null);
  const [wardId, setWardId] = useState<string | null>(null);
  const [bedId, setBedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
  });

  const { data: beds = [] } = useQuery({
    queryKey: ["available-beds", wardId],
    queryFn: () => opdService.listAvailableBeds(wardId ? { ward_id: wardId } : undefined),
    enabled: opened,
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
  const bedOptions = (beds as AvailableBed[]).map((b) => ({
    value: b.bed_id,
    label: `${b.bed_number}${b.ward_name ? ` (${b.ward_name})` : ""}${b.is_isolation ? " [Isolation]" : ""}`,
  }));

  const admitMutation = useMutation({
    mutationFn: (data: AdmitFromOpdRequest) => opdService.admitFromOpd(encounterId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      notifications.show({
        title: "Patient admitted to IPD",
        message: `${patientName} admitted. ${result.vitals_copied} vitals, ${result.diagnoses_copied} diagnoses, ${result.prescriptions_copied} prescriptions copied.`,
        color: "success",
      });
      close();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to admit patient", color: "danger" });
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
      <Button
        variant="light"
        color="teal"
        size="xs"
        leftSection={<IconMedicalCross size={14} />}
        onClick={open}
      >
        Admit to IPD
      </Button>
      <Modal opened={opened} onClose={close} title={`Admit ${patientName} to IPD`} size="md">
        <Stack gap="sm">
          <Select
            label="Department"
            placeholder="Select department"
            data={deptOptions}
            value={deptId}
            onChange={setDeptId}
            searchable
            required
          />
          <Select
            label="Ward"
            placeholder="Select ward (optional)"
            data={wardOptions}
            value={wardId}
            onChange={(val) => {
              setWardId(val);
              setBedId(null);
            }}
            searchable
            clearable
          />
          <Select
            label="Bed"
            placeholder="Select available bed"
            data={bedOptions}
            value={bedId}
            onChange={setBedId}
            searchable
            clearable
            description={`${bedOptions.length} bed(s) available`}
          />
          <Textarea
            label="Notes"
            placeholder="Admission notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>
              Cancel
            </Button>
            <Button
              color="teal"
              onClick={handleAdmit}
              loading={admitMutation.isPending}
              disabled={!deptId}
            >
              Admit Patient
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

function GroupAppointmentModal({ patientId }: { patientId: string }) {
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
      notifications.show({
        title: "Group appointment booked",
        message: `${result.length} appointments created`,
        color: "success",
      });
      close();
      setRows([createGroupSlotRow(), createGroupSlotRow()]);
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to book group appointment",
        color: "danger",
      });
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
      <Button variant="light" size="xs" leftSection={<IconUsers size={14} />} onClick={open}>
        Group Appointment
      </Button>
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
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    size="sm"
                    onClick={() => removeRow(idx)}
                    mt={18}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Card>
          ))}
          <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={addRow}>
            Add Another Doctor
          </Button>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>
              Cancel
            </Button>
            <Button
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
