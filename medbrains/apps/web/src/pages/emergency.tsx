import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type EmergencyResuscitationLogFormInput,
  type ErAdmitFormInput,
  type ErVisitFormInput,
  emergencyResuscitationLogFormSchema,
  erAdmitFormSchema,
  erVisitFormSchema,
  type MlcCaseFormInput,
  type MlcCaseUpdateFormInput,
  mlcCaseFormSchema,
  mlcCaseUpdateFormSchema,
} from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  AdmitFromErRequest,
  ClinicalEventName,
  ClinicalJourneyContext,
  CreateErVisitRequest,
  CreateMlcCaseRequest,
  CreateResuscitationLogRequest,
  ErResuscitationLog,
  ErVisit,
  MlcCase,
  UpdateMlcCaseRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconArrowLeft,
  IconBed,
  IconBuildingHospital,
  IconFileText,
  IconFirstAidKit,
  IconGavel,
  IconHeartbeat,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconUrgent,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { DataTable, FormModal, OperationalSignal, PageHeader, TableValueBadge } from "@/components";
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
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, IconButton, toast } from "@/components/ui";
import {
  emergencyArrivalModeOptions,
  emergencyMlcBroughtByOptions,
  emergencyMlcCaseTypeOptions,
  emergencyMlcStatusOptions,
  emergencyOptionalInteger,
  emergencyOptionalText,
  emergencyResuscitationLogTypeOptions,
} from "@/forms/emergency.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";
import { emergencyService } from "@/services/emergency.service";
import { billingInvoiceWorkspaceRoute } from "./billing-workspace";
import { CodesTab } from "./emergency/codes";
import { MassCasualtyTab } from "./emergency/mass-casualty";
import { MlcCaseDetail } from "./emergency/mlc-case-detail";
import { ResuscitationTab } from "./emergency/resuscitation";
import {
  canEditSensitiveField,
  canViewSensitiveField,
  emptyResuscitationLogForm,
  RestrictedValue,
  renderSensitiveValue,
  resuscitationLogColor,
  resuscitationLogDetails,
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
import { VisitsTab } from "./emergency/visits";
import classes from "./emergency.module.scss";
import { emergencyTabFromSearch, emergencyVisibleTab } from "./emergency-workspace";

const emptyErVisitForm: ErVisitFormInput = {
  patient_id: "",
  arrival_mode: "",
  chief_complaint: "",
  bay_number: "",
  is_mlc: false,
  notes: "",
};

const emptyErAdmitForm: ErAdmitFormInput = {
  bed_id: "",
  admitting_doctor_id: "",
  admission_notes: "",
};

const emptyMlcCaseForm: MlcCaseFormInput = {
  patient_id: "",
  case_type: "",
  fir_number: "",
  police_station: "",
  brought_by: "",
  informant_name: "",
  informant_relation: "",
  informant_contact: "",
  history_of_incident: "",
  is_pocso: false,
  is_death_case: false,
};

const emptyMlcCaseUpdateForm: MlcCaseUpdateFormInput = {
  status: "registered",
  case_type: "",
  fir_number: "",
  police_station: "",
  examination_findings: "",
  medical_opinion: "",
  cause_of_death: "",
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

function mlcCaseClinicalPayload(mlcCase: MlcCase): Record<string, unknown> {
  return {
    source_record_id: mlcCase.id,
    mlc_case_id: mlcCase.id,
    mlc_number: mlcCase.mlc_number,
    patient_id: mlcCase.patient_id,
    er_visit_id: mlcCase.er_visit_id,
    status: mlcCase.status,
    registered_at: mlcCase.registered_at,
  };
}

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

function EmergencyVisitForm({
  initialPatientId,
  canCreateMlc,
  canViewPatientRecord,
  onCancel,
  onSuccess,
}: {
  initialPatientId: string;
  canCreateMlc: boolean;
  canViewPatientRecord: boolean;
  onCancel: () => void;
  onSuccess: (visit: ErVisit) => void;
}) {
  const { t } = useTranslation("emergency");
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ErVisitFormInput>({
    resolver: zodResolver(erVisitFormSchema),
    defaultValues: { ...emptyErVisitForm, patient_id: initialPatientId },
  });
  const selectedPatientId = watch("patient_id");
  const mutation = useMutation({
    mutationFn: (d: CreateErVisitRequest) => emergencyService.createErVisit(d),
    onSuccess: (visit) => {
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      void qc.invalidateQueries({ queryKey: ["er-visit", visit.id] });
      emit("emergency.visit.created", {
        source_record_id: visit.id,
        patient_id: visit.patient_id,
        visit_id: visit.id,
        visit_number: visit.visit_number,
        arrival_mode: visit.arrival_mode,
        arrival_time: visit.arrival_time,
        bay_number: visit.bay_number,
        chief_complaint: visit.chief_complaint,
        is_mlc: visit.is_mlc,
        is_brought_dead: visit.is_brought_dead,
        mass_casualty_event_id: visit.mass_casualty_event_id,
        status: visit.status,
        triage_level: visit.triage_level,
      });
      reset({ ...emptyErVisitForm, patient_id: initialPatientId });
      toast.success(t("notify.erVisitReadyForTriage"), { title: t("notify.erVisitRegistered") });
      onSuccess(visit);
    },
  });

  const submitErVisit = (values: ErVisitFormInput) => {
    mutation.mutate({
      patient_id: values.patient_id,
      arrival_mode: values.arrival_mode || undefined,
      chief_complaint: emergencyOptionalText(values.chief_complaint),
      is_mlc: canCreateMlc ? values.is_mlc : false,
      bay_number: emergencyOptionalText(values.bay_number),
      notes: emergencyOptionalText(values.notes),
    });
  };

  return (
    <Card withBorder>
      <Stack component="form" onSubmit={handleSubmit(submitErVisit)}>
        <Controller
          name="patient_id"
          control={control}
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.patient_id?.message}
            />
          )}
        />
        {canViewPatientRecord && selectedPatientId && (
          <PatientContextBanner patientId={selectedPatientId} hideLoadingState />
        )}
        {!canViewPatientRecord && selectedPatientId && (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            {t("patient.restrictedIdentity")}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Controller
            name="arrival_mode"
            control={control}
            render={({ field }) => (
              <Select
                label={t("label.arrivalMode")}
                data={emergencyArrivalModeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.arrival_mode?.message}
              />
            )}
          />
          <Controller
            name="bay_number"
            control={control}
            render={({ field }) => <TextInput label={t("label.bayNumber")} {...field} />}
          />
        </SimpleGrid>
        <Controller
          name="chief_complaint"
          control={control}
          render={({ field }) => <TextInput label={t("label.chiefComplaint")} {...field} />}
        />
        {canCreateMlc ? (
          <Controller
            name="is_mlc"
            control={control}
            render={({ field }) => (
              <Select
                label={t("label.medicoLegalCase")}
                data={[
                  { value: "true", label: t("label.yes") },
                  { value: "false", label: t("label.no") },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
        ) : (
          <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
            {t("mlc.permissionRequired")}
          </Alert>
        )}
        <Controller
          name="notes"
          control={control}
          render={({ field }) => <Textarea label={t("label.notes")} {...field} />}
        />
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onCancel}>
            {t("label.cancel")}
          </Button>
          <Button tone="primary" type="submit" loading={mutation.isPending}>
            {t("register")}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

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

function ResuscitationVisitPanel({
  visitId,
  canView,
  canCreate,
}: {
  visitId: string;
  canView: boolean;
  canCreate: boolean;
}) {
  const qc = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmergencyResuscitationLogFormInput>({
    resolver: zodResolver(emergencyResuscitationLogFormSchema),
    defaultValues: { ...emptyResuscitationLogForm, er_visit_id: visitId },
  });
  const selectedLogType = watch("log_type");
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["er-resuscitation-logs", visitId],
    queryFn: () => emergencyService.listResuscitationLogs(visitId),
    enabled: canView,
  });
  const mutation = useMutation({
    mutationFn: (data: CreateResuscitationLogRequest) =>
      emergencyService.createResuscitationLog(visitId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-resuscitation-logs", visitId] });
      reset({ ...emptyResuscitationLogForm, er_visit_id: visitId });
      toast.success("The ER resuscitation log has been updated.", {
        title: "Resuscitation entry saved",
      });
    },
  });

  const submitResuscitationLog = (values: EmergencyResuscitationLogFormInput) => {
    if (!canCreate) return;
    mutation.mutate({
      log_type: values.log_type,
      medication_name: emergencyOptionalText(values.medication_name),
      dose: emergencyOptionalText(values.dose),
      route: emergencyOptionalText(values.route),
      fluid_name: emergencyOptionalText(values.fluid_name),
      fluid_volume_ml: emergencyOptionalInteger(values.fluid_volume_ml),
      procedure_name: emergencyOptionalText(values.procedure_name),
      procedure_notes: emergencyOptionalText(values.procedure_notes),
      notes: emergencyOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "timestamp",
      label: "Time",
      render: (row: ErResuscitationLog) => (
        <Text size="sm">{new Date(row.timestamp).toLocaleString()}</Text>
      ),
    },
    {
      key: "log_type",
      label: "Type",
      render: (row: ErResuscitationLog) => (
        <Badge tone={resuscitationLogColor(row.log_type)}>{row.log_type.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "details",
      label: "Details",
      render: (row: ErResuscitationLog) => <Text size="sm">{resuscitationLogDetails(row)}</Text>,
    },
    {
      key: "notes",
      label: "Notes",
      render: (row: ErResuscitationLog) => (
        <Text size="sm" c={row.notes ? undefined : "dimmed"}>
          {row.notes ?? "---"}
        </Text>
      ),
    },
  ];

  return (
    <Card withBorder>
      <Stack>
        <Group gap="xs">
          <IconFirstAidKit size={18} />
          <Text fw={700}>Resuscitation</Text>
        </Group>
        {canCreate && (
          <Paper
            component="form"
            withBorder
            radius="md"
            p="md"
            onSubmit={handleSubmit(submitResuscitationLog)}
          >
            <Stack>
              <Controller
                name="log_type"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Entry type"
                    data={emergencyResuscitationLogTypeOptions}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "medication")}
                    error={errors.log_type?.message}
                  />
                )}
              />
              {selectedLogType === "medication" && (
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Controller
                    name="medication_name"
                    control={control}
                    render={({ field }) => (
                      <TextInput
                        label="Medication"
                        required
                        error={errors.medication_name?.message}
                        {...field}
                      />
                    )}
                  />
                  <Controller
                    name="dose"
                    control={control}
                    render={({ field }) => (
                      <TextInput label="Dose" required error={errors.dose?.message} {...field} />
                    )}
                  />
                  <Controller
                    name="route"
                    control={control}
                    render={({ field }) => (
                      <TextInput label="Route" required error={errors.route?.message} {...field} />
                    )}
                  />
                </SimpleGrid>
              )}
              {selectedLogType === "fluid" && (
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Controller
                    name="fluid_name"
                    control={control}
                    render={({ field }) => (
                      <TextInput
                        label="Fluid"
                        required
                        error={errors.fluid_name?.message}
                        {...field}
                      />
                    )}
                  />
                  <Controller
                    name="fluid_volume_ml"
                    control={control}
                    render={({ field }) => (
                      <NumberInput
                        label="Volume ml"
                        required
                        min={1}
                        step={50}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.fluid_volume_ml?.message}
                      />
                    )}
                  />
                  <Controller
                    name="route"
                    control={control}
                    render={({ field }) => (
                      <TextInput label="Route" required error={errors.route?.message} {...field} />
                    )}
                  />
                </SimpleGrid>
              )}
              {["procedure", "airway", "cpr", "defibrillation"].includes(selectedLogType) && (
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Controller
                    name="procedure_name"
                    control={control}
                    render={({ field }) => (
                      <TextInput
                        label="Procedure/action"
                        required
                        error={errors.procedure_name?.message}
                        {...field}
                      />
                    )}
                  />
                  <Controller
                    name="procedure_notes"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label="Procedure notes"
                        error={errors.procedure_notes?.message}
                        {...field}
                      />
                    )}
                  />
                </SimpleGrid>
              )}
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Textarea
                    label="Clinical notes"
                    minRows={2}
                    error={errors.notes?.message}
                    {...field}
                  />
                )}
              />
              <Group justify="flex-end">
                <Button
                  tone="primary"
                  type="submit"
                  leftSection={<IconPlus size={16} />}
                  loading={mutation.isPending}
                >
                  Save Entry
                </Button>
              </Group>
            </Stack>
          </Paper>
        )}
        {canView ? (
          <DataTable columns={columns} data={logs} loading={isLoading} rowKey={(row) => row.id} />
        ) : (
          <Text size="sm" c="dimmed">
            This role can create resuscitation entries, but the resuscitation log list is
            restricted.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function MlcTab({
  canList,
  canViewDetails,
  canCreate,
  canUpdate,
  canViewPatientRecord,
  contextAction,
  contextPatientId,
}: {
  canList: boolean;
  canViewDetails: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canViewPatientRecord: boolean;
  contextAction: string;
  contextPatientId: string;
}) {
  const contextMlcDefaults = { ...emptyMlcCaseForm, patient_id: contextPatientId };
  const shouldOpenContextMlc = canCreate && contextAction === "new" && Boolean(contextPatientId);
  const [opened, { open, close }] = useDisclosure(shouldOpenContextMlc);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [updateOpened, { open: openUpdate, close: closeUpdate }] = useDisclosure(false);
  const [selectedCase, setSelectedCase] = useState<MlcCase | null>(null);
  const [caseToUpdate, setCaseToUpdate] = useState<MlcCase | null>(null);
  const qc = useQueryClient();
  const emit = useClinicalEmit();
  const firNumberAccess = useFieldAccess("emergency.mlc.fir_number");
  const policeStationAccess = useFieldAccess("emergency.mlc.police_station");
  const informantNameAccess = useFieldAccess("emergency.mlc.informant_name");
  const informantRelationAccess = useFieldAccess("emergency.mlc.informant_relation");
  const informantContactAccess = useFieldAccess("emergency.mlc.informant_contact");
  const historyAccess = useFieldAccess("emergency.mlc.history_of_incident");
  const examinationAccess = useFieldAccess("emergency.mlc.examination_findings");
  const medicalOpinionAccess = useFieldAccess("emergency.mlc.medical_opinion");
  const causeOfDeathAccess = useFieldAccess("emergency.mlc.cause_of_death");
  const canEditFirNumber = canEditSensitiveField(firNumberAccess);
  const canEditPoliceStation = canEditSensitiveField(policeStationAccess);
  const canEditInformantName = canEditSensitiveField(informantNameAccess);
  const canEditInformantRelation = canEditSensitiveField(informantRelationAccess);
  const canEditInformantContact = canEditSensitiveField(informantContactAccess);
  const canEditHistory = canEditSensitiveField(historyAccess);
  const canEditExamination = canEditSensitiveField(examinationAccess);
  const canEditMedicalOpinion = canEditSensitiveField(medicalOpinionAccess);
  const canEditCauseOfDeath = canEditSensitiveField(causeOfDeathAccess);
  const { data = [], isLoading } = useQuery({
    queryKey: ["mlc-cases"],
    queryFn: () => emergencyService.listMlcCases(),
    enabled: canList,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MlcCaseFormInput>({
    resolver: zodResolver(mlcCaseFormSchema),
    defaultValues: contextMlcDefaults,
  });
  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<MlcCaseUpdateFormInput>({
    resolver: zodResolver(mlcCaseUpdateFormSchema),
    defaultValues: emptyMlcCaseUpdateForm,
  });
  const selectedPatientId = watch("patient_id");
  const mutation = useMutation({
    mutationFn: (d: CreateMlcCaseRequest) => emergencyService.createMlcCase(d),
    onError: (e: Error) =>
      notifications.show({
        title: "Could not register MLC case",
        message: e.message,
        color: "red",
      }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["mlc-cases"] });
      emit("mlc.created", mlcCaseClinicalPayload(row));
      close();
      reset(contextMlcDefaults);
      notifications.show({ title: "Success", message: "MLC case registered" });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: string; data: UpdateMlcCaseRequest }) =>
      emergencyService.updateMlcCase(id, payload),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["mlc-cases"] });
      setSelectedCase((current) => (current?.id === row.id ? row : current));
      closeUpdate();
      setCaseToUpdate(null);
      resetUpdate(emptyMlcCaseUpdateForm);
      notifications.show({ title: "MLC Updated", message: "MLC case details updated" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "MLC update blocked", message: e.message, color: "red" }),
  });

  const mlcStatusColor = (s: string) => {
    switch (s) {
      case "registered":
        return "primary";
      case "under_investigation":
        return "orange";
      case "opinion_given":
        return "teal";
      case "court_pending":
        return "warning";
      case "closed":
        return "success";
      default:
        return "gray";
    }
  };

  const handleViewCase = (mlc: MlcCase) => {
    setSelectedCase(mlc);
    openDetail();
  };

  const editableMlcCaseType = (caseType: string | null): MlcCaseUpdateFormInput["case_type"] => {
    switch (caseType) {
      case "assault":
      case "rta":
      case "burn":
      case "poisoning":
      case "sexual_assault":
      case "suicide_attempt":
      case "unknown":
        return caseType;
      default:
        return "";
    }
  };

  const handleOpenUpdateCase = (mlc: MlcCase) => {
    setCaseToUpdate(mlc);
    resetUpdate({
      status: mlc.status,
      case_type: editableMlcCaseType(mlc.case_type),
      fir_number: mlc.fir_number ?? "",
      police_station: mlc.police_station ?? "",
      examination_findings: mlc.examination_findings ?? "",
      medical_opinion: mlc.medical_opinion ?? "",
      cause_of_death: mlc.cause_of_death ?? "",
    });
    openUpdate();
  };

  const handleCloseUpdateCase = () => {
    closeUpdate();
    setCaseToUpdate(null);
    resetUpdate(emptyMlcCaseUpdateForm);
  };

  const submitMlcCase = (values: MlcCaseFormInput) => {
    mutation.mutate({
      patient_id: values.patient_id,
      case_type: values.case_type || undefined,
      fir_number: canEditFirNumber ? emergencyOptionalText(values.fir_number) : undefined,
      police_station: canEditPoliceStation
        ? emergencyOptionalText(values.police_station)
        : undefined,
      brought_by: values.brought_by || undefined,
      informant_name: canEditInformantName
        ? emergencyOptionalText(values.informant_name)
        : undefined,
      informant_relation: canEditInformantRelation
        ? emergencyOptionalText(values.informant_relation)
        : undefined,
      informant_contact: canEditInformantContact
        ? emergencyOptionalText(values.informant_contact)
        : undefined,
      history_of_incident: canEditHistory
        ? emergencyOptionalText(values.history_of_incident)
        : undefined,
      is_pocso: values.is_pocso,
      is_death_case: values.is_death_case,
    });
  };

  const submitMlcCaseUpdate = (values: MlcCaseUpdateFormInput) => {
    if (!caseToUpdate) {
      return;
    }
    updateMutation.mutate({
      id: caseToUpdate.id,
      data: {
        status: values.status,
        case_type: values.case_type || undefined,
        fir_number: canEditFirNumber ? emergencyOptionalText(values.fir_number) : undefined,
        police_station: canEditPoliceStation
          ? emergencyOptionalText(values.police_station)
          : undefined,
        examination_findings: canEditExamination
          ? emergencyOptionalText(values.examination_findings)
          : undefined,
        medical_opinion: canEditMedicalOpinion
          ? emergencyOptionalText(values.medical_opinion)
          : undefined,
        cause_of_death: canEditCauseOfDeath
          ? emergencyOptionalText(values.cause_of_death)
          : undefined,
      },
    });
  };

  const columns = [
    {
      key: "mlc_number",
      label: "MLC #",
      render: (r: MlcCase) => <Text fw={600}>{r.mlc_number}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r: MlcCase) =>
        canViewPatientRecord ? (
          <PatientNameCell patientId={r.patient_id} showUhid={false} />
        ) : (
          <RestrictedValue />
        ),
    },
    {
      key: "registered_at",
      label: "Registered",
      render: (r: MlcCase) => new Date(r.registered_at).toLocaleString(),
    },
    {
      key: "case_type",
      label: "Type",
      render: (r: MlcCase) =>
        r.case_type ? <TableValueBadge value={r.case_type} kind="category" /> : "---",
    },
    {
      key: "status",
      label: "Status",
      render: (r: MlcCase) => (
        <TableValueBadge value={r.status} color={mlcStatusColor(r.status)} variant="filled" />
      ),
    },
    {
      key: "fir_number",
      label: "FIR #",
      render: (r: MlcCase) => renderSensitiveValue(firNumberAccess, r.fir_number),
    },
    {
      key: "police_station",
      label: "Police Station",
      render: (r: MlcCase) => renderSensitiveValue(policeStationAccess, r.police_station),
    },
    {
      key: "is_pocso",
      label: "POCSO",
      render: (r: MlcCase) =>
        r.is_pocso ? (
          <TableValueBadge
            value="mlc"
            kind="category"
            color="danger"
            label="POCSO"
            variant="filled"
          />
        ) : null,
    },
    {
      key: "is_death_case",
      label: "Death",
      render: (r: MlcCase) =>
        r.is_death_case ? (
          <TableValueBadge
            value="mlc"
            kind="category"
            color="dark"
            label="Death"
            variant="filled"
          />
        ) : null,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: MlcCase) => (
        <Group gap="xs">
          {canViewDetails && (
            <Tooltip label="View Details & Documents">
              <IconButton
                tone="primary"
                aria-label="View MLC case details and documents"
                onClick={() => handleViewCase(r)}
              >
                <IconFileText size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="Update MLC case">
              <IconButton
                tone="primary"
                aria-label="Update MLC case"
                disabled={updateMutation.isPending}
                onClick={() => handleOpenUpdateCase(r)}
              >
                <IconPencil size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(contextMlcDefaults);
              open();
            }}
          >
            Register MLC Case
          </Button>
        </Group>
      )}
      {canList ? (
        <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            MLC case list is not available for your role. You can register a new MLC case when MLC
            creation is allowed.
          </Text>
        </Card>
      )}

      <Drawer
        opened={updateOpened}
        onClose={handleCloseUpdateCase}
        title={caseToUpdate ? `Update ${caseToUpdate.mlc_number}` : "Update MLC Case"}
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleUpdateSubmit(submitMlcCaseUpdate)}>
          {caseToUpdate && (
            <Alert tone="warning" icon={<IconGavel size={16} />}>
              <Text size="sm" fw={600}>
                {caseToUpdate.mlc_number}
              </Text>
              <Text size="sm" c="dimmed">
                Registered {new Date(caseToUpdate.registered_at).toLocaleString()}
              </Text>
            </Alert>
          )}
          <Controller
            name="status"
            control={updateControl}
            render={({ field }) => (
              <Select
                label="Case status"
                required
                data={emergencyMlcStatusOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "registered")}
                error={updateErrors.status?.message}
              />
            )}
          />
          <Controller
            name="case_type"
            control={updateControl}
            render={({ field }) => (
              <Select
                label="Case type"
                data={emergencyMlcCaseTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={updateErrors.case_type?.message}
              />
            )}
          />
          {canViewSensitiveField(firNumberAccess) && (
            <Controller
              name="fir_number"
              control={updateControl}
              render={({ field }) => (
                <TextInput label="FIR Number" disabled={!canEditFirNumber} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(policeStationAccess) && (
            <Controller
              name="police_station"
              control={updateControl}
              render={({ field }) => (
                <TextInput label="Police Station" disabled={!canEditPoliceStation} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(examinationAccess) && (
            <Controller
              name="examination_findings"
              control={updateControl}
              render={({ field }) => (
                <Textarea
                  label="Examination findings"
                  disabled={!canEditExamination}
                  minRows={3}
                  {...field}
                />
              )}
            />
          )}
          {canViewSensitiveField(medicalOpinionAccess) && (
            <Controller
              name="medical_opinion"
              control={updateControl}
              render={({ field }) => (
                <Textarea
                  label="Medical opinion"
                  disabled={!canEditMedicalOpinion}
                  minRows={3}
                  {...field}
                />
              )}
            />
          )}
          {canViewSensitiveField(causeOfDeathAccess) && (
            <Controller
              name="cause_of_death"
              control={updateControl}
              render={({ field }) => (
                <Textarea
                  label="Cause of death"
                  disabled={!canEditCauseOfDeath}
                  minRows={2}
                  {...field}
                />
              )}
            />
          )}
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleCloseUpdateCase}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={updateMutation.isPending}>
              Save Update
            </Button>
          </Group>
        </Stack>
      </Drawer>

      {/* Create MLC Drawer */}
      <Drawer opened={opened} onClose={close} title="Register MLC Case" position="right" size="lg">
        <Stack component="form" onSubmit={handleSubmit(submitMlcCase)}>
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {errors.patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.patient_id.message}
            </Text>
          )}
          {canViewPatientRecord && (
            <PatientContextBanner patientId={selectedPatientId} hideLoadingState />
          )}
          <Controller
            name="case_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Case Type"
                data={emergencyMlcCaseTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.case_type?.message}
              />
            )}
          />
          {canViewSensitiveField(firNumberAccess) && (
            <Controller
              name="fir_number"
              control={control}
              render={({ field }) => (
                <TextInput label="FIR Number" disabled={!canEditFirNumber} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(policeStationAccess) && (
            <Controller
              name="police_station"
              control={control}
              render={({ field }) => (
                <TextInput label="Police Station" disabled={!canEditPoliceStation} {...field} />
              )}
            />
          )}
          <Controller
            name="brought_by"
            control={control}
            render={({ field }) => (
              <Select
                label="Brought By"
                data={emergencyMlcBroughtByOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.brought_by?.message}
              />
            )}
          />
          {canViewSensitiveField(informantNameAccess) && (
            <Controller
              name="informant_name"
              control={control}
              render={({ field }) => (
                <TextInput label="Informant Name" disabled={!canEditInformantName} {...field} />
              )}
            />
          )}
          {canViewSensitiveField(informantRelationAccess) && (
            <Controller
              name="informant_relation"
              control={control}
              render={({ field }) => (
                <TextInput
                  label="Informant Relation"
                  disabled={!canEditInformantRelation}
                  {...field}
                />
              )}
            />
          )}
          {canViewSensitiveField(informantContactAccess) && (
            <Controller
              name="informant_contact"
              control={control}
              render={({ field }) => (
                <TextInput
                  label="Informant Contact"
                  disabled={!canEditInformantContact}
                  {...field}
                  error={errors.informant_contact?.message}
                />
              )}
            />
          )}
          {canViewSensitiveField(historyAccess) && (
            <Controller
              name="history_of_incident"
              control={control}
              render={({ field }) => (
                <Textarea
                  label="History of Incident"
                  disabled={!canEditHistory}
                  {...field}
                  minRows={3}
                />
              )}
            />
          )}
          <Controller
            name="is_pocso"
            control={control}
            render={({ field }) => (
              <Select
                label="POCSO Case"
                data={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
          <Controller
            name="is_death_case"
            control={control}
            render={({ field }) => (
              <Select
                label="Death Case"
                data={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
                value={field.value ? "true" : "false"}
                onChange={(value) => field.onChange(value === "true")}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={mutation.isPending}>
            Register MLC Case
          </Button>
        </Stack>
      </Drawer>

      {/* MLC Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={() => {
          closeDetail();
          setSelectedCase(null);
        }}
        title={selectedCase ? `MLC Case: ${selectedCase.mlc_number}` : "MLC Case Details"}
        position="right"
        size="xl"
      >
        {selectedCase && (
          <MlcCaseDetail mlcCase={selectedCase} canViewPatientRecord={canViewPatientRecord} />
        )}
      </Drawer>
    </Stack>
  );
}

// ── Mass Casualty Tab ──────────────────────────────────
