// OPD workflow & patient-history tabs, extracted from opd.tsx (split phase 1).

import { zodResolver } from "@hookform/resolvers/zod";
import { LineChart } from "@mantine/charts";
import {
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Timeline,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type OpdMedicalCertificateFormInput,
  opdFeedbackFormSchema,
  opdMedicalCertificateFormSchema,
  opdProcedureConsentFormSchema,
  opdProcedureOrderFormSchema,
  opdReminderFormSchema,
} from "@medbrains/schemas";
import {
  type CreatePreAuthRequest,
  type CreateReferralRequest,
  type DepartmentRow,
  type DoctorDocket,
  type DuplicateOrderInfo,
  type FollowupComplianceRow,
  type MedicalCertificate,
  PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  type PatientFeedback,
  type PatientReminder,
  type PatientVisitRow,
  type PreAuthorizationRequest as PreAuthReqType,
  type PrescriptionHistoryItem,
  type ProcedureCatalog,
  type ProcedureConsent,
  type ProcedureOrderWithName,
  type ReferralUrgency,
  type ReferralWithNames,
  type VitalHistoryPoint,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCertificate,
  IconCheck,
  IconClock,
  IconFileCheck,
  IconFlask,
  IconMedicalCross,
  IconPill,
  IconPlus,
  IconStar,
  IconStethoscope,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { type Column, DataTable, OperationalSignal, useClinicalEmit } from "@/components";
import { Icd11CodeSelect } from "@/components/Clinical/Icd11CodeSelect";
import { PatientNameCell } from "@/components/PatientNameCell";
import { Alert, Badge, type BadgeTone, Button, IconButton, Table } from "@/components/ui";
import {
  DEFAULT_OPD_CONSENT_FORM_VALUES,
  DEFAULT_OPD_FEEDBACK_FORM_VALUES,
  DEFAULT_OPD_MEDICAL_CERTIFICATE_FORM_VALUES,
  DEFAULT_OPD_PROCEDURE_ORDER_FORM_VALUES,
  DEFAULT_OPD_REMINDER_FORM_VALUES,
  OPD_CERTIFICATE_TYPE_OPTIONS,
  OPD_CONSENT_TYPE_OPTIONS,
  OPD_PROCEDURE_PRIORITY_OPTIONS,
  OPD_RATING_OPTIONS,
  OPD_REMINDER_PRIORITY_OPTIONS,
  OPD_REMINDER_TYPE_OPTIONS,
  toCreateConsentRequest,
  toCreateFeedbackRequest,
  toCreateMedicalCertificateRequest,
  toCreateProcedureOrderRequest,
  toCreateReminderRequest,
} from "@/forms/opd.form";
import { todayDateString } from "@/lib/date-utils";
import { statusColor } from "@/lib/status-colors";
import { opdService } from "@/services/opd.service";

const referralUrgencyValues = [
  "routine",
  "urgent",
  "emergency",
] as const satisfies readonly ReferralUrgency[];

function toReferralUrgency(value: string | null): ReferralUrgency | undefined {
  return referralUrgencyValues.find((candidate) => candidate === value);
}

// ── Rx History ──────────────────────────────────────────

export function RxHistoryTab({ patientId }: { patientId: string }) {
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
            <Badge size="xs">{new Date(h.encounter_date).toLocaleDateString()}</Badge>
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
                    <Badge size="xs">{item.frequency}</Badge>
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

function defaultCertificateFormValues(): OpdMedicalCertificateFormInput {
  return {
    ...DEFAULT_OPD_MEDICAL_CERTIFICATE_FORM_VALUES,
    issued_date: todayDateString(),
  };
}

export function CertificatesTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(opdMedicalCertificateFormSchema),
    defaultValues: defaultCertificateFormValues(),
    mode: "onTouched",
  });
  const certificateType = watch("certificate_type");

  const { data: certificates = [], isLoading } = useQuery<MedicalCertificate[]>({
    queryKey: ["patient-certificates", patientId],
    queryFn: () => opdService.listCertificates(patientId),
  });

  const createMutation = useMutation({
    mutationFn: opdService.createCertificate,
    onSuccess: (certificate) => {
      emit("opd.certificate.created", {
        certificate_id: certificate.id,
        certificate_number: certificate.certificate_number,
        certificate_type: certificate.certificate_type,
        encounter_id: certificate.encounter_id,
        issued_date: certificate.issued_date,
        patient_id: certificate.patient_id,
        source_record_id: certificate.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["patient-certificates", patientId] });
      notifications.show({
        title: "Certificate created",
        message: "Medical certificate generated",
        color: "success",
      });
      closeCreate();
      reset(defaultCertificateFormValues());
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to create certificate",
        color: "danger",
      });
    },
  });

  const openCertificateForm = () => {
    reset(defaultCertificateFormValues());
    openCreate();
  };

  const closeCertificateForm = () => {
    closeCreate();
    reset(defaultCertificateFormValues());
  };

  const handleCreate = handleSubmit((values) => {
    createMutation.mutate(toCreateMedicalCertificateRequest(values, patientId, encounterId));
  });

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
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={openCertificateForm}
          >
            New Certificate
          </Button>
        </Group>
      )}

      {certificates.map((cert) => (
        <Card key={cert.id} padding="sm" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Group gap={8}>
              <IconCertificate size={16} color="var(--mantine-color-blue-5)" />
              <Badge size="sm">{cert.certificate_type.replace(/_/g, " ")}</Badge>
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
      <Modal
        opened={createOpen}
        onClose={closeCertificateForm}
        title="New Medical Certificate"
        size="md"
      >
        <Stack gap="sm">
          <Controller
            control={control}
            name="certificate_type"
            render={({ field }) => (
              <Select
                label="Certificate Type"
                placeholder="Select type"
                data={OPD_CERTIFICATE_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) =>
                  field.onChange(
                    value ?? DEFAULT_OPD_MEDICAL_CERTIFICATE_FORM_VALUES.certificate_type,
                  )
                }
                error={errors.certificate_type?.message}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="issued_date"
            render={({ field }) => (
              <TextInput
                label="Issued Date"
                type="date"
                error={errors.issued_date?.message}
                required
                {...field}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="valid_from"
              render={({ field }) => (
                <TextInput
                  label="Valid From"
                  type="date"
                  error={errors.valid_from?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={control}
              name="valid_to"
              render={({ field }) => (
                <TextInput
                  label="Valid To"
                  type="date"
                  error={errors.valid_to?.message}
                  {...field}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="diagnosis"
            render={({ field }) => (
              <Textarea
                label="Diagnosis"
                placeholder="Primary diagnosis for certificate"
                error={errors.diagnosis?.message}
                autosize
                minRows={2}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="remarks"
            render={({ field }) => (
              <Textarea
                label="Remarks"
                placeholder="Additional remarks or instructions"
                error={errors.remarks?.message}
                autosize
                minRows={2}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={closeCertificateForm}>
              Cancel
            </Button>
            <Button
              tone="primary"
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!certificateType}
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

export function ChartsTab({ patientId }: { patientId: string }) {
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

export function TimelineTab({ patientId }: { patientId: string }) {
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
                  <Badge key={c} size="xs" variant="dot" tone="primary">
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

const PROC_STATUS_COLORS: Record<string, BadgeTone> = {
  ordered: "primary",
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

// Maps the Mantine color strings returned by the shared `statusColor` helper
// to the ui Badge `tone` vocabulary at the call site (helper feeds other
// components, so it is left untouched).
const STATUS_COLOR_TO_BADGE_TONE: Record<string, BadgeTone> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  primary: "primary",
  neutral: "neutral",
  green: "success",
  teal: "success",
  lime: "success",
  orange: "warning",
  yellow: "warning",
  red: "danger",
  blue: "info",
  cyan: "info",
  violet: "accent",
  grape: "accent",
  indigo: "accent",
  pink: "accent",
  slate: "neutral",
  gray: "neutral",
  dark: "neutral",
};

function statusColorToBadgeTone(color: string): BadgeTone {
  return STATUS_COLOR_TO_BADGE_TONE[color] ?? "neutral";
}

export function ProceduresTab({
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
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["procedure-orders", encounterId] });
      notifications.show({
        title: "Procedure ordered",
        message: "Procedure order placed",
        color: "success",
      });
      emit("order.created", {
        encounter_id: result.encounter_id,
        order_id: result.id,
        order_type: "procedure",
        patient_id: result.patient_id,
        priority: result.priority,
        procedure_id: result.procedure_id,
        procedure_name: result.procedure_name,
      });
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
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
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
                tone="warning"
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
                tone="ghost"
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
                tone="primary"
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
                  <Badge size="xs" tone={statusColorToBadgeTone(statusColor(order.priority))}>
                    {order.priority.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" tone={PROC_STATUS_COLORS[order.status] ?? "neutral"}>
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
                      <IconButton
                        tone="danger"
                        size="xs"
                        onClick={() => cancelMutation.mutate(order.id)}
                        aria-label="Cancel"
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
          No procedures ordered yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Referrals Tab ───────────────────────────────────────

const URGENCY_COLORS: Record<string, BadgeTone> = {
  routine: "primary",
  urgent: "warning",
  emergency: "danger",
};

const REFERRAL_STATUS_COLORS: Record<string, BadgeTone> = {
  pending: "warning",
  accepted: "success",
  declined: "danger",
  completed: "success",
  cancelled: "neutral",
};

export function ReferralsTab({
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
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={openCreate}
          >
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
              <Badge size="xs" tone={URGENCY_COLORS[ref.urgency] ?? "neutral"}>
                {ref.urgency}
              </Badge>
              <Badge size="xs" tone={REFERRAL_STATUS_COLORS[ref.status] ?? "neutral"}>
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
            <Alert tone="success" mt="xs" title="Response">
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
            <Button tone="ghost" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              tone="primary"
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

export function RemindersTab({
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

  const priorityColors: Record<string, BadgeTone> = {
    low: "neutral",
    normal: "primary",
    high: "warning",
    urgent: "danger",
  };

  const statusColors: Record<string, BadgeTone> = {
    pending: "primary",
    sent: "info",
    acknowledged: "success",
    completed: "success",
    cancelled: "neutral",
    overdue: "danger",
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
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
                  <Badge size="sm">{r.reminder_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>{r.reminder_date}</Table.Td>
                <Table.Td>
                  <Badge tone={priorityColors[r.priority] ?? "primary"} size="sm">
                    {r.priority}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge tone={statusColors[r.status] ?? "neutral"} size="sm">
                    {r.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {r.status === "pending" && canUpdate && (
                    <Group gap={4}>
                      <Tooltip label="Complete">
                        <IconButton
                          size="sm"
                          tone="success"
                          onClick={() => completeMutation.mutate(r.id)}
                          aria-label="Complete"
                        >
                          <IconCheck size={14} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip label="Cancel">
                        <IconButton
                          size="sm"
                          tone="danger"
                          onClick={() => cancelMutation.mutate(r.id)}
                          aria-label="Cancel"
                        >
                          <IconX size={14} />
                        </IconButton>
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
            <Button tone="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              tone="primary"
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

export function FeedbackTab({
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

  const ratingColor = (val: number | null): BadgeTone => {
    if (!val) return "neutral";
    if (val >= 4) return "success";
    if (val >= 3) return "warning";
    return "danger";
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
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
                {fb.is_anonymous && <Badge size="xs">Anonymous</Badge>}
              </Group>
              <Group gap="md" mb="xs">
                {fb.rating != null && (
                  <Badge
                    tone={ratingColor(fb.rating)}
                    size="sm"
                    leftSection={<IconStar size={10} />}
                  >
                    Overall: {fb.rating}/5
                  </Badge>
                )}
                {fb.wait_time_rating != null && (
                  <Badge tone={ratingColor(fb.wait_time_rating)} size="sm">
                    Wait: {fb.wait_time_rating}/5
                  </Badge>
                )}
                {fb.staff_rating != null && (
                  <Badge tone={ratingColor(fb.staff_rating)} size="sm">
                    Staff: {fb.staff_rating}/5
                  </Badge>
                )}
                {fb.cleanliness_rating != null && (
                  <Badge tone={ratingColor(fb.cleanliness_rating)} size="sm">
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
            <Button tone="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button tone="primary" onClick={handleCreate} loading={createMutation.isPending}>
              Submit Feedback
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Consents ──────────────────────────────────────────────

export function ConsentsTab({
  patientId,
  encounterId,
  canUpdate,
}: {
  patientId: string;
  encounterId: string;
  canUpdate: boolean;
}) {
  const emit = useClinicalEmit();
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
    onSuccess: (consent) => {
      emit("opd.consent.signed", {
        consent_id: consent.id,
        consent_type: consent.consent_type,
        encounter_id: consent.encounter_id,
        patient_id: consent.patient_id,
        procedure_order_id: consent.procedure_order_id,
        signed_at: consent.signed_at,
        source_record_id: consent.id,
        status: consent.status,
      });
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

  const consentStatusColors: Record<string, BadgeTone> = {
    pending: "warning",
    signed: "success",
    refused: "danger",
    withdrawn: "neutral",
    expired: "warning",
  };

  return (
    <Stack>
      {canUpdate && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.open}
          >
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
                  <Badge size="sm">{c.consent_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge tone={consentStatusColors[c.status] ?? "neutral"} size="sm">
                    {c.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{c.consented_by_name ?? "—"}</Table.Td>
                <Table.Td>{new Date(c.created_at).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  {c.status === "pending" && canUpdate && (
                    <Tooltip label="Sign Consent">
                      <IconButton
                        size="sm"
                        tone="success"
                        onClick={() => signMutation.mutate(c.id)}
                        aria-label="Sign Consent"
                      >
                        <IconFileCheck size={14} />
                      </IconButton>
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
            <Button tone="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              tone="primary"
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

export function DocketTab() {
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
          tone="secondary"
          mt={24}
          size="sm"
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
                  <Badge tone="primary" size="lg">
                    {d.new_patients}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Follow-ups</Table.Td>
                <Table.Td>
                  <Badge tone="success" size="lg">
                    {d.follow_ups}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Referrals Made</Table.Td>
                <Table.Td>
                  <Badge tone="warning" size="lg">
                    {d.referrals_made}
                  </Badge>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td fw={500}>Procedures Done</Table.Td>
                <Table.Td>
                  <Badge tone="accent" size="lg">
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

export function PreAuthTab({
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

  const statusColor = (s: string): BadgeTone => {
    switch (s) {
      case "approved":
        return "success";
      case "denied":
        return "danger";
      case "submitted":
        return "primary";
      case "expired":
        return "neutral";
      default:
        return "warning";
    }
  };

  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button tone="primary" size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
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
                  <Badge tone={statusColor(r.status)} size="sm">
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
            <Button tone="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              tone="primary"
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

export function ReferralTrackingTab() {
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["opd-referral-tracking", filterStatus],
    queryFn: () =>
      opdService.opdReferralTracking(filterStatus ? { status: filterStatus } : undefined),
  });

  const refStatusColors: Record<string, BadgeTone> = {
    pending: "warning",
    accepted: "primary",
    declined: "danger",
    completed: "success",
    cancelled: "danger",
  };

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: ReferralWithNames) => row.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (row: ReferralWithNames) => <PatientNameCell patientId={row.patient_id} />,
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
        <Badge tone={refStatusColors[row.status] ?? "neutral"} variant="filled" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "urgency",
      label: "Urgency",
      render: (row: ReferralWithNames) => <Badge>{row.urgency}</Badge>,
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
  ] satisfies Column<ReferralWithNames>[];

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

export function FollowupComplianceTab() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["opd-followup-compliance"],
    queryFn: () => opdService.opdFollowupCompliance(),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      fieldAccessKeys: PATIENT_NAME_FIELD_ACCESS_KEYS,
      accessor: (row: FollowupComplianceRow) => row.patient_name,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
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
          tone={row.days_overdue > 14 ? "danger" : row.days_overdue > 7 ? "warning" : "warning"}
          variant="filled"
          size="sm"
        >
          {row.days_overdue} days
        </Badge>
      ),
    },
  ] satisfies Column<FollowupComplianceRow>[];

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

export function WaitTimeBadge({
  departmentId,
  doctorId,
}: {
  departmentId?: string;
  doctorId?: string;
}) {
  const { t } = useTranslation("opd");
  const { data: estimate } = useQuery({
    queryKey: ["wait-estimate", departmentId, doctorId],
    queryFn: () => opdService.getWaitEstimate({ department_id: departmentId, doctor_id: doctorId }),
    refetchInterval: 60_000,
  });

  if (!estimate || estimate.queue_position === 0) return null;

  return (
    <OperationalSignal
      icon={IconClock}
      label={t("waitEstimate.position", { position: estimate.queue_position })}
      shape="diamond"
      tone="blocked"
      value={t("waitEstimate.minutes", { minutes: estimate.estimated_minutes })}
    />
  );
}
