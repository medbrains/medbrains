import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Divider,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type ErAdmitFormInput, erAdmitFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdmitFromErRequest,
  ClinicalEventName,
  ClinicalJourneyContext,
  ErVisit,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowLeft,
  IconBed,
  IconBuildingHospital,
  IconFirstAidKit,
  IconGavel,
  IconHeartbeat,
  IconPlus,
  IconReceipt,
  IconUrgent,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { FormModal, OperationalSignal, PageHeader } from "@/components";
import { BedSelect } from "@/components/BedSelect";
import { PatientConsumablesPanel } from "@/components/Clinical";
import { ClinicalEventProvider, useClinicalEmit } from "@/components/ClinicalEventProvider";
import { TriagePanel } from "@/components/crdt/TriagePanel";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { ErBaysTab } from "@/components/Emergency/ErBaysTab";
import { ErDischargeSummaryPanel } from "@/components/Emergency/ErDischargeSummaryPanel";
import { ErObservationPanel } from "@/components/Emergency/ErObservationPanel";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientFlowNavigator } from "@/components/Patient/PatientFlowNavigator";
import { PatientJourneyActions } from "@/components/Patient/PatientJourneyActions";
import { Alert, Button, toast } from "@/components/ui";
import { emergencyOptionalText } from "@/forms/emergency.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
import { emergencyService } from "@/services/emergency.service";
import { billingInvoiceWorkspaceRoute } from "./billing-workspace";
import { CodesTab } from "./emergency/codes";
import { MassCasualtyTab } from "./emergency/mass-casualty";
import { MlcTab } from "./emergency/mlc";
import { MlcCaseDetail } from "./emergency/mlc-case-detail";
import { ResuscitationTab } from "./emergency/resuscitation";
import { ResuscitationVisitPanel } from "./emergency/resuscitation-visit-panel";
import {
  triageInfo,
  triageLabel,
  triageShape,
  triageTone,
  visitStatusIcon,
  visitStatusLabel,
  visitStatusShape,
  visitStatusTone,
} from "./emergency/shared";
import { TriageLogTab } from "./emergency/triage-log";
import { EmergencyVisitForm } from "./emergency/visit-form";
import { VisitsTab } from "./emergency/visits";
import classes from "./emergency.module.scss";
import { emergencyTabFromSearch, emergencyVisibleTab } from "./emergency-workspace";

const emptyErAdmitForm: ErAdmitFormInput = {
  bed_id: "",
  admitting_doctor_id: "",
  admission_notes: "",
};

const EMERGENCY_PAGE_PERMISSIONS = [
  P.EMERGENCY.VISITS_LIST,
  P.EMERGENCY.VISITS_CREATE,
  P.EMERGENCY.VISITS_UPDATE,
  P.EMERGENCY.TRIAGE_LIST,
  P.EMERGENCY.TRIAGE_CREATE,
  P.EMERGENCY.RESUSCITATION_LIST,
  P.EMERGENCY.RESUSCITATION_CREATE,
  P.EMERGENCY.CODES_LIST,
  P.EMERGENCY.CODES_CREATE,
  P.EMERGENCY.CODES_UPDATE,
  P.EMERGENCY.MLC_LIST,
  P.EMERGENCY.MLC_CREATE,
  P.EMERGENCY.MLC_UPDATE,
  P.EMERGENCY.MLC_PRINT,
  P.EMERGENCY.MLC_REPRINT,
  P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE,
  P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE,
  P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE,
  P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE,
  P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST,
  P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE,
  P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM,
  P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT,
  P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT,
  P.EMERGENCY.MASS_CASUALTY_LIST,
  P.EMERGENCY.MASS_CASUALTY_CREATE,
  P.EMERGENCY.MASS_CASUALTY_UPDATE,
  P.EMERGENCY.MASS_CASUALTY_CLOSE,
] as const;

function deriveEmergencyJourneyCompletedEvents(visit: ErVisit): readonly ClinicalEventName[] {
  const events: ClinicalEventName[] = [];
  if (visit.admission_id) {
    events.push("ipd.admission.created");
    events.push("bed.assigned");
  }
  if (visit.is_mlc) {
    events.push("mlc.created");
  }
  return events;
}

// ── Triage helpers ────────────────────────────────────

// ── Timer Hook ─────────────────────────────────────────

function EmergencyVisitSignals({ size = "xs", visit }: { size?: "xs" | "sm"; visit: ErVisit }) {
  const { t } = useTranslation("emergency");
  const info = triageInfo(visit.triage_level);

  return (
    <Group gap={4} wrap="wrap">
      <OperationalSignal
        icon={visitStatusIcon(visit.status)}
        label={visitStatusLabel(t, visit.status)}
        shape={visitStatusShape(visit.status)}
        size={size}
        tone={visitStatusTone(visit.status)}
      />
      <OperationalSignal
        icon={IconHeartbeat}
        label={triageLabel(t, visit.triage_level)}
        shape={triageShape(visit.triage_level)}
        size={size}
        tone={triageTone(visit.triage_level)}
        value={info.level > 0 ? String(info.level) : undefined}
      />
      {visit.is_mlc && (
        <OperationalSignal
          icon={IconGavel}
          label={t("signals.mlc")}
          shape="diamond"
          size={size}
          tone="risk"
        />
      )}
      {visit.is_brought_dead && (
        <OperationalSignal
          icon={IconAlertOctagon}
          label={t("signals.broughtDead")}
          shape="diamond"
          size={size}
          tone="risk"
        />
      )}
      {visit.bay_number && (
        <OperationalSignal
          label={t("signals.bay")}
          shape="token"
          size={size}
          tone="active"
          value={visit.bay_number}
        />
      )}
      {visit.admission_id && (
        <OperationalSignal
          icon={IconBuildingHospital}
          label={t("signals.ipdAdmission")}
          shape="bed"
          size={size}
          tone="ready"
        />
      )}
    </Group>
  );
}

// ── Main Page ──────────────────────────────────────────

export function EmergencyPage() {
  useRequirePermission(EMERGENCY_PAGE_PERMISSIONS);
  const { t } = useTranslation("emergency");
  const [searchParams, setSearchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const contextAction = searchParams.get("action") ?? "";
  const contextLocation = searchParams.get("location") ?? "";
  const requestedTab = emergencyTabFromSearch(searchParams.get("tab"));

  const canViewVisits = useHasPermission(P.EMERGENCY.VISITS_LIST);
  const canCreateVisit = useHasPermission(P.EMERGENCY.VISITS_CREATE);
  const canUpdateVisit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const canViewTriage = useHasPermission(P.EMERGENCY.TRIAGE_LIST);
  const canCreateTriage = useHasPermission(P.EMERGENCY.TRIAGE_CREATE);
  const canViewResuscitation = useHasPermission(P.EMERGENCY.RESUSCITATION_LIST);
  const canCreateResuscitation = useHasPermission(P.EMERGENCY.RESUSCITATION_CREATE);
  const canViewCodes = useHasPermission(P.EMERGENCY.CODES_LIST);
  const canCreateCode = useHasPermission(P.EMERGENCY.CODES_CREATE);
  const canUpdateCode = useHasPermission(P.EMERGENCY.CODES_UPDATE);
  const canViewMlc = useHasPermission(P.EMERGENCY.MLC_LIST);
  const canCreateMlc = useHasPermission(P.EMERGENCY.MLC_CREATE);
  const canUpdateMlc = useHasPermission(P.EMERGENCY.MLC_UPDATE);
  const canPrintMlc = useHasPermission(P.EMERGENCY.MLC_PRINT);
  const canReprintMlc = useHasPermission(P.EMERGENCY.MLC_REPRINT);
  const canCreateMlcSbar = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE);
  const canCreateMlcAgeEstimation = useHasPermission(
    P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE,
  );
  const canCreateMlcPocso = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE);
  const canCreateMlcCourtSummons = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE);
  const canListMlcPoliceIntimations = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST);
  const canCreateMlcPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE);
  const canConfirmMlcPoliceReceipt = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM);
  const canPrintMlcPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT);
  const canReprintMlcPoliceIntimation = useHasPermission(
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT,
  );
  const canViewMassCasualty = useHasPermission(P.EMERGENCY.MASS_CASUALTY_LIST);
  const canCreateMassCasualty = useHasPermission(P.EMERGENCY.MASS_CASUALTY_CREATE);
  const canUpdateMassCasualty = useHasPermission(P.EMERGENCY.MASS_CASUALTY_UPDATE);
  const canCloseMassCasualty = useHasPermission(P.EMERGENCY.MASS_CASUALTY_CLOSE);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canAccessVisitQueue = canViewVisits || canUpdateVisit;
  const canUseErVisitSelector =
    canAccessVisitQueue ||
    canViewTriage ||
    canCreateTriage ||
    canViewResuscitation ||
    canCreateResuscitation;
  const canAccessCodeQueue = canViewCodes || canUpdateCode;
  const canCreateMlcDocument =
    canCreateMlcSbar || canCreateMlcAgeEstimation || canCreateMlcPocso || canCreateMlcCourtSummons;
  const canAccessMlcQueue =
    canViewMlc ||
    canUpdateMlc ||
    canPrintMlc ||
    canReprintMlc ||
    canCreateMlcDocument ||
    canListMlcPoliceIntimations ||
    canCreateMlcPoliceIntimation ||
    canConfirmMlcPoliceReceipt ||
    canPrintMlcPoliceIntimation ||
    canReprintMlcPoliceIntimation;
  const canOpenMlcDetail =
    canViewMlc ||
    canPrintMlc ||
    canReprintMlc ||
    canCreateMlcDocument ||
    canListMlcPoliceIntimations ||
    canCreateMlcPoliceIntimation ||
    canConfirmMlcPoliceReceipt ||
    canPrintMlcPoliceIntimation ||
    canReprintMlcPoliceIntimation;
  const canAccessMassCasualtyQueue =
    canViewMassCasualty || canUpdateMassCasualty || canCloseMassCasualty;

  const availableTabs = [
    {
      value: "visits" as const,
      label: t("erVisits"),
      icon: <IconUrgent size={16} />,
      visible: canViewVisits || canCreateVisit || canUpdateVisit,
    },
    {
      value: "triage" as const,
      label: "Triage Log",
      icon: <IconHeartbeat size={16} />,
      visible: canViewTriage || canCreateTriage,
    },
    {
      value: "resuscitation" as const,
      label: "Resuscitation",
      icon: <IconFirstAidKit size={16} />,
      visible: canViewResuscitation || canCreateResuscitation,
    },
    {
      value: "codes" as const,
      label: t("codeActivations"),
      icon: <IconHeartbeat size={16} />,
      visible: canViewCodes || canCreateCode || canUpdateCode,
    },
    {
      value: "mlc" as const,
      label: t("mlcCases"),
      icon: <IconGavel size={16} />,
      visible:
        canViewMlc ||
        canCreateMlc ||
        canUpdateMlc ||
        canPrintMlc ||
        canReprintMlc ||
        canCreateMlcDocument ||
        canListMlcPoliceIntimations ||
        canCreateMlcPoliceIntimation ||
        canConfirmMlcPoliceReceipt ||
        canPrintMlcPoliceIntimation ||
        canReprintMlcPoliceIntimation,
    },
    {
      value: "mass-casualty" as const,
      label: t("massCasualty"),
      icon: <IconUsers size={16} />,
      visible:
        canViewMassCasualty ||
        canCreateMassCasualty ||
        canUpdateMassCasualty ||
        canCloseMassCasualty,
    },
    {
      value: "bays" as const,
      label: "Bays",
      icon: <IconBed size={16} />,
      visible: canViewVisits || canUpdateVisit,
    },
  ].filter((item) => item.visible);
  const fallbackTab = availableTabs[0]?.value ?? "visits";
  const visibleActiveTab = emergencyVisibleTab(
    requestedTab,
    availableTabs.map((item) => item.value),
    fallbackTab,
  );
  const setSelectedTab = (value: string | null) => {
    const nextTab = emergencyTabFromSearch(value);
    if (!nextTab) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    setSearchParams(next, { replace: true });
  };

  return (
    <ClinicalEventProvider moduleCode="emergency" contextCode="emergency-visits">
      <PageHeader
        title={t("title.emergencyDepartment")}
        subtitle={t("subtitle.erVisits,Triage,MlcManagement,MassCasualty")}
      />
      {contextPatientId && canViewPatientRecord && (
        <PatientContextBanner patientId={contextPatientId} hideLoadingState />
      )}
      {contextPatientId && !canViewPatientRecord && (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          Patient context is restricted for this role.
        </Alert>
      )}
      {availableTabs.length === 0 ? (
        <Text c="dimmed" size="sm">
          No emergency work areas are available for your current role.
        </Text>
      ) : (
        <Tabs value={visibleActiveTab} onChange={setSelectedTab}>
          <Tabs.List>
            {availableTabs.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {(canViewVisits || canCreateVisit || canUpdateVisit) && (
            <Tabs.Panel value="visits">
              <VisitsTab
                canView={canAccessVisitQueue}
                canCreate={canCreateVisit}
                canViewPatientRecord={canViewPatientRecord}
                contextPatientId={contextPatientId}
              />
            </Tabs.Panel>
          )}
          {(canViewTriage || canCreateTriage) && (
            <Tabs.Panel value="triage" pt="md">
              <TriageLogTab canAppend={canCreateTriage} canViewVisits={canUseErVisitSelector} />
            </Tabs.Panel>
          )}
          {(canViewResuscitation || canCreateResuscitation) && (
            <Tabs.Panel value="resuscitation" pt="md">
              <ResuscitationTab
                canView={canViewResuscitation}
                canCreate={canCreateResuscitation}
                canViewVisits={canUseErVisitSelector}
              />
            </Tabs.Panel>
          )}
          {(canViewCodes || canCreateCode || canUpdateCode) && (
            <Tabs.Panel value="codes">
              <CodesTab
                canView={canAccessCodeQueue}
                canCreate={canCreateCode}
                canUpdate={canUpdateCode}
                contextAction={contextAction}
                contextLocation={contextLocation}
              />
            </Tabs.Panel>
          )}
          {(canViewMlc ||
            canCreateMlc ||
            canUpdateMlc ||
            canPrintMlc ||
            canReprintMlc ||
            canCreateMlcDocument ||
            canListMlcPoliceIntimations ||
            canCreateMlcPoliceIntimation ||
            canConfirmMlcPoliceReceipt ||
            canPrintMlcPoliceIntimation ||
            canReprintMlcPoliceIntimation) && (
            <Tabs.Panel value="mlc">
              <MlcTab
                canList={canAccessMlcQueue}
                canViewDetails={canOpenMlcDetail}
                canCreate={canCreateMlc}
                canUpdate={canUpdateMlc}
                canViewPatientRecord={canViewPatientRecord}
                contextAction={contextAction}
                contextPatientId={contextPatientId}
              />
            </Tabs.Panel>
          )}
          {(canViewMassCasualty ||
            canCreateMassCasualty ||
            canUpdateMassCasualty ||
            canCloseMassCasualty) && (
            <Tabs.Panel value="mass-casualty">
              <MassCasualtyTab
                canView={canAccessMassCasualtyQueue}
                canCreate={canCreateMassCasualty}
                canUpdate={canUpdateMassCasualty}
                canClose={canCloseMassCasualty}
              />
            </Tabs.Panel>
          )}
          {(canViewVisits || canUpdateVisit) && (
            <Tabs.Panel value="bays">
              <ErBaysTab />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </ClinicalEventProvider>
  );
}

export function EmergencyVisitCreatePage() {
  useRequirePermission(P.EMERGENCY.VISITS_CREATE);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";
  const canCreateMlc = useHasPermission(P.EMERGENCY.MLC_CREATE);
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);

  function visitsPath() {
    const params = new URLSearchParams({ tab: "visits" });
    if (initialPatientId) {
      params.set("patient_id", initialPatientId);
    }
    return `/emergency?${params.toString()}`;
  }

  return (
    <ClinicalEventProvider moduleCode="emergency" contextCode="emergency-create-visit">
      <Stack>
        <PageHeader
          title="Register ER Visit"
          subtitle="Create an emergency visit with patient context, MLC flagging, and triage-ready status."
          actions={
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate(visitsPath())}
            >
              ER Queue
            </Button>
          }
        />
        <EmergencyVisitForm
          initialPatientId={initialPatientId}
          canCreateMlc={canCreateMlc}
          canViewPatientRecord={canViewPatientRecord}
          onCancel={() => navigate(visitsPath())}
          onSuccess={(visit) => navigate(`/emergency/visits/${visit.id}`)}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

export function EmergencyVisitDetailPage() {
  useRequirePermission([
    P.EMERGENCY.VISITS_LIST,
    P.EMERGENCY.VISITS_UPDATE,
    P.EMERGENCY.TRIAGE_LIST,
    P.EMERGENCY.TRIAGE_CREATE,
    P.EMERGENCY.RESUSCITATION_LIST,
    P.EMERGENCY.RESUSCITATION_CREATE,
    P.EMERGENCY.MLC_LIST,
    P.EMERGENCY.MLC_PRINT,
    P.EMERGENCY.MLC_REPRINT,
    P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE,
    P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE,
    P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE,
    P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT,
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT,
  ]);
  const navigate = useNavigate();
  const { visitId } = useParams();
  const canViewPatientRecord = useHasPermission(P.PATIENTS.VIEW);
  const canViewTriage = useHasPermission(P.EMERGENCY.TRIAGE_LIST);
  const canCreateTriage = useHasPermission(P.EMERGENCY.TRIAGE_CREATE);
  const canViewResuscitation = useHasPermission(P.EMERGENCY.RESUSCITATION_LIST);
  const canCreateResuscitation = useHasPermission(P.EMERGENCY.RESUSCITATION_CREATE);
  const canUpdateVisit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const canCreateIpdAdmission = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const canViewMlc = useHasPermission(P.EMERGENCY.MLC_LIST);
  const canPrintMlc = useHasPermission(P.EMERGENCY.MLC_PRINT);
  const canReprintMlc = useHasPermission(P.EMERGENCY.MLC_REPRINT);
  const canCreateMlcSbar = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE);
  const canCreateMlcAgeEstimation = useHasPermission(
    P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE,
  );
  const canCreateMlcPocso = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE);
  const canCreateMlcCourtSummons = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE);
  const canListMlcPoliceIntimations = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST);
  const canCreateMlcPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE);
  const canConfirmMlcPoliceReceipt = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM);
  const canPrintMlcPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT);
  const canReprintMlcPoliceIntimation = useHasPermission(
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT,
  );
  const canAccessMlc =
    canViewMlc ||
    canPrintMlc ||
    canReprintMlc ||
    canCreateMlcSbar ||
    canCreateMlcAgeEstimation ||
    canCreateMlcPocso ||
    canCreateMlcCourtSummons ||
    canListMlcPoliceIntimations ||
    canCreateMlcPoliceIntimation ||
    canConfirmMlcPoliceReceipt ||
    canPrintMlcPoliceIntimation ||
    canReprintMlcPoliceIntimation;
  const canAdmit = canUpdateVisit && canCreateIpdAdmission;
  const canCreateInvoice = useHasPermission(P.BILLING.INVOICES_CREATE);
  const { data: visit, isLoading } = useQuery({
    queryKey: ["er-visit", visitId],
    queryFn: () => {
      if (!visitId) throw new Error("ER visit id is missing");
      return emergencyService.getErVisit(visitId);
    },
    enabled: Boolean(visitId),
  });

  // Deferred ER billing from the point of care: the visit and patient
  // come straight off the loaded visit, so the clerk never types a
  // raw UUID (#298). Lands on the created invoice.
  const erInvoiceMutation = useMutation({
    mutationFn: () => {
      if (!visit) throw new Error("Visit not loaded");
      return billingService.erFastInvoice({
        emergency_visit_id: visit.id,
        patient_id: visit.patient_id,
      });
    },
    onSuccess: (invoice) => {
      toast.success(`Invoice ${invoice.invoice_number} created.`, { title: "ER invoice created" });
      navigate(billingInvoiceWorkspaceRoute(invoice.id));
    },
    onError: (error: Error) => {
      toast.error(error.message, { title: "Could not create ER invoice" });
    },
  });
  const { data: mlcCases = [], isLoading: mlcCasesLoading } = useQuery({
    queryKey: ["mlc-cases"],
    queryFn: () => emergencyService.listMlcCases(),
    enabled: canAccessMlc,
  });
  const visitMlcCases = useMemo(
    () => mlcCases.filter((mlcCase) => mlcCase.er_visit_id === visitId),
    [mlcCases, visitId],
  );
  const shouldShowMlcWorkspace = Boolean(visit?.is_mlc && canAccessMlc);

  useEffect(() => {
    if (!shouldShowMlcWorkspace || window.location.hash !== "#mlc") {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("mlc")?.scrollIntoView({ block: "start" });
    });
  }, [shouldShowMlcWorkspace]);

  return (
    <Stack className={classes.emergencyWorkspace}>
      <PageHeader
        title={visit ? `ER Visit ${visit.visit_number}` : "ER Visit"}
        subtitle="Triage, resuscitation, MLC status, and IPD admission context."
        actions={
          <Group gap="xs">
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate("/emergency?tab=visits")}
            >
              ER Queue
            </Button>
            {canUpdateVisit && (
              <Button
                tone="secondary"
                leftSection={<IconPlus size={14} />}
                onClick={() => navigate("/emergency/visits/new")}
              >
                New Visit
              </Button>
            )}
            {canCreateInvoice && visit && (
              <Button
                tone="subtle-danger"
                leftSection={<IconReceipt size={14} />}
                loading={erInvoiceMutation.isPending}
                onClick={() => erInvoiceMutation.mutate()}
              >
                Fast invoice
              </Button>
            )}
          </Group>
        }
      />
      {isLoading && (
        <Card withBorder>
          <Text size="sm" c="dimmed">
            Loading ER visit...
          </Text>
        </Card>
      )}
      {!isLoading && !visit && (
        <Alert tone="warning">ER visit was not found or is not accessible for this role.</Alert>
      )}
      {visit && (
        <>
          <EmergencyVisitCommandBar
            visit={visit}
            canAdmit={canAdmit}
            canViewPatientRecord={canViewPatientRecord}
          />
          <Grid align="flex-start" className={classes.workspaceGrid}>
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Stack className={classes.workspaceMain}>
                {(canViewTriage || canCreateTriage) && (
                  <Card id="er-triage" withBorder>
                    <Stack>
                      <Group gap="xs">
                        <IconHeartbeat size={18} />
                        <Text fw={700}>Triage</Text>
                      </Group>
                      <TriagePanel visitId={visit.id} canAppend={canCreateTriage} />
                      {!canViewTriage && canCreateTriage && (
                        <Text size="xs" c="dimmed">
                          This role can append triage entries, but full triage history is
                          restricted.
                        </Text>
                      )}
                    </Stack>
                  </Card>
                )}
                {(canViewResuscitation || canCreateResuscitation) && (
                  <Box id="er-resuscitation">
                    <ResuscitationVisitPanel
                      visitId={visit.id}
                      canView={canViewResuscitation}
                      canCreate={canCreateResuscitation}
                    />
                  </Box>
                )}
                <PatientConsumablesPanel
                  patientId={visit.patient_id}
                  encounterId={visit.encounter_id ?? visit.id}
                />
                <ErObservationPanel visitId={visit.id} />
                <ErDischargeSummaryPanel visitId={visit.id} />
                {shouldShowMlcWorkspace && (
                  <Box id="mlc">
                    <Stack>
                      <Group gap="xs">
                        <IconGavel size={18} />
                        <Text fw={700}>MLC case workspace</Text>
                      </Group>
                      {mlcCasesLoading ? (
                        <Text size="sm" c="dimmed">
                          Loading MLC case...
                        </Text>
                      ) : visitMlcCases.length > 0 ? (
                        <Stack>
                          {visitMlcCases.map((mlcCase) => (
                            <MlcCaseDetail
                              key={mlcCase.id}
                              mlcCase={mlcCase}
                              canViewPatientRecord={canViewPatientRecord}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
                          This visit is flagged as MLC, but no linked MLC case is available for your
                          current role.
                        </Alert>
                      )}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <EmergencyVisitContextRail
                visit={visit}
                canShowTriage={canViewTriage || canCreateTriage}
                canShowResuscitation={canViewResuscitation || canCreateResuscitation}
                canShowMlc={shouldShowMlcWorkspace}
              />
            </Grid.Col>
          </Grid>
        </>
      )}
    </Stack>
  );
}

// ── Triage Log Tab ──────────────────────────────────────
//
// CRDT-backed triage log: append-only ESI entries that survive a
// WAN outage. Picks a visit from the live ER queue; the panel
// below switches REST↔CRDT based on TenantConfigProvider.

function EmergencyVisitCommandBar({
  visit,
  canAdmit,
  canViewPatientRecord,
}: {
  visit: ErVisit;
  canAdmit: boolean;
  canViewPatientRecord: boolean;
}) {
  const { t } = useTranslation("emergency");
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const [admitOpen, admitHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ErAdmitFormInput>({
    resolver: zodResolver(erAdmitFormSchema),
    defaultValues: emptyErAdmitForm,
  });
  const canShowAdmit =
    canAdmit && ["registered", "triaged", "in_treatment", "observation"].includes(visit.status);
  const completedEvents = deriveEmergencyJourneyCompletedEvents(visit);
  const journeyContext: ClinicalJourneyContext = {
    patientId: visit.patient_id,
    isDeceased: visit.is_brought_dead,
    activeEmergencyVisitId: visit.id,
    activeAdmissionId: visit.admission_id,
    activeAdmissionStatus: visit.admission_id ? "admitted" : null,
    completedEvents,
  };
  const admitMutation = useMutation({
    mutationFn: (data: AdmitFromErRequest) => emergencyService.admitFromEr(visit.id, data),
    onSuccess: (result, request) => {
      emit("ipd.admission.created", {
        admission_id: result.admission_id,
        bed_id: result.bed_id,
        encounter_id: result.encounter_id,
        er_visit_id: result.er_visit_id,
        patient_id: result.patient_id,
        reason: request.admission_notes ?? visit.chief_complaint ?? "ER admission",
        source_record_id: result.admission_id,
        status: result.status,
        ward_id: result.ward_id,
      });
      emit("bed.assigned", {
        admission_id: result.admission_id,
        bed_id: result.bed_id,
        encounter_id: result.encounter_id,
        er_visit_id: result.er_visit_id,
        patient_id: result.patient_id,
        reason: request.admission_notes ?? visit.chief_complaint ?? "ER admission",
        source_record_id: result.admission_id,
        status: result.status,
        ward_id: result.ward_id,
      });
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      void qc.invalidateQueries({ queryKey: ["er-visit", visit.id] });
      void qc.invalidateQueries({ queryKey: ["admissions"] });
      void qc.invalidateQueries({ queryKey: ["admission-detail", result.admission_id] });
      void qc.invalidateQueries({ queryKey: ["ipd-bed-dashboard-summary"] });
      void qc.invalidateQueries({ queryKey: ["ipd-bed-dashboard-beds"] });
      toast.success(t("notify.erVisitLinkedToIpd"), { title: t("notify.patientAdmitted") });
      reset(emptyErAdmitForm);
      admitHandlers.close();
    },
  });

  const submitAdmit = (values: ErAdmitFormInput) => {
    if (!canShowAdmit) return;
    admitMutation.mutate({
      bed_id: values.bed_id,
      admitting_doctor_id: values.admitting_doctor_id,
      admission_notes: emergencyOptionalText(values.admission_notes),
    });
  };

  return (
    <Card withBorder className={classes.commandBar}>
      <Stack>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            {canViewPatientRecord ? (
              <PatientContextBanner patientId={visit.patient_id} hideLoadingState />
            ) : (
              <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
                {t("patient.restrictedIdentity")}
              </Alert>
            )}
            <PatientFlowNavigator
              patientId={visit.patient_id}
              active="emergency"
              activeEmergencyVisitId={visit.id}
              activeAdmissionId={visit.admission_id}
              completedEvents={completedEvents}
              compact
            />
            <PatientJourneyActions
              context={journeyContext}
              hiddenActionIds={[
                "emergency.open_visit",
                visit.admission_id ? "ipd.admit" : "ipd.open_admission",
              ]}
              size="xs"
            />
            <Group gap="xs">
              <Text fw={700}>{t("visit.number", { number: visit.visit_number })}</Text>
              <EmergencyVisitSignals visit={visit} />
            </Group>
          </Stack>
          {canShowAdmit && (
            <Button
              tone="primary"
              leftSection={<IconBuildingHospital size={14} />}
              onClick={admitHandlers.open}
            >
              {t("label.admitToIpd")}
            </Button>
          )}
        </Group>
      </Stack>
      <FormModal
        opened={admitOpen}
        onClose={() => {
          admitHandlers.close();
          reset(emptyErAdmitForm);
        }}
        title={t("title.admitPatientToIpd")}
        size="md"
        onSubmit={handleSubmit(submitAdmit)}
        submitLabel={t("label.confirmAdmission")}
        submitColor="teal"
        submitIcon={<IconBuildingHospital size={16} />}
        submitting={admitMutation.isPending}
      >
        <Controller
          name="bed_id"
          control={control}
          render={({ field }) => (
            <BedSelect value={field.value} onChange={field.onChange} required />
          )}
        />
        {errors.bed_id?.message && (
          <Text size="xs" c="danger">
            {errors.bed_id.message}
          </Text>
        )}
        <Controller
          name="admitting_doctor_id"
          control={control}
          render={({ field }) => (
            <DoctorSearchSelect
              label={t("label.admittingDoctor")}
              value={field.value}
              onChange={field.onChange}
              required
            />
          )}
        />
        {errors.admitting_doctor_id?.message && (
          <Text size="xs" c="danger">
            {errors.admitting_doctor_id.message}
          </Text>
        )}
        <Controller
          name="admission_notes"
          control={control}
          render={({ field }) => (
            <Textarea
              label={t("label.admissionNotes")}
              {...field}
              placeholder={t("placeholder.reasonForAdmission,ClinicalNotes...")}
              minRows={3}
            />
          )}
        />
      </FormModal>
    </Card>
  );
}

function EmergencyVisitContextRail({
  visit,
  canShowTriage,
  canShowResuscitation,
  canShowMlc,
}: {
  visit: ErVisit;
  canShowTriage: boolean;
  canShowResuscitation: boolean;
  canShowMlc: boolean;
}) {
  const { t } = useTranslation("emergency");
  const navigate = useNavigate();

  return (
    <Box className={classes.contextRail}>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {t("workspace.title")}
          </Text>
          <Text size="sm" fw={700}>
            {visit.visit_number}
          </Text>
        </Stack>
        <EmergencyVisitSignals visit={visit} />
        <Divider />
        <Stack gap="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">
            {t("workspace.navigate")}
          </Text>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconHeartbeat size={14} />}
            component="a"
            href="#er-triage"
            disabled={!canShowTriage}
            fullWidth
          >
            {t("workspace.triage")}
          </Button>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconFirstAidKit size={14} />}
            component="a"
            href="#er-resuscitation"
            disabled={!canShowResuscitation}
            fullWidth
          >
            {t("workspace.resuscitation")}
          </Button>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconUrgent size={14} />}
            onClick={() => navigate("/emergency?tab=visits")}
            fullWidth
          >
            {t("workspace.erQueue")}
          </Button>
          {visit.is_mlc && (
            <Button
              tone="subtle-danger"
              size="xs"
              leftSection={<IconGavel size={14} />}
              component="a"
              href="#mlc"
              disabled={!canShowMlc}
              fullWidth
            >
              {t("workspace.mlcCase")}
            </Button>
          )}
          {visit.admission_id && (
            <Button
              tone="secondary"
              size="xs"
              leftSection={<IconBuildingHospital size={14} />}
              onClick={() => navigate(`/ipd/admissions/${visit.admission_id}#overview`)}
              fullWidth
            >
              {t("workspace.ipdAdmission")}
            </Button>
          )}
        </Stack>
        <Divider />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 1 }}>
          <VisitSummaryValue
            label={t("summary.arrival")}
            value={new Date(visit.arrival_time).toLocaleString()}
          />
          <VisitSummaryValue label={t("summary.mode")} value={visit.arrival_mode ?? "---"} />
          <VisitSummaryValue label={t("summary.bay")} value={visit.bay_number ?? "---"} />
          <VisitSummaryValue
            label={t("summary.chiefComplaint")}
            value={visit.chief_complaint ?? "---"}
          />
          <VisitSummaryValue label={t("summary.disposition")} value={visit.disposition ?? "---"} />
          <VisitSummaryValue
            label={t("summary.doorToDoctor")}
            value={
              visit.door_to_doctor_mins !== null
                ? t("summary.minutes", { minutes: visit.door_to_doctor_mins })
                : t("summary.pending")
            }
          />
          <VisitSummaryValue
            label={t("summary.doorToDisposition")}
            value={
              visit.door_to_disposition_mins !== null
                ? t("summary.minutes", { minutes: visit.door_to_disposition_mins })
                : t("summary.pending")
            }
          />
          <VisitSummaryValue
            label={t("summary.admission")}
            value={visit.admission_id ? t("signals.ipdAdmission") : "---"}
          />
        </SimpleGrid>
        {visit.notes && (
          <Paper withBorder p="sm">
            <Text size="xs" c="dimmed">
              {t("summary.notes")}
            </Text>
            <Text size="sm">{visit.notes}</Text>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

function VisitSummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </Stack>
  );
}
