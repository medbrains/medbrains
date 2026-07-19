import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Grid,
  Group,
  Loader,
  Modal,
  Progress,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { PatientMergeFormInput } from "@medbrains/schemas";
import { patientMergeFormSchema } from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  CampRegistration,
  ClinicalEventName,
  ClinicalJourneyContext,
  DrugTimelineWithLabsResponse,
  ErVisit,
  MedicationTimelineEvent,
  Patient,
  PatientInvoiceRow,
  PatientMergeHistory,
  PrescriptionHistoryItem,
  RegistrationCardPrintData,
  TreatmentSummaryResponse,
} from "@medbrains/types";
import {
  activeBillingInvoiceIdForJourney,
  billingInvoiceHasReceivedPayment,
  billingInvoiceIsFinalized,
  billingInvoiceRequiresFollowUp,
  hasReviewedPatientPharmacyPrescriptionForJourney,
  P,
} from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertTriangle,
  IconCalendar,
  IconEye,
  IconFile,
  IconFlask,
  IconGitMerge,
  IconLink,
  IconPill,
  IconPrinter,
  IconReceipt,
  IconReportMedical,
  IconStethoscope,
  IconTimeline,
  IconUser,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AskAiButton } from "@/components/ai";
import { ClinicalEventProvider, useClinicalEmit } from "@/components/ClinicalEventProvider";
import { NotesPanel } from "@/components/crdt/NotesPanel";
import {
  type OrderBasketTab,
  OrderBasketWorkspace,
} from "@/components/OrderBasket/OrderBasketWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { ActivePackagesSection } from "@/components/Patient/ActivePackagesSection";
import { ClinicalTimelineTab } from "@/components/Patient/ClinicalTimelineTab";
import { PatientAccessLogSection } from "@/components/Patient/PatientAccessLogSection";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { deriveCampJourneyCompletedEvents } from "@/components/Patient/patient-journey-events";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { ShareDrawer } from "@/components/Sharing/ShareDrawer";
import { Alert, Badge, type BadgeTone, Button, Table } from "@/components/ui";
import {
  DEFAULT_PATIENT_MERGE_FORM_VALUES,
  toMergePatientRequest,
} from "@/forms/patient-detail.form";
import { useHashTabs } from "@/hooks/useHashTabs";
import { usePatientAssistantContext } from "@/hooks/usePatientAssistantContext";
import { usePatientContext } from "@/hooks/usePatientContext";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { patientDetailService } from "@/services/patientDetail.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";
import { AllergiesTab } from "./patient-detail/allergies-tab";
import { AppointmentsTab } from "./patient-detail/appointments-tab";
import { BillingTab } from "./patient-detail/billing-tab";
import { DetailDocumentsTab } from "./patient-detail/documents-tab";
import { DetailFamilyLinksTab } from "./patient-detail/family-links-tab";
import { ImagingTab } from "./patient-detail/imaging-tab";
import { LabOrdersTab } from "./patient-detail/lab-orders-tab";
import { OverviewTab } from "./patient-detail/overview-tab";
import { PrescriptionsTab } from "./patient-detail/prescriptions-tab";
import { age, escapeHtml, formatDate } from "./patient-detail/shared";
import { VisitsTab } from "./patient-detail/visits-tab";
import classes from "./patient-detail.module.scss";
import {
  isPatientDetailTabValue,
  PATIENT_DETAIL_TAB_VALUES,
  type PatientDetailTabValue,
  patientDetailJourneyContext,
  patientDetailOrderBasketRoute,
  patientDetailOrderBasketTabFromSearchParams,
  patientDetailTabForOrderBasket,
  patientDetailWorkspaceTabRoute,
} from "./patient-detail-workspace";

// ── Helpers ────────────────────────────────────────────────

const PATIENT_CARD_PRINT_COPIES = PRINT_COPY_PACKETS.patientCard;
const ACTIVE_ER_VISIT_STATUSES = new Set<ErVisit["status"]>([
  "registered",
  "triaged",
  "in_treatment",
  "observation",
]);

// ── Overview Tab ───────────────────────────────────────────

function MergeTab({ patient }: { patient: Patient }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<Patient | null>(null);
  const [confirmOpen, confirmHandlers] = useDisclosure(false);
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PatientMergeFormInput>({
    resolver: zodResolver(patientMergeFormSchema),
    defaultValues: DEFAULT_PATIENT_MERGE_FORM_VALUES,
  });

  const { data: mergeHistory = [], isLoading } = useQuery<PatientMergeHistory[]>({
    queryKey: ["patient-merge-history", patient.id],
    queryFn: () => patientDetailService.listMergeHistory(patient.id),
  });

  const mergeMutation = useMutation({
    mutationFn: (values: PatientMergeFormInput) =>
      patientDetailService.mergePatients(toMergePatientRequest(patient.id, values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-merge-history", patient.id] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      notifications.show({ title: "Merged", message: "Patient records merged", color: "success" });
      confirmHandlers.close();
      setSelectedTarget(null);
      reset(DEFAULT_PATIENT_MERGE_FORM_VALUES);
    },
  });

  const unmergeMutation = useMutation({
    mutationFn: (historyId: string) => patientDetailService.unmergePatient(historyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-merge-history", patient.id] });
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      notifications.show({
        title: "Unmerged",
        message: "Patient records separated",
        color: "success",
      });
    },
  });

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="lg">
      {patient.is_merged && (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          This patient has been merged into another record.
        </Alert>
      )}

      {/* Merge History */}
      <Card withBorder>
        <Title order={5} mb="sm">
          Merge History
        </Title>
        {mergeHistory.length === 0 ? (
          <Text size="sm" c="dimmed">
            No merge history
          </Text>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Surviving</Table.Th>
                <Table.Th>Merged</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Status</Table.Th>
                {canUpdate && <Table.Th w={60} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {mergeHistory.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td>
                    <Text size="xs">{formatDate(h.created_at)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <PatientNameCell patientId={h.surviving_patient_id} showUhid={false} />
                  </Table.Td>
                  <Table.Td>
                    <PatientNameCell patientId={h.merged_patient_id} showUhid={false} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{h.merge_reason}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" tone={h.unmerged_at ? "neutral" : "success"}>
                      {h.unmerged_at ? "Unmerged" : "Active"}
                    </Badge>
                  </Table.Td>
                  {canUpdate && (
                    <Table.Td>
                      {!h.unmerged_at && (
                        <Button
                          tone="secondary"
                          size="xs"
                          onClick={() => unmergeMutation.mutate(h.id)}
                        >
                          Undo
                        </Button>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Merge Another Patient Into This One */}
      {canUpdate && !patient.is_merged && (
        <Card withBorder>
          <Title order={5} mb="sm">
            Merge Duplicate Into This Patient
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            Search for a duplicate patient record and merge it into this one. The duplicate will be
            deactivated.
          </Text>
          <PatientSearchSelect
            value={selectedTarget?.id ?? ""}
            onChange={(id) => {
              if (!id) {
                setSelectedTarget(null);
                setValue("merged_patient_id", "", { shouldValidate: true });
                return;
              }
              patientDetailService
                .getPatient(id)
                .then((p) => {
                  setSelectedTarget(p);
                  setValue("merged_patient_id", p.id, { shouldValidate: true });
                })
                .catch(() => {
                  setSelectedTarget(null);
                  setValue("merged_patient_id", "", { shouldValidate: true });
                });
            }}
            label="Search duplicate patient"
            placeholder="Search by UHID, name or phone..."
          />
          {errors.merged_patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.merged_patient_id.message}
            </Text>
          )}
          {selectedTarget && (
            <Stack
              component="form"
              gap="sm"
              mt="md"
              onSubmit={handleSubmit(() => confirmHandlers.open())}
            >
              {/* Side-by-side comparison */}
              <Card withBorder bg="var(--fc-panel, #f7f8f6)" p="md">
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  mb="sm"
                  tt="uppercase"
                  ff="var(--font-mono, monospace)"
                  style={{ letterSpacing: "0.14em" }}
                >
                  Compare Before Merging
                </Text>
                <SimpleGrid cols={2}>
                  <Stack gap={4}>
                    <Badge tone="success" size="sm" mb={4}>
                      Surviving Record (this patient)
                    </Badge>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        UHID
                      </Text>
                      <Text size="sm" fw={600}>
                        {patient.uhid}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Name
                      </Text>
                      <Text size="sm">
                        {patient.first_name} {patient.last_name}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Phone
                      </Text>
                      <Text size="sm">{patient.phone ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        DOB
                      </Text>
                      <Text size="sm">{patient.date_of_birth ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Gender
                      </Text>
                      <Text size="sm">{patient.gender}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Category
                      </Text>
                      <Badge size="xs">{patient.category}</Badge>
                    </Group>
                  </Stack>
                  <Stack gap={4}>
                    <Badge tone="warning" size="sm" mb={4}>
                      Duplicate (will be deactivated)
                    </Badge>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        UHID
                      </Text>
                      <Text size="sm" fw={600}>
                        {selectedTarget.uhid}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Name
                      </Text>
                      <Text size="sm">
                        {selectedTarget.first_name} {selectedTarget.last_name}
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Phone
                      </Text>
                      <Text size="sm">{selectedTarget.phone ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        DOB
                      </Text>
                      <Text size="sm">{selectedTarget.date_of_birth ?? "—"}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Gender
                      </Text>
                      <Text size="sm">{selectedTarget.gender}</Text>
                    </Group>
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" w={60}>
                        Category
                      </Text>
                      <Badge size="xs">{selectedTarget.category}</Badge>
                    </Group>
                  </Stack>
                </SimpleGrid>
              </Card>

              <Alert tone="warning">
                All visits, prescriptions, lab orders, and billing records from{" "}
                <b>{selectedTarget.uhid}</b> will be transferred to <b>{patient.uhid}</b>.
              </Alert>
              <Controller
                name="merge_reason"
                control={control}
                render={({ field }) => (
                  <Textarea
                    label="Merge Reason"
                    placeholder="Why are these records being merged?"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.merge_reason?.message}
                    required
                  />
                )}
              />
              <Group justify="flex-end">
                <Button
                  tone="ghost"
                  type="button"
                  onClick={() => {
                    setSelectedTarget(null);
                    reset(DEFAULT_PATIENT_MERGE_FORM_VALUES);
                  }}
                >
                  Cancel
                </Button>
                <Button tone="primary" type="submit">
                  Merge Records
                </Button>
              </Group>
            </Stack>
          )}
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal opened={confirmOpen} onClose={confirmHandlers.close} title="Confirm Merge">
        <Alert tone="danger" icon={<IconAlertTriangle size={16} />} mb="md">
          This will deactivate {selectedTarget?.uhid} and merge its data into {patient.uhid}. This
          can be undone later.
        </Alert>
        <Group justify="flex-end">
          <Button tone="ghost" onClick={confirmHandlers.close}>
            Cancel
          </Button>
          <Button
            tone="danger"
            loading={mergeMutation.isPending}
            onClick={() => {
              if (selectedTarget) {
                mergeMutation.mutate(getValues());
              }
            }}
          >
            Confirm Merge
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

// ── Print Patient Card ─────────────────────────────────────

function registrationCardValue(value: string | null | undefined, fallback = "Not recorded") {
  return escapeHtml(value?.trim() || fallback);
}

function registrationAllergySummary(allergies: readonly string[]) {
  if (allergies.length === 0) {
    return "None recorded";
  }
  return allergies.map((allergy) => escapeHtml(allergy)).join(", ");
}

function buildRegistrationCardContent(data: RegistrationCardPrintData) {
  const hospitalName = registrationCardValue(data.hospital_name, "MedBrains HMS");
  const printedAt = new Date().toLocaleString("en-IN");

  return `
    <section class="registration-print">
      <header class="registration-header">
        <div>
          <div class="hospital-name">${hospitalName}</div>
          <div class="document-title">Registration slip and patient card</div>
        </div>
        <div class="printed-at">Printed ${escapeHtml(printedAt)}</div>
      </header>

      <section class="patient-card">
        <div>
          <div class="uhid">${registrationCardValue(data.uhid)}</div>
          <div class="patient-name">${registrationCardValue(data.patient_name)}</div>
          <div class="identity-line">
            ${registrationCardValue(data.gender)} | ${registrationCardValue(data.age)} | DOB ${registrationCardValue(data.date_of_birth)}
          </div>
        </div>
        <div class="qr-block">
          <div class="qr-label">QR</div>
          <div class="qr-code">${registrationCardValue(data.qr_code_data)}</div>
        </div>
      </section>

      <dl class="registration-details">
        <dt>UHID</dt><dd>${registrationCardValue(data.uhid)}</dd>
        <dt>Phone</dt><dd>${registrationCardValue(data.phone)}</dd>
        <dt>Email</dt><dd>${registrationCardValue(data.email)}</dd>
        <dt>Blood group</dt><dd>${registrationCardValue(data.blood_group)}</dd>
        <dt>Registered on</dt><dd>${registrationCardValue(data.registration_date)}</dd>
        <dt>Address</dt><dd>${registrationCardValue(data.address)}</dd>
        <dt>Emergency contact</dt>
        <dd>
          ${registrationCardValue(data.emergency_contact_name)}
          ${data.emergency_contact_phone ? `(${registrationCardValue(data.emergency_contact_phone)})` : ""}
        </dd>
        <dt>Allergies</dt><dd>${registrationAllergySummary(data.allergies)}</dd>
      </dl>

      <footer class="registration-footer">
        Verify patient identity with UHID plus a second identifier before clinical service or billing.
      </footer>
    </section>
  `;
}

function writeRegistrationCardPrintPacket(win: Window, data: RegistrationCardPrintData) {
  const content = buildRegistrationCardContent(data);
  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Patient Card ${registrationCardValue(data.uhid)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 16px; color: #101918; font-size: 12px; }
          .registration-print { border: 1px solid #cfd8dc; padding: 14px; border-radius: 6px; }
          .registration-header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 12px; }
          .hospital-name { font-size: 17px; font-weight: 700; }
          .document-title { color: #475569; margin-top: 2px; }
          .printed-at { color: #64748b; font-size: 11px; white-space: nowrap; }
          .patient-card { border: 2px solid #1f2937; border-radius: 8px; padding: 14px; display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
          .uhid { font-size: 20px; font-weight: 800; color: #0f6b75; letter-spacing: 0; }
          .patient-name { font-size: 16px; font-weight: 700; margin-top: 5px; }
          .identity-line { color: #475569; margin-top: 4px; }
          .qr-block { width: 112px; min-height: 82px; border: 1px dashed #94a3b8; border-radius: 6px; padding: 8px; text-align: center; overflow-wrap: anywhere; }
          .qr-label { font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
          .qr-code { font-size: 9px; color: #0f172a; }
          .registration-details { display: grid; grid-template-columns: 120px 1fr; gap: 7px 12px; margin: 0; }
          .registration-details dt { color: #475569; font-weight: 700; }
          .registration-details dd { margin: 0; }
          .registration-footer { border-top: 1px solid #cbd5e1; margin-top: 14px; padding-top: 10px; color: #475569; font-size: 11px; }
          ${copyPrintStyles()}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${buildCopyPrintHtml(content, PATIENT_CARD_PRINT_COPIES)}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  win.document.close();
}

async function handlePrintPatientCard(patientId: string): Promise<boolean> {
  const win = window.open("", "_blank", "width=520,height=720");
  if (!win) {
    notifications.show({
      title: "Print blocked",
      message: "Allow pop-ups to print the patient card packet.",
      color: "warning",
    });
    return false;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Preparing patient card</title></head>
    <body style="font-family:Arial,sans-serif;padding:20px;">Preparing patient card...</body></html>
  `);
  win.document.close();

  try {
    const data = await patientDetailService.getRegistrationCardPrintData(patientId);
    writeRegistrationCardPrintPacket(win, data);
    return true;
  } catch (error) {
    win.close();
    notifications.show({
      title: "Print failed",
      message: error instanceof Error ? error.message : "Unable to load patient card print data.",
      color: "danger",
    });
    return false;
  }
}

// ══════════════════════════════════════════════════════════
//  Chronic Care Tab — Drug-o-gram, Outcomes, Adherence
// ══════════════════════════════════════════════════════════

const TIMELINE_RANGES = [
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "all", label: "All" },
];

const EVENT_COLORS: Record<string, string> = {
  started: "#40c057",
  dose_changed: "#228be6",
  switched: "#be4bdb",
  discontinued: "#fa5252",
  resumed: "#12b886",
  held: "#fab005",
};

const ENROLLMENT_STATUS_COLORS: Record<string, BadgeTone> = {
  active: "success",
  completed: "success",
  discontinued: "warning",
  transferred: "primary",
  lost_to_followup: "danger",
  deceased: "neutral",
};

function ChronicCareTab({ patientId }: { patientId: string }) {
  const [segment, setSegment] = useState("drugogram");
  const canViewTimeline = useHasPermission(P.CHRONIC.TIMELINE_VIEW);
  const canViewOutcomes = useHasPermission(P.CHRONIC.OUTCOMES_VIEW);
  const canViewAdherence = useHasPermission(P.CHRONIC.ADHERENCE_LIST);

  return (
    <Stack gap="md" mt="md">
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        data={[
          ...(canViewTimeline ? [{ value: "drugogram", label: "Drug-o-gram" }] : []),
          ...(canViewOutcomes ? [{ value: "outcomes", label: "Outcomes & Targets" }] : []),
          ...(canViewAdherence ? [{ value: "adherence", label: "Adherence" }] : []),
        ]}
      />

      {segment === "drugogram" && canViewTimeline && <DrugOGramSegment patientId={patientId} />}
      {segment === "outcomes" && canViewOutcomes && <OutcomesSegment patientId={patientId} />}
      {segment === "adherence" && canViewAdherence && <AdherenceSegment patientId={patientId} />}
    </Stack>
  );
}

function getDateRange(range: string): { from_date?: string; to_date?: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  switch (range) {
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "6m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "1y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    case "2y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 2);
      return { from_date: d.toISOString().slice(0, 10), to_date: to };
    }
    default:
      return {};
  }
}

function DrugOGramSegment({ patientId }: { patientId: string }) {
  const [range, setRange] = useState("1y");
  const dateRange = useMemo(() => getDateRange(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["drug-timeline-labs", patientId, range],
    queryFn: () => patientDetailService.drugTimelineWithLabs(patientId, dateRange),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["interaction-alerts", patientId],
    queryFn: () => patientDetailService.listInteractionAlerts(patientId),
  });

  const activeAlerts = alerts.filter((a) => a.status === "active");

  const { data: summary } = useQuery({
    queryKey: ["treatment-summary", patientId],
    queryFn: () => patientDetailService.treatmentSummary(patientId),
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <SegmentedControl value={range} onChange={setRange} data={TIMELINE_RANGES} size="xs" />
        <Group gap="xs">
          {summary && (
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconPrinter size={14} />}
              onClick={() => printTreatmentSummary(summary)}
            >
              Print Summary
            </Button>
          )}
        </Group>
      </Group>

      {/* Polypharmacy Alerts */}
      {activeAlerts.length > 0 && (
        <Alert
          tone="danger"
          title={`${activeAlerts.length} Drug Interaction Alert(s)`}
          icon={<IconAlertTriangle size={16} />}
        >
          <Stack gap={4}>
            {activeAlerts.map((a) => (
              <Group key={a.id} gap="xs">
                <Badge
                  tone={
                    a.severity === "contraindicated"
                      ? "danger"
                      : a.severity === "major"
                        ? "warning"
                        : "warning"
                  }
                  size="sm"
                >
                  {a.severity}
                </Badge>
                <Text size="sm">
                  {a.drug_a_name} + {a.drug_b_name}
                </Text>
                {a.description && (
                  <Text size="xs" c="dimmed">
                    {a.description}
                  </Text>
                )}
              </Group>
            ))}
          </Stack>
        </Alert>
      )}

      {isLoading && <Loader size="sm" />}

      {data && <DrugSwimLane data={data} />}
    </Stack>
  );
}

function DrugSwimLane({ data }: { data: DrugTimelineWithLabsResponse }) {
  const { medication_events, active_drugs, lab_series } = data;

  if (medication_events.length === 0 && active_drugs.length === 0) {
    return <Text c="dimmed">No medication timeline events found for this period.</Text>;
  }

  // Group events by drug_name
  const drugEvents = medication_events.reduce<Record<string, MedicationTimelineEvent[]>>(
    (acc, ev) => {
      const list = acc[ev.drug_name] ?? [];
      list.push(ev);
      acc[ev.drug_name] = list;
      return acc;
    },
    {},
  );

  const drugNames = Object.keys(drugEvents).sort();

  // Calculate time range
  const allDates = medication_events.map((e) => new Date(e.effective_date).getTime());
  const minDate = allDates.length > 0 ? Math.min(...allDates) : Date.now();
  const maxDate = Math.max(Date.now(), ...allDates);
  const rangeMs = maxDate - minDate || 1;

  const ROW_HEIGHT = 36;
  const LABEL_WIDTH = 180;
  const CHART_WIDTH = 600;
  const totalHeight = drugNames.length * ROW_HEIGHT + 40;

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">
          Medication Timeline
        </Text>
        <ScrollArea>
          <svg
            width={LABEL_WIDTH + CHART_WIDTH + 20}
            height={totalHeight}
            role="img"
            aria-label="Medication timeline"
          >
            {/* Header line */}
            <line
              x1={LABEL_WIDTH}
              y1={20}
              x2={LABEL_WIDTH + CHART_WIDTH}
              y2={20}
              stroke="#dee2e6"
            />
            {/* Date labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const x = LABEL_WIDTH + frac * CHART_WIDTH;
              const d = new Date(minDate + frac * rangeMs);
              return (
                <text key={frac} x={x} y={14} fontSize={10} fill="#868e96" textAnchor="middle">
                  {d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}
                </text>
              );
            })}

            {drugNames.map((drug, idx) => {
              const y = 30 + idx * ROW_HEIGHT;
              const events = drugEvents[drug] ?? [];
              const isActive = active_drugs.some((d) => d.drug_name === drug);

              return (
                <g key={drug}>
                  {/* Drug label */}
                  <text
                    x={4}
                    y={y + 14}
                    fontSize={11}
                    fill={isActive ? "#212529" : "#868e96"}
                    fontWeight={isActive ? 600 : 400}
                  >
                    {drug.length > 22 ? `${drug.slice(0, 20)}...` : drug}
                  </text>
                  {/* Row background */}
                  <rect
                    x={LABEL_WIDTH}
                    y={y}
                    width={CHART_WIDTH}
                    height={ROW_HEIGHT - 4}
                    fill={idx % 2 === 0 ? "#f8f9fa" : "#fff"}
                    rx={2}
                  />

                  {/* Event bars and markers */}
                  {events.map((ev) => {
                    const startX =
                      LABEL_WIDTH +
                      ((new Date(ev.effective_date).getTime() - minDate) / rangeMs) * CHART_WIDTH;
                    const endTs = ev.end_date
                      ? new Date(ev.end_date).getTime()
                      : ev.event_type === "discontinued"
                        ? new Date(ev.effective_date).getTime()
                        : maxDate;
                    const endX = LABEL_WIDTH + ((endTs - minDate) / rangeMs) * CHART_WIDTH;
                    const color = EVENT_COLORS[ev.event_type] ?? "#868e96";

                    if (ev.event_type === "started" || ev.event_type === "resumed") {
                      return (
                        <g key={ev.id}>
                          <rect
                            x={startX}
                            y={y + 8}
                            width={Math.max(endX - startX, 2)}
                            height={14}
                            fill={color}
                            opacity={0.3}
                            rx={3}
                          />
                          <circle cx={startX} cy={y + 15} r={4} fill={color}>
                            <title>{`${ev.event_type}: ${ev.dosage ?? ""} ${ev.frequency ?? ""}`}</title>
                          </circle>
                        </g>
                      );
                    }

                    return (
                      <g key={ev.id}>
                        <circle
                          cx={startX}
                          cy={y + 15}
                          r={5}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={1}
                        >
                          <title>{`${ev.event_type}: ${ev.change_reason ?? ev.dosage ?? ""}`}</title>
                        </circle>
                        {ev.event_type === "dose_changed" && (
                          <text x={startX + 8} y={y + 19} fontSize={8} fill={color}>
                            {ev.dosage}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </ScrollArea>

        {/* Legend */}
        <Group gap="md" mt="sm">
          {Object.entries(EVENT_COLORS).map(([type, color]) => (
            <Group key={type} gap={4}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
              <Text size="xs">{type.replace(/_/g, " ")}</Text>
            </Group>
          ))}
        </Group>
      </Card>

      {/* Active drugs */}
      {active_drugs.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Currently Active Medications
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Drug</Table.Th>
                <Table.Th>Generic</Table.Th>
                <Table.Th>Dosage</Table.Th>
                <Table.Th>Frequency</Table.Th>
                <Table.Th>Route</Table.Th>
                <Table.Th>Started</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {active_drugs.map((d) => (
                <Table.Tr
                  key={`${d.drug_name}-${d.started_date}-${d.dosage ?? ""}-${d.frequency ?? ""}`}
                >
                  <Table.Td>
                    <Text fw={500} size="sm">
                      {d.drug_name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {d.generic_name ?? "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>{d.dosage ?? "—"}</Table.Td>
                  <Table.Td>{d.frequency ?? "—"}</Table.Td>
                  <Table.Td>{d.route ?? "—"}</Table.Td>
                  <Table.Td>{d.started_date}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Lab trends */}
      {lab_series.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Lab Value Trends
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {lab_series.slice(0, 9).map((series) => {
              const points = series.data_points;
              if (points.length === 0) return null;
              const latest = points.at(-1);
              if (!latest) return null;
              const atTarget =
                series.target_value != null && latest.numeric_value != null
                  ? latest.numeric_value <= series.target_value
                  : null;
              return (
                <Card key={series.parameter_name} withBorder padding="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={500}>
                      {series.parameter_name}
                    </Text>
                    {atTarget !== null && (
                      <Badge tone={atTarget ? "success" : "danger"} size="xs">
                        {atTarget ? "At Target" : "Off Target"}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xl" fw={700} mt={4}>
                    {latest.value} {series.unit ?? ""}
                  </Text>
                  {series.target_value != null && (
                    <Text size="xs" c="dimmed">
                      Target: {series.target_value} {series.unit ?? ""}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {points.length} readings | Last:{" "}
                    {new Date(latest.result_date).toLocaleDateString()}
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

function OutcomesSegment({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["outcome-dashboard", patientId],
    queryFn: () => patientDetailService.outcomeDashboard(patientId),
  });

  if (isLoading) return <Loader size="sm" />;
  if (!data) return <Text c="dimmed">No outcome data available.</Text>;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Active Enrollments
          </Text>
          <Text fw={700} size="xl">
            {data.active_enrollments}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Adherence Rate
          </Text>
          <Text fw={700} size="xl">
            {data.adherence_rate != null ? `${Math.round(Number(data.adherence_rate))}%` : "N/A"}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed" tt="uppercase">
            Duration
          </Text>
          <Text fw={700} size="xl">
            {data.enrollment_duration_days != null
              ? `${data.enrollment_duration_days} days`
              : "N/A"}
          </Text>
        </Card>
      </SimpleGrid>

      {data.targets.length > 0 && (
        <Card withBorder padding="md">
          <Text fw={500} mb="sm">
            Outcome Targets
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {data.targets.map((t) => (
              <Card key={t.target.id} withBorder padding="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {t.target.parameter_name}
                  </Text>
                  {t.at_target !== null && (
                    <Badge tone={t.at_target ? "success" : "danger"} size="xs">
                      {t.at_target ? "At Target" : "Off Target"}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  Target: {t.target.comparison} {t.target.target_value} {t.target.unit}
                </Text>
                <Text size="lg" fw={600} mt={4}>
                  {t.latest_value != null ? `${t.latest_value} ${t.target.unit}` : "No data"}
                </Text>
                {t.latest_date && (
                  <Text size="xs" c="dimmed">
                    Last: {new Date(t.latest_date).toLocaleDateString()}
                  </Text>
                )}
              </Card>
            ))}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}

function AdherenceSegment({ patientId }: { patientId: string }) {
  const { data: enrollments = [] } = useQuery({
    queryKey: ["patient-enrollments-chronic", patientId],
    queryFn: () => patientDetailService.patientEnrollments(patientId),
  });

  const activeEnrollments = enrollments.filter((e) => e.status === "active");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["adherence-summary-detail", selected],
    queryFn: () => patientDetailService.adherenceSummary(selected ?? ""),
    enabled: !!selected,
  });

  if (activeEnrollments.length === 0 && enrollments.length === 0) {
    return <Text c="dimmed">No chronic care enrollments found.</Text>;
  }

  return (
    <Stack gap="md">
      {/* Enrollment list */}
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">
          Enrollments
        </Text>
        <Stack gap="xs">
          {enrollments.map((e) => (
            <Group
              key={e.id}
              justify="space-between"
              style={{
                cursor: "pointer",
                padding: 8,
                borderRadius: 0,
                background: selected === e.id ? "var(--mb-nav-active-bg)" : undefined,
              }}
              onClick={() => setSelected(e.id)}
            >
              <div>
                <Text size="sm" fw={500}>
                  {e.program_name}
                </Text>
                <Text size="xs" c="dimmed">
                  Enrolled: {e.enrollment_date}
                </Text>
              </div>
              <Badge tone={ENROLLMENT_STATUS_COLORS[e.status] ?? "neutral"}>
                {e.status.replace(/_/g, " ")}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Card>

      {/* Adherence summary */}
      {summary && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Dose Adherence
              </Text>
              <Text fw={700} size="xl">
                {Math.round(Number(summary.dose_adherence_pct))}%
              </Text>
              <Progress
                value={Number(summary.dose_adherence_pct)}
                color={Number(summary.dose_adherence_pct) >= 80 ? "success" : "danger"}
                mt="xs"
              />
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Doses
              </Text>
              <Group gap="xs" mt="xs">
                <Badge tone="success">{summary.doses_taken} taken</Badge>
                <Badge tone="danger">{summary.doses_missed} missed</Badge>
                <Badge tone="warning">{summary.doses_late} late</Badge>
              </Group>
            </Card>
            <Card withBorder padding="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Appointments
              </Text>
              <Group gap="xs" mt="xs">
                <Badge tone="success">{summary.appointments_attended} attended</Badge>
                <Badge tone="danger">{summary.appointments_missed} missed</Badge>
              </Group>
            </Card>
          </SimpleGrid>

          {summary.by_month.length > 0 && (
            <Card withBorder padding="md">
              <Text fw={500} mb="sm">
                Monthly Adherence
              </Text>
              {summary.by_month.map((m) => {
                const total = m.taken + m.missed + m.late;
                const pct = total > 0 ? Math.round((m.taken / total) * 100) : 0;
                return (
                  <Group key={m.month} mb="xs">
                    <Text size="sm" w={80}>
                      {m.month}
                    </Text>
                    <Progress
                      value={pct}
                      color={pct >= 80 ? "success" : "danger"}
                      style={{ flex: 1 }}
                    />
                    <Text size="sm" w={40}>
                      {pct}%
                    </Text>
                  </Group>
                );
              })}
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function printTreatmentSummary(summary: TreatmentSummaryResponse) {
  const win = window.open("", "_blank");
  if (!win) return;

  const medsRows = summary.current_medications
    .map(
      (m) =>
        `<tr><td>${m.drug_name}</td><td>${m.generic_name ?? ""}</td><td>${m.dosage ?? ""}</td><td>${m.frequency ?? ""}</td><td>${m.route ?? ""}</td><td>${m.started_date}</td></tr>`,
    )
    .join("");

  const diagRows = summary.active_diagnoses
    .map(
      (d) =>
        `<tr><td>${d.diagnosis_name}</td><td>${d.icd_code ?? ""}</td><td>${d.diagnosed_date ?? ""}</td></tr>`,
    )
    .join("");

  const targetRows = summary.targets
    .map(
      (t) =>
        `<tr><td>${t.target.parameter_name}</td><td>${t.target.comparison} ${t.target.target_value} ${t.target.unit}</td><td>${t.latest_value ?? "N/A"}</td><td>${t.at_target === true ? "Yes" : t.at_target === false ? "No" : "N/A"}</td></tr>`,
    )
    .join("");

  win.document.write(`<!DOCTYPE html><html><head><title>Treatment Summary</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h1{font-size:16px;margin-bottom:4px}
      h2{font-size:14px;margin:16px 0 4px;border-bottom:1px solid #ccc;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:11px}
      th{background:#f5f5f5;font-weight:600}
      .header{display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:16px}
    </style>
  </head><body>
    <div class="header">
      <div><h1>Treatment Summary</h1><p>Generated: ${new Date().toLocaleDateString()}</p></div>
      <div style="text-align:right"><p><b>${summary.patient_name}</b><br/>UHID: ${summary.uhid}<br/>DOB: ${summary.date_of_birth ?? "N/A"}<br/>Gender: ${summary.gender ?? "N/A"}</p></div>
    </div>
    <h2>Active Diagnoses</h2>
    <table><tr><th>Diagnosis</th><th>ICD Code</th><th>Date</th></tr>${diagRows || "<tr><td colspan=3>None</td></tr>"}</table>
    <h2>Current Medications</h2>
    <table><tr><th>Drug</th><th>Generic</th><th>Dosage</th><th>Frequency</th><th>Route</th><th>Started</th></tr>${medsRows || "<tr><td colspan=6>None</td></tr>"}</table>
    <h2>Outcome Targets</h2>
    <table><tr><th>Parameter</th><th>Target</th><th>Latest</th><th>At Target</th></tr>${targetRows || "<tr><td colspan=4>None set</td></tr>"}</table>
    <h2>Adherence Rate</h2>
    <p>${summary.adherence_rate != null ? `${Math.round(Number(summary.adherence_rate))}%` : "No adherence data"}</p>
    <h2>Program Enrollments</h2>
    <table><tr><th>Program</th><th>Enrolled</th><th>Status</th></tr>${summary.enrollments.map((e) => `<tr><td>${e.program_name}</td><td>${e.enrollment_date}</td><td>${e.status}</td></tr>`).join("")}</table>
    <script>window.print();window.close();</script>
  </body></html>`);
  win.document.close();
}

export function PatientDetailPage() {
  return (
    <ClinicalEventProvider moduleCode="patients" contextCode="patient-detail">
      <PatientDetailPageInner />
    </ClinicalEventProvider>
  );
}

function PatientDetailPageInner() {
  useRequirePermission(P.PATIENTS.VIEW);
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  usePatientAssistantContext(patientId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emit = useClinicalEmit();
  const queryClient = useQueryClient();
  const canListPatients = useHasPermission(P.PATIENTS.LIST);
  const canViewBillingLedger = useHasPermission(P.BILLING.INVOICES_LIST);
  const canViewEmergencyVisits = useHasPermission(P.EMERGENCY.VISITS_LIST);
  const canViewCampRegistrations = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const uhidAccess = useFieldAccess("patients.uhid");
  const firstNameAccess = useFieldAccess("patients.first_name");
  const lastNameAccess = useFieldAccess("patients.last_name");
  const phoneAccess = useFieldAccess("patients.phone");
  const dobAccess = useFieldAccess("patients.date_of_birth");
  const [shareOpen, { open: openShare, close: closeShare }] = useDisclosure(false);
  const [activePatientTab, setActivePatientTab] = useHashTabs(
    "overview",
    PATIENT_DETAIL_TAB_VALUES,
  );
  const orderBasketDeepLinkTab = patientDetailOrderBasketTabFromSearchParams(searchParams);
  const basketOpen = orderBasketDeepLinkTab !== null;
  const basketTab = orderBasketDeepLinkTab ?? "drug";

  function openOrderBasket(tab: OrderBasketTab = "drug") {
    setActivePatientTab(patientDetailTabForOrderBasket(tab));
    navigate(patientDetailOrderBasketRoute(patientId, tab));
  }

  function changeOrderBasketTab(tab: OrderBasketTab) {
    setActivePatientTab(patientDetailTabForOrderBasket(tab));
    navigate(patientDetailOrderBasketRoute(patientId, tab), { replace: true });
  }

  function closeOrderBasket() {
    navigate(patientDetailWorkspaceTabRoute(patientId, activeDetailTab), { replace: true });
  }

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientDetailService.getPatient(patientId),
    enabled: patientId.length > 0,
  });
  const { data: patientContext } = usePatientContext(patientId);

  // Latest active encounter — basket needs an encounter to scope orders to.
  const { data: visits = [] } = useQuery({
    queryKey: ["patient-visits", patientId],
    queryFn: () => patientDetailService.listPatientVisits(patientId),
    enabled: patientId.length > 0,
  });
  const activeEncounter = visits.find(
    (visit) =>
      visit.encounter_type === "opd" && (visit.status === "open" || visit.status === "in_progress"),
  );
  const { data: activeAdmissions } = useQuery({
    queryKey: ["patient-admissions", patientId, "admitted"],
    queryFn: () => patientDetailService.listPatientAdmissions(patientId, "admitted"),
    enabled: patientId.length > 0,
  });
  const activeAdmission = activeAdmissions?.admissions[0];
  const { data: emergencyVisits = [] } = useQuery<ErVisit[]>({
    queryKey: ["er-visits", "patient", patientId],
    queryFn: () => patientDetailService.listErVisits({ patient_id: patientId }),
    enabled: canViewEmergencyVisits && patientId.length > 0,
  });
  const patientEmergencyVisits = emergencyVisits.filter((visit) => visit.patient_id === patientId);
  const activeEmergencyVisit = patientEmergencyVisits.find((visit) =>
    ACTIVE_ER_VISIT_STATUSES.has(visit.status),
  );
  const { data: campRegistrations = [] } = useQuery<CampRegistration[]>({
    queryKey: ["camp-registrations", "patient", patientId],
    queryFn: () => patientDetailService.listCampRegistrations({ patient_id: patientId }),
    enabled: canViewCampRegistrations && patientId.length > 0,
  });
  const { data: prescriptions = [] } = useQuery<PrescriptionHistoryItem[]>({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => patientDetailService.listPatientPrescriptions(patientId),
    enabled: patientId.length > 0,
  });
  const { data: invoices = [] } = useQuery<PatientInvoiceRow[]>({
    queryKey: ["patient-invoices", patientId],
    queryFn: () => patientDetailService.listPatientInvoices(patientId),
    enabled: patientId.length > 0,
  });

  if (isLoading || !patient) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading patient...</Text>
      </Stack>
    );
  }

  const displayName =
    [
      fieldAccessText(firstNameAccess, patient.first_name, "name"),
      fieldAccessText(lastNameAccess, patient.last_name, "name"),
    ]
      .filter((part) => part !== "—")
      .join(" ") || "Patient";
  const displayPhone = fieldAccessText(phoneAccess, patient.phone, "phone");
  const displayUhid = fieldAccessText(uhidAccess, patient.uhid, "identifier");
  const displayAge =
    dobAccess === "edit" || dobAccess === "view"
      ? age(patient.date_of_birth)
      : fieldAccessText(dobAccess, patient.date_of_birth, "identifier");
  const hasClinicalOrder =
    prescriptions.length > 0 ||
    visits.some((visit) => (visit.prescription_count ?? 0) > 0 || (visit.lab_order_count ?? 0) > 0);
  const hasReviewedPharmacyPrescription =
    hasReviewedPatientPharmacyPrescriptionForJourney(prescriptions);
  const hasEmergencyVisit =
    patientEmergencyVisits.length > 0 ||
    visits.some((visit) => visit.encounter_type === "emergency");
  const hasBillingInvoice = invoices.length > 0;
  const hasFinalizedInvoice = invoices.some((invoice) =>
    billingInvoiceIsFinalized(invoice.status, invoice.total_amount, invoice.paid_amount),
  );
  const hasPaymentReceived = invoices.some((invoice) =>
    billingInvoiceHasReceivedPayment(invoice.status, invoice.total_amount, invoice.paid_amount),
  );
  const pendingInvoiceCount = invoices.filter((invoice) =>
    billingInvoiceRequiresFollowUp(invoice.status, invoice.total_amount, invoice.paid_amount),
  ).length;
  const activeInvoiceId = activeBillingInvoiceIdForJourney(invoices);
  const activeOrderContext = activeAdmission ? "ipd" : activeEncounter ? "opd" : null;
  const hasPendingConsent = Boolean(patientContext?.pending_consents.length);
  const campCompletedEvents = deriveCampJourneyCompletedEvents(campRegistrations);
  const activeCampRegistration =
    campRegistrations.find((registration) => registration.status !== "no_show") ?? null;
  const hasCampRegistration = campCompletedEvents.includes("camp.registration.created");
  const hasCampScreeningCompleted = campCompletedEvents.includes("camp.screening.completed");
  const completedEvents: ClinicalEventName[] = [...campCompletedEvents];
  if (hasEmergencyVisit) {
    completedEvents.push("emergency.visit.created");
  }
  if (hasClinicalOrder) {
    completedEvents.push("order.created");
  }
  if (hasReviewedPharmacyPrescription) {
    completedEvents.push("pharmacy.prescription.reviewed");
  }
  if (hasBillingInvoice) {
    completedEvents.push("billing.invoice.created");
  }
  if (hasFinalizedInvoice) {
    completedEvents.push("billing.invoice.finalized");
  }
  if (hasPaymentReceived) {
    completedEvents.push("billing.payment.received");
  }
  const actionContext: ClinicalJourneyContext = patientDetailJourneyContext({
    patientId: patient.id,
    isDeceased: patient.is_deceased,
    activeEncounterId: activeEncounter?.id ?? null,
    activeAdmissionId: activeAdmission?.id ?? null,
    activeBedId: activeAdmission?.bed_id ?? null,
    activeCampId: activeCampRegistration?.camp_id ?? null,
    activeCampRegistrationId: activeCampRegistration?.id ?? null,
    activeEmergencyVisitId: activeEmergencyVisit?.id ?? null,
    activeAdmissionStatus: activeAdmission?.status ?? null,
    activeInvoiceId,
    activeOrderContext,
    hasPendingConsent,
    completedEvents,
    prescriptions,
  });
  const emitPatientShareCreated = (grant: {
    expiresAt: string | null;
    grantId: string;
    relation: string;
    subjectId: string;
    subjectType: string;
  }) => {
    emit("patient.access_shared", {
      source_record_id: patient.id,
      patient_id: patient.id,
      grant_id: grant.grantId,
      relation: grant.relation,
      subject_type: grant.subjectType,
      subject_id: grant.subjectId,
      expires_at: grant.expiresAt,
    });
  };
  const printPatientCard = async () => {
    const printed = await handlePrintPatientCard(patient.id);
    if (!printed) {
      return;
    }

    emit("patient.card_printed", {
      source_record_id: patient.id,
      patient_id: patient.id,
      copies: PATIENT_CARD_PRINT_COPIES.length,
    });
  };
  const detailTabs = [
    { value: "overview", label: "Overview", section: "Profile", icon: <IconUser size={14} /> },
    {
      value: "allergies",
      label: "Allergies",
      section: "Profile",
      icon: <IconAlertTriangle size={14} />,
    },
    {
      value: "timeline",
      label: "Timeline",
      section: "Clinical",
      icon: <IconTimeline size={14} />,
    },
    {
      value: "visits",
      label: "Visits",
      section: "Clinical",
      icon: <IconStethoscope size={14} />,
    },
    {
      value: "prescriptions",
      label: "Prescriptions",
      section: "Clinical",
      icon: <IconPill size={14} />,
    },
    { value: "lab", label: "Lab Orders", section: "Clinical", icon: <IconFlask size={14} /> },
    { value: "imaging", label: "Imaging", section: "Clinical", icon: <IconEye size={14} /> },
    { value: "billing", label: "Billing", section: "Finance", icon: <IconReceipt size={14} /> },
    {
      value: "appointments",
      label: "Appointments",
      section: "Workflow",
      icon: <IconCalendar size={14} />,
    },
    { value: "family", label: "Family", section: "Records", icon: <IconLink size={14} /> },
    { value: "documents", label: "Documents", section: "Records", icon: <IconFile size={14} /> },
    {
      value: "chronic",
      label: "Chronic Care",
      section: "Programs",
      icon: <IconReportMedical size={14} />,
    },
    {
      value: "packages",
      label: "Packages",
      section: "Programs",
      icon: <IconReportMedical size={14} />,
    },
    { value: "notes", label: "Notes", section: "Records", icon: <IconReportMedical size={14} /> },
    { value: "merge", label: "Merge", section: "Admin", icon: <IconGitMerge size={14} /> },
  ] satisfies Array<{
    value: PatientDetailTabValue;
    label: string;
    section: string;
    icon: ReactNode;
  }>;
  const activeDetailTab: PatientDetailTabValue = isPatientDetailTabValue(activePatientTab)
    ? activePatientTab
    : "overview";

  return (
    <Stack className={classes.patientWorkspace}>
      <PageHeader
        title={displayName}
        divider={false}
        actions={
          <Group gap="xs">
            <AskAiButton
              prompt="Summarize this patient and flag any allergy or medication-safety concerns."
              context={{ patient_id: patient.id }}
              label="Ask AI"
            />
            {canViewBillingLedger && (
              <Button
                tone="secondary"
                leftSection={<IconReceipt size={14} />}
                onClick={() => navigate(`/billing?tab=invoices&patient_id=${patient.id}`)}
              >
                Patient Ledger
              </Button>
            )}
            {canListPatients && (
              <Button tone="secondary" onClick={() => navigate("/patients")}>
                Patient Directory
              </Button>
            )}
          </Group>
        }
      />

      <Card className={classes.commandBar}>
        <Stack gap="xs">
          <PatientFlowNavigator
            patientId={patient.id}
            active="patient"
            activeEncounterId={activeEncounter?.id ?? null}
            activeAdmissionId={activeAdmission?.id ?? null}
            activeAdmissionStatus={activeAdmission?.status ?? null}
            activeBedId={activeAdmission?.bed_id ?? null}
            activeCampId={activeCampRegistration?.camp_id ?? null}
            activeCampRegistrationId={activeCampRegistration?.id ?? null}
            activeEmergencyVisitId={activeEmergencyVisit?.id ?? null}
            activeInvoiceId={activeInvoiceId}
            activePharmacyOrderId={actionContext.activePharmacyOrderId ?? null}
            activePharmacyRxQueueId={actionContext.activePharmacyRxQueueId ?? null}
            activeOrderContext={activeOrderContext}
            completedEvents={completedEvents}
            compact
            actions={
              <PatientJourneyActions
                context={actionContext}
                onEdit={() => navigate(`/patients/${patient.id}/edit`)}
                onOpenOrderBasket={openOrderBasket}
                onShare={openShare}
                onPrintPatientCard={() => {
                  void printPatientCard();
                }}
                size="xs"
              />
            }
          />
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={6}>
              <Group gap="xs">
                {activeEncounter && <Badge tone="success">Active OPD</Badge>}
                {activeAdmission && <Badge tone="primary">Active IPD</Badge>}
                {patient.is_deceased && (
                  <Badge tone="neutral" variant="filled">
                    Deceased
                  </Badge>
                )}
                <Badge tone="primary">{patient.category}</Badge>
                <Badge tone="neutral">{patient.financial_class}</Badge>
                {patient.blood_group && <Badge tone="danger">{patient.blood_group}</Badge>}
                {patient.is_vip && <Badge tone="accent">VIP</Badge>}
                {patient.is_medico_legal && (
                  <Badge tone="danger" variant="filled">
                    MLC
                  </Badge>
                )}
                {hasEmergencyVisit && <Badge tone="danger">ER linked</Badge>}
                {hasCampRegistration && (
                  <Badge tone={hasCampScreeningCompleted ? "success" : "info"}>
                    {hasCampScreeningCompleted ? "Camp screened" : "Camp linked"}
                  </Badge>
                )}
                {hasClinicalOrder && <Badge tone="success">Order handoff</Badge>}
                {pendingInvoiceCount > 0 && (
                  <Badge tone="warning">
                    {pendingInvoiceCount} pending bill{pendingInvoiceCount === 1 ? "" : "s"}
                  </Badge>
                )}
              </Group>
              <Group gap={6}>
                <Badge tone="primary" variant="light">
                  UHID {displayUhid}
                </Badge>
                {patient.gender && <Badge tone="neutral">{patient.gender}</Badge>}
                {displayAge && displayAge !== "-" && <Badge tone="neutral">{displayAge}</Badge>}
                {displayPhone && displayPhone !== "-" && (
                  <Badge tone="neutral">{displayPhone}</Badge>
                )}
                <PatientContextBanner patientId={patient.id} inline />
              </Group>
            </Stack>
          </Group>
        </Stack>
      </Card>

      <ShareDrawer
        opened={shareOpen}
        onClose={closeShare}
        objectType="patient"
        objectId={patient.id}
        objectLabel={`${displayName} (${displayUhid})`}
        onGrantCreated={emitPatientShareCreated}
      />

      <Tabs value={activeDetailTab} onChange={setActivePatientTab} keepMounted={false}>
        <Grid align="flex-start" className={classes.workspaceGrid}>
          <Grid.Col span={12}>
            <Stack className={classes.workspaceMain}>
              <Tabs.List>
                {detailTabs.map((tab) => (
                  <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                    {tab.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>

              <Tabs.Panel id="patient-overview" value="overview" pt="md">
                <OverviewTab patient={patient} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-allergies" value="allergies" pt="md">
                <AllergiesTab patient={patient} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-timeline" value="timeline" pt="md">
                <ClinicalTimelineTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-visits" value="visits" pt="md">
                <VisitsTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-prescriptions" value="prescriptions" pt="md">
                <PrescriptionsTab patient={patient} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-lab" value="lab" pt="md">
                <LabOrdersTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-imaging" value="imaging" pt="md">
                <ImagingTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-billing" value="billing" pt="md">
                <BillingTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-appointments" value="appointments" pt="md">
                <AppointmentsTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-family" value="family" pt="md">
                <DetailFamilyLinksTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-documents" value="documents" pt="md">
                <Stack>
                  <DetailDocumentsTab patientId={patient.id} />
                  <PatientAccessLogSection patientId={patient.id} />
                </Stack>
              </Tabs.Panel>
              <Tabs.Panel id="patient-chronic" value="chronic" pt="md">
                <ChronicCareTab patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-packages" value="packages" pt="md">
                <ActivePackagesSection patientId={patient.id} />
              </Tabs.Panel>
              <Tabs.Panel id="patient-notes" value="notes" pt="md">
                <NotesPanel patientId={patient.id} label="Clinical Notes" />
              </Tabs.Panel>
              <Tabs.Panel id="patient-merge" value="merge" pt="md">
                <MergeTab patient={patient} />
              </Tabs.Panel>
            </Stack>
          </Grid.Col>
        </Grid>
      </Tabs>

      {activeEncounter && (
        <OrderBasketWorkspace
          opened={basketOpen}
          onClose={closeOrderBasket}
          encounterId={activeEncounter.id}
          patientId={patient.id}
          activeTab={basketTab}
          onActiveTabChange={changeOrderBasketTab}
          onSigned={() => {
            void queryClient.invalidateQueries({ queryKey: ["patient-visits", patient.id] });
            void queryClient.invalidateQueries({ queryKey: ["patient-prescriptions", patient.id] });
            void queryClient.invalidateQueries({ queryKey: ["patient-invoices", patient.id] });
          }}
        />
      )}
    </Stack>
  );
}
