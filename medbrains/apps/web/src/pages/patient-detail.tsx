import { Card, Grid, Group, Loader, Stack, Tabs, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  CampRegistration,
  ClinicalEventName,
  ClinicalJourneyContext,
  ErVisit,
  PatientInvoiceRow,
  PrescriptionHistoryItem,
  RegistrationCardPrintData,
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
  IconReceipt,
  IconReportMedical,
  IconStethoscope,
  IconTimeline,
  IconUser,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
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
import { ShareDrawer } from "@/components/Sharing/ShareDrawer";
import { Badge, Button } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { usePatientAssistantContext } from "@/hooks/usePatientAssistantContext";
import { usePatientContext } from "@/hooks/usePatientContext";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { patientDetailService } from "@/services/patientDetail.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";
import { AllergiesTab } from "./patient-detail/allergies-tab";
import { AppointmentsTab } from "./patient-detail/appointments-tab";
import { BillingTab } from "./patient-detail/billing-tab";
import { ChronicCareTab } from "./patient-detail/chronic-care-tab";
import { DetailDocumentsTab } from "./patient-detail/documents-tab";
import { DetailFamilyLinksTab } from "./patient-detail/family-links-tab";
import { ImagingTab } from "./patient-detail/imaging-tab";
import { LabOrdersTab } from "./patient-detail/lab-orders-tab";
import { MergeTab } from "./patient-detail/merge-tab";
import { OverviewTab } from "./patient-detail/overview-tab";
import { PrescriptionsTab } from "./patient-detail/prescriptions-tab";
import { age, escapeHtml } from "./patient-detail/shared";
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
