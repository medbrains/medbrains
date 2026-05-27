import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Group,
  Menu,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type EmergencyCodeActivationFormInput,
  type EmergencyCodeDeactivateFormInput,
  type EmergencyResuscitationLogFormInput,
  type ErAdmitFormInput,
  type ErVisitFormInput,
  emergencyCodeActivationFormSchema,
  emergencyCodeDeactivateFormSchema,
  emergencyResuscitationLogFormSchema,
  erAdmitFormSchema,
  erVisitFormSchema,
  type MassCasualtyEventFormInput,
  type MassCasualtyEventUpdateFormInput,
  type MlcAgeEstimationFormInput,
  type MlcCaseFormInput,
  type MlcCaseUpdateFormInput,
  type MlcCourtSummonsFormInput,
  type MlcPocsoReportFormInput,
  type MlcPoliceIntimationFormInput,
  type MlcPoliceReceiptConfirmationFormInput,
  type MlcPrintPacketTypeFormValue,
  type MlcPrintReprintFormInput,
  type MlcSbarFormInput,
  massCasualtyEventFormSchema,
  massCasualtyEventUpdateFormSchema,
  mlcAgeEstimationFormSchema,
  mlcCaseFormSchema,
  mlcCaseUpdateFormSchema,
  mlcCourtSummonsFormSchema,
  mlcPocsoReportFormSchema,
  mlcPoliceIntimationFormSchema,
  mlcPoliceReceiptConfirmationFormSchema,
  mlcPrintReprintFormSchema,
  mlcSbarFormSchema,
} from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  AdmitFromErRequest,
  CreateCodeActivationRequest,
  CreateErVisitRequest,
  CreateMassCasualtyEventRequest,
  CreateMlcCaseRequest,
  CreateResuscitationLogRequest,
  DeactivateCodeRequest,
  ErCodeActivation,
  ErResuscitationLog,
  ErVisit,
  FieldAccessLevel,
  MassCasualtyEvent,
  MlcCase,
  MlcDocument,
  MlcDocumentationPrintData,
  MlcPoliceIntimation,
  MlcPoliceIntimationPrintData,
  MlcRegisterPrintData,
  UpdateMassCasualtyEventRequest,
  UpdateMlcCaseRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconBell,
  IconBuildingHospital,
  IconCheck,
  IconClock,
  IconFileText,
  IconFirstAidKit,
  IconGavel,
  IconHeartbeat,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconScale,
  IconShieldCheck,
  IconUrgent,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { DataTable, PageHeader, TableValueBadge } from "../components";
import { BedSelect } from "../components/BedSelect";
import { TriagePanel } from "../components/crdt/TriagePanel";
import { DoctorSearchSelect } from "../components/DoctorSearchSelect";
import { PatientContextBanner } from "../components/Patient/PatientContextBanner";
import { PatientNameCell } from "../components/PatientNameCell";
import { PatientSearchSelect } from "../components/PatientSearchSelect";
import {
  emergencyArrivalModeOptions,
  emergencyCodeDeactivateOutcomeOptions,
  emergencyCodeTypeOptions,
  emergencyMassCasualtyStatusOptions,
  emergencyMassCasualtyTypeOptions,
  emergencyMlcBroughtByOptions,
  emergencyMlcCaseTypeOptions,
  emergencyMlcPoliceSentViaOptions,
  emergencyMlcStatusOptions,
  emergencyOptionalInteger,
  emergencyOptionalText,
  emergencyResuscitationLogTypeOptions,
} from "../forms/emergency.form";
import { useRequirePermission } from "../hooks/useRequirePermission";
import {
  type ConfirmPoliceReceiptInput,
  type CreateMlcDocumentInput,
  type CreatePoliceIntimationInput,
  emergencyService,
} from "../services/emergency.service";

const CRASH_CART_ITEMS = [
  { key: "defibrillator_present", label: "Defibrillator present and functional" },
  { key: "defibrillator_charge_test", label: "Defibrillator charge test passed" },
  { key: "airway_equipment", label: "Airway equipment (ETT, laryngoscope, ambu bag)" },
  { key: "iv_access_supplies", label: "IV access supplies (cannulas, fluids, sets)" },
  { key: "adrenaline", label: "Adrenaline (Epinephrine) 1mg ampoules" },
  { key: "atropine", label: "Atropine 0.6mg ampoules" },
  { key: "amiodarone", label: "Amiodarone 150mg ampoules" },
  { key: "suction_equipment", label: "Suction equipment functional" },
  { key: "oxygen_supply", label: "Oxygen supply connected and flowing" },
  { key: "monitor_leads", label: "Cardiac monitor leads and pads" },
];

function canViewSensitiveField(access: FieldAccessLevel) {
  return access !== "hidden";
}

function canEditSensitiveField(access: FieldAccessLevel) {
  return access === "edit";
}

function RestrictedValue() {
  return (
    <Text span c="dimmed" size="sm">
      Restricted
    </Text>
  );
}

function renderSensitiveValue(access: FieldAccessLevel, value: string | null | undefined) {
  return fieldAccessText(access, value);
}

function printHtmlElement(title: string, element: HTMLElement | null) {
  if (!element) {
    return;
  }
  const popup = window.open("", "_blank", "width=820,height=920");
  if (!popup) {
    return;
  }
  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; margin: 24px; color: #18201b; }
          .print-page { max-width: 820px; margin: 0 auto; }
          .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
          .print-label { font-size: 11px; color: #66736b; text-transform: uppercase; letter-spacing: .04em; }
          .print-value { font-size: 14px; font-weight: 600; white-space: pre-wrap; }
          .print-section { margin-top: 18px; padding-top: 12px; border-top: 1px solid #dfe7e2; }
          .duplicate { color: #b45309; font-weight: 700; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${element.innerHTML}
      </body>
    </html>
  `);
  popup.document.close();
}

function mlcDocumentText(content: Record<string, unknown>, key: string) {
  const value = content[key];
  return typeof value === "string" && value.trim().length > 0 ? value : "---";
}

function mlcDocumentSensitiveText(
  access: FieldAccessLevel,
  content: Record<string, unknown>,
  key: string,
) {
  return renderSensitiveValue(access, mlcDocumentText(content, key));
}

function mlcDocumentSensitiveBoolean(
  access: FieldAccessLevel,
  content: Record<string, unknown>,
  key: string,
) {
  if (access !== "edit" && access !== "view") {
    return renderSensitiveValue(access, "Sensitive value");
  }
  return content[key] === true ? "Yes" : "No";
}

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

const emptyCodeActivationForm: EmergencyCodeActivationFormInput = {
  code_type: "code_blue",
  location: "",
  notes: "",
};

const emptyCodeDeactivateForm: EmergencyCodeDeactivateFormInput = {
  outcome: "resolved",
  notes: "",
};

const emptyResuscitationLogForm: EmergencyResuscitationLogFormInput = {
  er_visit_id: "",
  log_type: "medication",
  medication_name: "",
  dose: "",
  route: "",
  fluid_name: "",
  fluid_volume_ml: "",
  procedure_name: "",
  procedure_notes: "",
  notes: "",
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

const emptyMassCasualtyEventForm: MassCasualtyEventFormInput = {
  event_name: "",
  event_type: "",
  location: "",
  estimated_casualties: "",
  notes: "",
};

const emptyMassCasualtyEventUpdateForm: MassCasualtyEventUpdateFormInput = {
  status: "ongoing",
  actual_casualties: "",
  notes: "",
};

type EmergencyTabKey = "visits" | "triage" | "resuscitation" | "codes" | "mlc" | "mass-casualty";

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

function emergencyTabFromSearch(value: string | null): EmergencyTabKey | null {
  if (
    value === "visits" ||
    value === "triage" ||
    value === "resuscitation" ||
    value === "codes" ||
    value === "mlc" ||
    value === "mass-casualty"
  ) {
    return value;
  }

  return null;
}

// ── Triage helpers ────────────────────────────────────

interface TriageInfo {
  color: string;
  label: string;
  level: number;
}

function triageInfo(level: string | null): TriageInfo {
  switch (level) {
    case "immediate":
      return { color: "danger", label: "RED - Immediate", level: 1 };
    case "emergent":
      return { color: "orange", label: "ORANGE - Emergent", level: 2 };
    case "urgent":
      return { color: "warning", label: "YELLOW - Urgent", level: 3 };
    case "less_urgent":
      return { color: "success", label: "GREEN - Delayed", level: 4 };
    case "non_urgent":
      return { color: "primary", label: "BLUE - Non-Urgent", level: 5 };
    case "expectant":
      return { color: "dark", label: "BLACK - Expectant", level: 6 };
    default:
      return { color: "slate", label: "Unassigned", level: 0 };
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "registered":
      return "primary";
    case "triaged":
      return "cyan";
    case "in_treatment":
      return "orange";
    case "observation":
      return "warning";
    case "admitted":
      return "teal";
    case "discharged":
      return "success";
    case "transferred":
      return "violet";
    case "lama":
      return "danger";
    case "deceased":
      return "dark";
    default:
      return "gray";
  }
}

function resuscitationLogColor(logType: string): string {
  switch (logType) {
    case "medication":
      return "violet";
    case "fluid":
      return "cyan";
    case "procedure":
    case "airway":
      return "orange";
    case "cpr":
    case "defibrillation":
      return "danger";
    case "vitals":
      return "teal";
    default:
      return "gray";
  }
}

function resuscitationLogDetails(log: ErResuscitationLog): string {
  const parts = [
    log.medication_name,
    log.dose,
    log.route,
    log.fluid_name,
    log.fluid_volume_ml !== null && log.fluid_volume_ml !== undefined
      ? `${log.fluid_volume_ml} ml`
      : null,
    log.procedure_name,
  ].filter((item): item is string => Boolean(item));

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return log.procedure_notes ?? log.notes ?? "---";
}

// ── Timer Hook ─────────────────────────────────────────

function useTimer(startTime: string | null, endIndicator: number | null): string {
  const [elapsed, setElapsed] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatDuration = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!startTime) {
      setElapsed("");
      return;
    }

    const start = new Date(startTime).getTime();

    // Doctor already seen — show static duration
    if (endIndicator !== null && endIndicator !== undefined) {
      setElapsed(`${endIndicator} min`);
      return;
    }

    // Live ticking timer
    const update = () => {
      const now = Date.now();
      const diff = now - start;
      setElapsed(formatDuration(diff > 0 ? diff : 0));
    };
    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, endIndicator, formatDuration]);

  return elapsed;
}

// ── Inline Timer Component ────────────────────────────

function WaitTimeBadge({
  arrivalTime,
  doorToDoctorMins,
}: {
  arrivalTime: string;
  doorToDoctorMins: number | null;
}) {
  const display = useTimer(arrivalTime, doorToDoctorMins);

  if (!display)
    return (
      <Text size="sm" c="dimmed">
        --
      </Text>
    );

  if (doorToDoctorMins !== null && doorToDoctorMins !== undefined) {
    return (
      <Badge color="success" variant="light" size="lg" leftSection={<IconCheck size={12} />}>
        {display}
      </Badge>
    );
  }

  return (
    <Badge color="orange" variant="filled" size="lg" leftSection={<IconClock size={12} />}>
      {display}
    </Badge>
  );
}

// ── Main Page ──────────────────────────────────────────

export function EmergencyPage() {
  useRequirePermission(EMERGENCY_PAGE_PERMISSIONS);
  const { t } = useTranslation("emergency");
  const [searchParams] = useSearchParams();
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
  ].filter((item) => item.visible);
  const fallbackTab = availableTabs[0]?.value ?? "visits";
  const initialTab =
    requestedTab && availableTabs.some((item) => item.value === requestedTab)
      ? requestedTab
      : fallbackTab;
  const [activeTab, setActiveTab] = useState<EmergencyTabKey>(initialTab);
  const visibleActiveTab = availableTabs.some((item) => item.value === activeTab)
    ? activeTab
    : fallbackTab;

  return (
    <div>
      <PageHeader
        title={t("title.emergencyDepartment")}
        subtitle={t("subtitle.erVisits,Triage,MlcManagement,MassCasualty")}
      />
      {contextPatientId && canViewPatientRecord && (
        <PatientContextBanner patientId={contextPatientId} hideLoadingState />
      )}
      {contextPatientId && !canViewPatientRecord && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
          Patient context is restricted for this role.
        </Alert>
      )}
      {availableTabs.length === 0 ? (
        <Text c="dimmed" size="sm">
          No emergency work areas are available for your current role.
        </Text>
      ) : (
        <Tabs
          value={visibleActiveTab}
          onChange={(value) => {
            const nextTab = emergencyTabFromSearch(value);
            if (nextTab) {
              setActiveTab(nextTab);
            }
          }}
        >
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
                canCreateMlc={canCreateMlc}
                canViewPatientRecord={canViewPatientRecord}
                contextAction={contextAction}
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
        </Tabs>
      )}
    </div>
  );
}

// ── Triage Log Tab ──────────────────────────────────────
//
// CRDT-backed triage log: append-only ESI entries that survive a
// WAN outage. Picks a visit from the live ER queue; the panel
// below switches REST↔CRDT based on TenantConfigProvider.

function TriageLogTab({
  canAppend,
  canViewVisits,
}: {
  canAppend: boolean;
  canViewVisits: boolean;
}) {
  const [visitId, setVisitId] = useState<string | null>(null);
  const { data: visits = [] } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
    enabled: canViewVisits,
  });

  const options = (visits as ErVisit[]).map((v) => ({
    value: v.id,
    label: `${v.visit_number} — ${v.chief_complaint ?? "No complaint"}`,
  }));

  return (
    <Stack>
      {canViewVisits ? (
        <Select
          placeholder="Select an ER visit…"
          data={options}
          value={visitId}
          onChange={setVisitId}
          searchable
          clearable
          maxDropdownHeight={300}
        />
      ) : (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
          Triage review needs ER visit selector access so entries can be linked to a live visit.
        </Alert>
      )}
      {visitId ? (
        <TriagePanel visitId={visitId} canAppend={canAppend} />
      ) : (
        <Text size="sm" c="dimmed">
          Pick a visit to record or review triage entries.
        </Text>
      )}
    </Stack>
  );
}

// ── Resuscitation Tab ──────────────────────────────────

function ResuscitationTab({
  canView,
  canCreate,
  canViewVisits,
}: {
  canView: boolean;
  canCreate: boolean;
  canViewVisits: boolean;
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
    defaultValues: emptyResuscitationLogForm,
  });
  const selectedVisitId = watch("er_visit_id");
  const selectedLogType = watch("log_type");

  const { data: visits = [] } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
    enabled: canViewVisits,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["er-resuscitation-logs", selectedVisitId],
    queryFn: () => emergencyService.listResuscitationLogs(selectedVisitId),
    enabled: (canView || canCreate) && Boolean(selectedVisitId),
  });

  const mutation = useMutation({
    mutationFn: ({ visitId, data }: { visitId: string; data: CreateResuscitationLogRequest }) =>
      emergencyService.createResuscitationLog(visitId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-resuscitation-logs", selectedVisitId] });
      reset({ ...emptyResuscitationLogForm, er_visit_id: selectedVisitId });
      notifications.show({
        title: "Resuscitation entry saved",
        message: "The ER resuscitation log has been updated.",
        color: "success",
      });
    },
  });

  const visitOptions = visits.map((visit) => ({
    value: visit.id,
    label: [
      visit.visit_number,
      visit.bay_number ? `Bay ${visit.bay_number}` : null,
      visit.triage_level ? triageInfo(visit.triage_level).label : null,
      visit.chief_complaint ?? visit.status,
    ]
      .filter(Boolean)
      .join(" - "),
  }));

  const submitResuscitationLog = (values: EmergencyResuscitationLogFormInput) => {
    if (!canCreate) return;
    mutation.mutate({
      visitId: values.er_visit_id,
      data: {
        log_type: values.log_type,
        medication_name: emergencyOptionalText(values.medication_name),
        dose: emergencyOptionalText(values.dose),
        route: emergencyOptionalText(values.route),
        fluid_name: emergencyOptionalText(values.fluid_name),
        fluid_volume_ml: emergencyOptionalInteger(values.fluid_volume_ml),
        procedure_name: emergencyOptionalText(values.procedure_name),
        procedure_notes: emergencyOptionalText(values.procedure_notes),
        notes: emergencyOptionalText(values.notes),
      },
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
        <Badge color={resuscitationLogColor(row.log_type)} variant="light">
          {row.log_type.replace(/_/g, " ")}
        </Badge>
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
    <Stack>
      {canViewVisits ? (
        <Controller
          name="er_visit_id"
          control={control}
          render={({ field }) => (
            <Select
              label="ER visit"
              placeholder="Select an ER visit"
              data={visitOptions}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              searchable
              clearable
              maxDropdownHeight={320}
              error={errors.er_visit_id?.message}
            />
          )}
        />
      ) : (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
          Resuscitation entries must be linked to an ER visit, so this role needs ER visit list
          access for the selector.
        </Alert>
      )}

      {selectedVisitId && canCreate && (
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

      {selectedVisitId && canView && (
        <DataTable columns={columns} data={logs} loading={isLoading} rowKey={(row) => row.id} />
      )}
      {selectedVisitId && !canView && (
        <Text size="sm" c="dimmed">
          This role can create resuscitation entries, but the resuscitation log list is restricted.
        </Text>
      )}
      {!selectedVisitId && (
        <Text size="sm" c="dimmed">
          Pick an ER visit to record or review resuscitation activity.
        </Text>
      )}
    </Stack>
  );
}

// ── ER Visits Tab ──────────────────────────────────────

function VisitsTab({
  canView,
  canCreate,
  canCreateMlc,
  canViewPatientRecord,
  contextAction,
  contextPatientId,
}: {
  canView: boolean;
  canCreate: boolean;
  canCreateMlc: boolean;
  canViewPatientRecord: boolean;
  contextAction: string;
  contextPatientId: string;
}) {
  const contextVisitDefaults = { ...emptyErVisitForm, patient_id: contextPatientId };
  const shouldOpenContextVisit = canCreate && contextAction === "new" && Boolean(contextPatientId);
  const [opened, { open, close }] = useDisclosure(shouldOpenContextVisit);
  const [admitOpen, admitHandlers] = useDisclosure(false);
  const [admitVisitId, setAdmitVisitId] = useState<string | null>(null);
  const canUpdateVisit = useHasPermission(P.EMERGENCY.VISITS_UPDATE);
  const canCreateIpdAdmission = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const canAdmit = canUpdateVisit && canCreateIpdAdmission;
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ErVisitFormInput>({
    resolver: zodResolver(erVisitFormSchema),
    defaultValues: contextVisitDefaults,
  });
  const selectedPatientId = watch("patient_id");
  const mutation = useMutation({
    mutationFn: (d: CreateErVisitRequest) => emergencyService.createErVisit(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      close();
      reset(contextVisitDefaults);
      notifications.show({ title: "Success", message: "ER visit registered" });
    },
  });

  // Admit from ER
  const {
    control: admitControl,
    handleSubmit: handleAdmitSubmit,
    reset: resetAdmit,
    formState: { errors: admitErrors },
  } = useForm<ErAdmitFormInput>({
    resolver: zodResolver(erAdmitFormSchema),
    defaultValues: emptyErAdmitForm,
  });
  const admitMutation = useMutation({
    mutationFn: ({ visitId, data: d }: { visitId: string; data: AdmitFromErRequest }) =>
      emergencyService.admitFromEr(visitId, d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["er-visits"] });
      notifications.show({
        title: "Patient Admitted",
        message: "Patient has been admitted to IPD from ER",
        color: "success",
      });
      resetAdmit(emptyErAdmitForm);
      setAdmitVisitId(null);
      admitHandlers.close();
    },
  });

  const handleOpenAdmit = (visitId: string) => {
    setAdmitVisitId(visitId);
    resetAdmit(emptyErAdmitForm);
    admitHandlers.open();
  };

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

  const submitAdmitFromEr = (values: ErAdmitFormInput) => {
    if (!admitVisitId || !canAdmit) return;
    admitMutation.mutate({
      visitId: admitVisitId,
      data: {
        bed_id: values.bed_id,
        admitting_doctor_id: values.admitting_doctor_id,
        admission_notes: emergencyOptionalText(values.admission_notes),
      },
    });
  };

  const columns = [
    {
      key: "visit_number",
      label: "Visit #",
      render: (r: ErVisit) => <Text fw={600}>{r.visit_number}</Text>,
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (r: ErVisit) =>
        canViewPatientRecord ? (
          <PatientNameCell patientId={r.patient_id} showUhid={false} />
        ) : (
          <RestrictedValue />
        ),
    },
    {
      key: "arrival_time",
      label: "Arrival",
      render: (r: ErVisit) => new Date(r.arrival_time).toLocaleString(),
    },
    {
      key: "arrival_mode",
      label: "Mode",
      render: (r: ErVisit) =>
        r.arrival_mode ? (
          <TableValueBadge value={r.arrival_mode} kind="source" variant="outline" />
        ) : (
          "---"
        ),
    },
    {
      key: "chief_complaint",
      label: "Chief Complaint",
      render: (r: ErVisit) => r.chief_complaint ?? "---",
    },
    {
      key: "triage_level",
      label: "Triage",
      render: (r: ErVisit) => {
        const info = triageInfo(r.triage_level);
        if (!r.triage_level) {
          return (
            <Badge color="slate" size="lg" variant="outline">
              Unassigned
            </Badge>
          );
        }
        return (
          <Badge
            color={info.color}
            size="lg"
            variant="filled"
            leftSection={
              <ThemeIcon color={info.color} size="xs" radius="xl" variant="white">
                <Text size="xs" fw={900}>
                  {info.level}
                </Text>
              </ThemeIcon>
            }
          >
            {info.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r: ErVisit) => (
        <TableValueBadge value={r.status} color={statusColor(r.status)} variant="filled" />
      ),
    },
    {
      key: "is_mlc",
      label: "MLC",
      render: (r: ErVisit) =>
        r.is_mlc ? (
          <TableValueBadge
            value="mlc"
            kind="category"
            label="MLC"
            color="danger"
            variant="filled"
          />
        ) : null,
    },
    { key: "bay_number", label: "Bay", render: (r: ErVisit) => r.bay_number ?? "---" },
    {
      key: "wait_time",
      label: "Wait Time",
      render: (r: ErVisit) => (
        <WaitTimeBadge arrivalTime={r.arrival_time} doorToDoctorMins={r.door_to_doctor_mins} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: ErVisit) => {
        const canShowAdmit =
          canAdmit && ["registered", "triaged", "in_treatment", "observation"].includes(r.status);
        if (!canShowAdmit) return null;
        return (
          <Tooltip label="Admit to IPD">
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<IconBuildingHospital size={14} />}
              onClick={() => handleOpenAdmit(r.id)}
            >
              Admit
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(contextVisitDefaults);
              open();
            }}
          >
            Register ER Visit
          </Button>
        </Group>
      )}
      {canView ? (
        <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            ER visit queue is not available for your role. You can register a new ER visit when
            visit creation is allowed.
          </Text>
        </Card>
      )}

      <Drawer opened={opened} onClose={close} title="Register ER Visit" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitErVisit)}>
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
            name="arrival_mode"
            control={control}
            render={({ field }) => (
              <Select
                label="Arrival Mode"
                data={emergencyArrivalModeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.arrival_mode?.message}
              />
            )}
          />
          <Controller
            name="chief_complaint"
            control={control}
            render={({ field }) => <TextInput label="Chief Complaint" {...field} />}
          />
          <Controller
            name="bay_number"
            control={control}
            render={({ field }) => <TextInput label="Bay Number" {...field} />}
          />
          {canCreateMlc ? (
            <Controller
              name="is_mlc"
              control={control}
              render={({ field }) => (
                <Select
                  label="MLC"
                  data={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                  value={field.value ? "true" : "false"}
                  onChange={(value) => field.onChange(value === "true")}
                />
              )}
            />
          ) : (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              MLC marking creates a medico-legal case and requires MLC create permission.
            </Alert>
          )}
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button type="submit" loading={mutation.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>

      {/* Admit to IPD Modal */}
      <Modal
        opened={admitOpen}
        onClose={() => {
          admitHandlers.close();
          setAdmitVisitId(null);
          resetAdmit(emptyErAdmitForm);
        }}
        title="Admit Patient to IPD"
        size="md"
      >
        <Stack component="form" onSubmit={handleAdmitSubmit(submitAdmitFromEr)}>
          <Controller
            name="bed_id"
            control={admitControl}
            render={({ field }) => (
              <BedSelect value={field.value} onChange={field.onChange} required />
            )}
          />
          {admitErrors.bed_id?.message && (
            <Text size="xs" c="danger">
              {admitErrors.bed_id.message}
            </Text>
          )}
          <Controller
            name="admitting_doctor_id"
            control={admitControl}
            render={({ field }) => (
              <DoctorSearchSelect
                label="Admitting Doctor"
                value={field.value}
                onChange={field.onChange}
                required
              />
            )}
          />
          {admitErrors.admitting_doctor_id?.message && (
            <Text size="xs" c="danger">
              {admitErrors.admitting_doctor_id.message}
            </Text>
          )}
          <Controller
            name="admission_notes"
            control={admitControl}
            render={({ field }) => (
              <Textarea
                label="Admission Notes"
                {...field}
                placeholder="Reason for admission, clinical notes..."
                minRows={3}
              />
            )}
          />
          <Button
            type="submit"
            color="teal"
            leftSection={<IconBuildingHospital size={16} />}
            loading={admitMutation.isPending}
          >
            Confirm Admission
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Code Activations Tab ──────────────────────────────

function CrashCartChecklist({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange: (updated: Record<string, boolean>) => void;
}) {
  const allChecked = CRASH_CART_ITEMS.every((item) => value[item.key] === true);
  const checkedCount = CRASH_CART_ITEMS.filter((item) => value[item.key] === true).length;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconFirstAidKit size={20} />
          <Title order={5}>Crash Cart Checklist</Title>
        </Group>
        <Badge color={allChecked ? "success" : "orange"} variant="light">
          {checkedCount}/{CRASH_CART_ITEMS.length}
        </Badge>
      </Group>
      <Divider mb="sm" />
      <Stack gap="xs">
        {CRASH_CART_ITEMS.map((item) => (
          <Checkbox
            key={item.key}
            label={item.label}
            checked={value[item.key] === true}
            onChange={(e) => onChange({ ...value, [item.key]: e.currentTarget.checked })}
          />
        ))}
      </Stack>
    </Card>
  );
}

function CodesTab({
  canView,
  canCreate,
  canUpdate,
  contextAction,
  contextLocation,
}: {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  contextAction: string;
  contextLocation: string;
}) {
  const contextCodeDefaults = { ...emptyCodeActivationForm, location: contextLocation };
  const shouldOpenContextCode = canCreate && contextAction === "new" && Boolean(contextLocation);
  const [opened, { open, close }] = useDisclosure(shouldOpenContextCode);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);
  const [deactivateOpened, { open: openDeactivateModal, close: closeDeactivateModal }] =
    useDisclosure(false);
  const [selectedCode, setSelectedCode] = useState<ErCodeActivation | null>(null);
  const [codeToDeactivate, setCodeToDeactivate] = useState<ErCodeActivation | null>(null);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["er-codes"],
    queryFn: () => emergencyService.listCodeActivations(),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmergencyCodeActivationFormInput>({
    resolver: zodResolver(emergencyCodeActivationFormSchema),
    defaultValues: contextCodeDefaults,
  });
  const {
    control: deactivateControl,
    handleSubmit: handleDeactivateSubmit,
    reset: resetDeactivate,
    formState: { errors: deactivateErrors },
  } = useForm<EmergencyCodeDeactivateFormInput>({
    resolver: zodResolver(emergencyCodeDeactivateFormSchema),
    defaultValues: emptyCodeDeactivateForm,
  });
  const [crashCart, setCrashCart] = useState<Record<string, boolean>>({});

  const createMut = useMutation({
    mutationFn: (d: CreateCodeActivationRequest) => emergencyService.createCodeActivation(d),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["er-codes"] });
      close();
      setCrashCart({});
      notifications.show({
        title: "Code Activated",
        message: `${variables.code_type.toUpperCase()} activated`,
        color: "danger",
      });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeactivateCodeRequest }) =>
      emergencyService.deactivateCode(id, data),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["er-codes"] });
      setSelectedCode((current) => (current?.id === row.id ? row : current));
      setCodeToDeactivate(null);
      resetDeactivate(emptyCodeDeactivateForm);
      closeDeactivateModal();
      notifications.show({ title: "Code Deactivated", message: "Code has been deactivated" });
    },
  });

  const handleCreate = (values: EmergencyCodeActivationFormInput) => {
    const hasCheckedItems = Object.values(crashCart).some((v) => v);
    const payload: CreateCodeActivationRequest = {
      code_type: values.code_type,
      location: values.location.trim(),
      notes: emergencyOptionalText(values.notes),
      crash_cart_checklist: hasCheckedItems ? crashCart : undefined,
    };
    createMut.mutate(payload);
  };

  const handleViewDetail = (code: ErCodeActivation) => {
    setSelectedCode(code);
    openDetail();
  };

  const handleOpenDeactivate = (code: ErCodeActivation) => {
    setCodeToDeactivate(code);
    resetDeactivate(emptyCodeDeactivateForm);
    openDeactivateModal();
  };

  const handleCloseDeactivate = () => {
    closeDeactivateModal();
    setCodeToDeactivate(null);
    resetDeactivate(emptyCodeDeactivateForm);
  };

  const handleDeactivateCode = (values: EmergencyCodeDeactivateFormInput) => {
    if (!codeToDeactivate) {
      return;
    }
    const payload: DeactivateCodeRequest = {
      outcome: values.outcome,
      notes: emergencyOptionalText(values.notes),
    };
    deactivateMut.mutate({ id: codeToDeactivate.id, data: payload });
  };

  const columns = [
    {
      key: "code_type",
      label: "Code",
      render: (r: ErCodeActivation) => (
        <TableValueBadge
          value="emergency"
          kind="priority"
          label={`CODE ${r.code_type.toUpperCase()}`}
          color={
            r.code_type === "code_blue"
              ? "primary"
              : r.code_type === "code_yellow"
                ? "warning"
                : "orange"
          }
          size="lg"
          variant="filled"
        />
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r: ErCodeActivation) => new Date(r.activated_at).toLocaleString(),
    },
    { key: "location", label: "Location", render: (r: ErCodeActivation) => r.location ?? "---" },
    { key: "outcome", label: "Outcome", render: (r: ErCodeActivation) => r.outcome ?? "---" },
    {
      key: "deactivated_at",
      label: "Status",
      render: (r: ErCodeActivation) =>
        r.deactivated_at ? (
          <TableValueBadge value="completed" label="Resolved" color="success" variant="filled" />
        ) : (
          <TableValueBadge value="active" label="Active" color="danger" variant="filled" />
        ),
    },
    {
      key: "crash_cart",
      label: "Crash Cart",
      render: (r: ErCodeActivation) => {
        const checklist = r.crash_cart_checklist as Record<string, boolean> | null;
        if (!checklist)
          return (
            <Text size="sm" c="dimmed">
              Not checked
            </Text>
          );
        const checked = Object.values(checklist).filter(Boolean).length;
        const total = CRASH_CART_ITEMS.length;
        return (
          <TableValueBadge
            value={checked === total ? "completed" : "pending"}
            color={checked === total ? "success" : "orange"}
            label={`${checked}/${total}`}
          />
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (r: ErCodeActivation) => (
        <Group gap="xs">
          <Tooltip label="View Details">
            <ActionIcon
              variant="light"
              color="primary"
              aria-label="View code activation details"
              onClick={() => handleViewDetail(r)}
            >
              <IconFileText size={16} />
            </ActionIcon>
          </Tooltip>
          {!r.deactivated_at && canUpdate && (
            <Tooltip label="Deactivate">
              <ActionIcon
                color="success"
                variant="light"
                aria-label="Deactivate code activation"
                onClick={() => handleOpenDeactivate(r)}
              >
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  const selectedChecklist = selectedCode?.crash_cart_checklist as Record<string, boolean> | null;

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            leftSection={<IconAlertTriangle size={16} />}
            color="danger"
            onClick={() => {
              reset(contextCodeDefaults);
              open();
            }}
          >
            Activate Code
          </Button>
        </Group>
      )}
      {canView ? (
        <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Code activation history is not available for your role. You can activate a new code when
            code creation is allowed.
          </Text>
        </Card>
      )}

      {/* Create Code Drawer */}
      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setCrashCart({});
          reset(contextCodeDefaults);
        }}
        title="Activate Emergency Code"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreate)}>
          <Controller
            name="code_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Code Type"
                required
                data={emergencyCodeTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "code_blue")}
                error={errors.code_type?.message}
              />
            )}
          />
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <TextInput label="Location" error={errors.location?.message} required {...field} />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Divider />
          <CrashCartChecklist value={crashCart} onChange={setCrashCart} />
          <Button color="danger" type="submit" loading={createMut.isPending}>
            Activate Code
          </Button>
        </Stack>
      </Drawer>

      <Modal
        opened={deactivateOpened}
        onClose={handleCloseDeactivate}
        title="Close Emergency Code"
        centered
      >
        <Stack component="form" onSubmit={handleDeactivateSubmit(handleDeactivateCode)}>
          {codeToDeactivate && (
            <Alert color="warning" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={600}>
                CODE {codeToDeactivate.code_type.toUpperCase()}
              </Text>
              <Text size="sm" c="dimmed">
                {codeToDeactivate.location ?? "Location not recorded"} - activated{" "}
                {new Date(codeToDeactivate.activated_at).toLocaleString()}
              </Text>
            </Alert>
          )}
          <Controller
            name="outcome"
            control={deactivateControl}
            render={({ field }) => (
              <Select
                label="Closure outcome"
                required
                data={emergencyCodeDeactivateOutcomeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "resolved")}
                error={deactivateErrors.outcome?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={deactivateControl}
            render={({ field }) => (
              <Textarea
                label="Closure notes"
                placeholder="Team handoff, patient disposition, all-clear confirmation"
                minRows={3}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleCloseDeactivate}>
              Cancel
            </Button>
            <Button color="success" type="submit" loading={deactivateMut.isPending}>
              Close Code
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Code Detail Drawer */}
      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Code Activation Details"
        position="right"
        size="lg"
      >
        {selectedCode && (
          <Stack>
            <Group>
              <Badge
                color={selectedCode.code_type === "code_blue" ? "primary" : "orange"}
                size="xl"
              >
                CODE {selectedCode.code_type.toUpperCase()}
              </Badge>
              {selectedCode.deactivated_at ? (
                <Badge color="success" size="lg">
                  Resolved
                </Badge>
              ) : (
                <Badge color="danger" size="lg">
                  Active
                </Badge>
              )}
            </Group>
            <Text size="sm">
              <Text span fw={600}>
                Activated:
              </Text>{" "}
              {new Date(selectedCode.activated_at).toLocaleString()}
            </Text>
            {selectedCode.deactivated_at && (
              <Text size="sm">
                <Text span fw={600}>
                  Deactivated:
                </Text>{" "}
                {new Date(selectedCode.deactivated_at).toLocaleString()}
              </Text>
            )}
            {selectedCode.location && (
              <Text size="sm">
                <Text span fw={600}>
                  Location:
                </Text>{" "}
                {selectedCode.location}
              </Text>
            )}
            {selectedCode.outcome && (
              <Text size="sm">
                <Text span fw={600}>
                  Outcome:
                </Text>{" "}
                {selectedCode.outcome}
              </Text>
            )}
            {selectedCode.notes && (
              <Text size="sm">
                <Text span fw={600}>
                  Notes:
                </Text>{" "}
                {selectedCode.notes}
              </Text>
            )}

            <Divider />
            <Title order={5}>Crash Cart Checklist</Title>
            {selectedChecklist ? (
              <Card withBorder p="md">
                <Stack gap="xs">
                  {CRASH_CART_ITEMS.map((item) => (
                    <Group key={item.key} gap="xs">
                      {selectedChecklist[item.key] ? (
                        <ThemeIcon color="success" size="sm" radius="xl">
                          <IconCheck size={12} />
                        </ThemeIcon>
                      ) : (
                        <ThemeIcon color="danger" size="sm" radius="xl" variant="light">
                          <IconAlertTriangle size={12} />
                        </ThemeIcon>
                      )}
                      <Text size="sm" c={selectedChecklist[item.key] ? undefined : "danger"}>
                        {item.label}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ) : (
              <Text size="sm" c="dimmed">
                No crash cart checklist was recorded for this activation.
              </Text>
            )}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}

// ── MLC Cases Tab ──────────────────────────────────────

const EMPTY_SBAR: MlcSbarFormInput = {
  situation: "",
  background: "",
  assessment: "",
  recommendation: "",
};
const EMPTY_AGE_EST: MlcAgeEstimationFormInput = {
  ossification_center_findings: "",
  dental_examination: "",
  secondary_sexual_characteristics: "",
  estimated_age_range: "",
  examiner_opinion: "",
};
const EMPTY_POCSO: MlcPocsoReportFormInput = {
  child_age: "",
  guardian_details: "",
  statement_summary: "",
  injuries_documented: "",
  psych_assessment_needed: false,
};
const EMPTY_SUMMONS: MlcCourtSummonsFormInput = {
  date: "",
  court_name: "",
  case_number: "",
  status: "pending",
  notes: "",
};
const EMPTY_POLICE_INTIMATION: MlcPoliceIntimationFormInput = {
  police_station: "",
  officer_name: "",
  officer_designation: "",
  officer_contact: "",
  sent_via: "phone",
  notes: "",
};
const EMPTY_POLICE_RECEIPT_CONFIRMATION: MlcPoliceReceiptConfirmationFormInput = {
  receipt_number: "",
  notes: "",
};
const EMPTY_MLC_PRINT_REPRINT: MlcPrintReprintFormInput = {
  packet_type: "documentation",
  reprint_reason: "",
};

const MLC_PRINT_PACKET_OPTIONS: Array<{ value: MlcPrintPacketTypeFormValue; label: string }> = [
  { value: "documentation", label: "Documentation packet" },
  { value: "register", label: "Register extract" },
];

type MlcPrintPreview =
  | { packetType: "documentation"; data: MlcDocumentationPrintData }
  | { packetType: "register"; data: MlcRegisterPrintData }
  | { packetType: "police-intimation"; data: MlcPoliceIntimationPrintData };

function printDisplayValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "---";
  }
  const text = String(value).trim();
  return text.length > 0 ? text : "---";
}

function isMlcPrintPacketType(value: string | null): value is MlcPrintPacketTypeFormValue {
  return value === "documentation" || value === "register";
}

function PrintDataField({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <Box>
      <Text className="print-label" size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text className="print-value" size="sm" fw={600}>
        {printDisplayValue(value)}
      </Text>
    </Box>
  );
}

function MlcRegisterPrintPreview({ data }: { data: MlcRegisterPrintData }) {
  return (
    <Stack gap="md">
      <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
        <PrintDataField label="MLC number" value={data.mlc_number} />
        <PrintDataField
          label="Registered"
          value={`${data.registration_date} ${data.registration_time}`}
        />
        <PrintDataField label="Patient" value={data.patient_name} />
        <PrintDataField label="UHID" value={data.uhid} />
        <PrintDataField label="Age" value={data.age} />
        <PrintDataField label="Gender" value={data.gender} />
        <PrintDataField label="Brought by" value={data.brought_by} />
        <PrintDataField label="Police station" value={data.police_station} />
        <PrintDataField label="Police officer" value={data.police_officer_name} />
        <PrintDataField label="Police rank" value={data.police_officer_rank} />
        <PrintDataField label="DD number" value={data.police_dd_number} />
        <PrintDataField label="Nature of case" value={data.nature_of_case} />
        <PrintDataField label="Incident date/time" value={data.date_time_of_incident} />
        <PrintDataField label="Incident place" value={data.place_of_incident} />
        <PrintDataField label="Weapon used" value={data.weapon_used} />
        <PrintDataField label="Examined by" value={data.examining_doctor} />
        <PrintDataField label="Examined at" value={data.examined_at} />
      </SimpleGrid>

      <Box className="print-section">
        <Title order={6}>Alleged History</Title>
        <Text size="sm">{printDisplayValue(data.alleged_history)}</Text>
      </Box>

      <Box className="print-section">
        <Title order={6}>Condition and Treatment</Title>
        <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
          <PrintDataField label="Condition on arrival" value={data.condition_on_arrival} />
          <PrintDataField label="Treatment given" value={data.treatment_given} />
          <PrintDataField label="Samples handed to" value={data.samples_handed_to} />
          <PrintDataField label="Opinion" value={data.opinion} />
          <PrintDataField
            label="Condition at discharge"
            value={data.patient_condition_at_discharge}
          />
        </SimpleGrid>
      </Box>

      <Box className="print-section">
        <Title order={6}>Injuries Noted</Title>
        {data.injuries_noted.length > 0 ? (
          <Stack gap="xs">
            {data.injuries_noted.map((injury) => (
              <Paper key={injury.injury_number} withBorder p="xs">
                <Text size="sm" fw={600}>
                  {injury.injury_number}. {injury.injury_type} - {injury.location}
                </Text>
                <Text size="sm">{injury.description}</Text>
                <Text size="xs" c="dimmed">
                  Size: {printDisplayValue(injury.size_cm)} · Age:{" "}
                  {printDisplayValue(injury.probable_age)} · Weapon:{" "}
                  {printDisplayValue(injury.probable_weapon)}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No injuries recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Samples Collected</Title>
        {data.samples_collected.length > 0 ? (
          <Stack gap={2}>
            {data.samples_collected.map((sample) => (
              <Text key={sample} size="sm">
                {sample}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No samples recorded.
          </Text>
        )}
      </Box>
    </Stack>
  );
}

function MlcDocumentationPrintPreview({ data }: { data: MlcDocumentationPrintData }) {
  return (
    <Stack gap="md">
      <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
        <PrintDataField label="MLC number" value={data.mlc_number} />
        <PrintDataField label="Patient" value={data.patient_name} />
        <PrintDataField label="UHID" value={data.uhid} />
        <PrintDataField label="Age" value={data.age} />
        <PrintDataField label="Gender" value={data.gender} />
        <PrintDataField label="Admission date" value={data.admission_date} />
        <PrintDataField label="Discharge date" value={data.discharge_date} />
        <PrintDataField label="Police station" value={data.police_station} />
        <PrintDataField label="FIR number" value={data.fir_number} />
        <PrintDataField label="Court case" value={data.court_case_number} />
        <PrintDataField label="Prepared by" value={data.prepared_by} />
        <PrintDataField label="Verified by" value={data.verified_by} />
        <PrintDataField label="Prepared at" value={data.prepared_at} />
      </SimpleGrid>

      <Box className="print-section">
        <Title order={6}>Clinical Summary</Title>
        <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
          <PrintDataField label="Final diagnosis" value={data.final_diagnosis} />
          <PrintDataField label="Treatment summary" value={data.treatment_summary} />
          <PrintDataField label="Investigation summary" value={data.investigation_summary} />
          <PrintDataField
            label="Findings at discharge"
            value={data.clinical_findings_at_discharge}
          />
          <PrintDataField label="Complications" value={data.complications} />
          <PrintDataField label="Prognosis" value={data.prognosis} />
          <PrintDataField label="Permanent disability" value={data.permanent_disability} />
          <PrintDataField label="Disability percentage" value={data.disability_percentage} />
        </SimpleGrid>
      </Box>

      <Box className="print-section">
        <Title order={6}>Operative Procedures</Title>
        {data.operative_procedures.length > 0 ? (
          <Stack gap={2}>
            {data.operative_procedures.map((procedure) => (
              <Text key={procedure} size="sm">
                {procedure}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No procedures recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Police Visits</Title>
        {data.police_visits.length > 0 ? (
          <Stack gap="xs">
            {data.police_visits.map((visit) => (
              <Paper key={`${visit.visit_date}-${visit.officer_name}`} withBorder p="xs">
                <Text size="sm" fw={600}>
                  {visit.visit_date} · {visit.officer_name}
                </Text>
                <Text size="sm">{visit.purpose}</Text>
                <Text size="xs" c="dimmed">
                  Rank: {visit.officer_rank} · Statement recorded:{" "}
                  {visit.statement_recorded ? "Yes" : "No"}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No police visits recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Samples Preserved</Title>
        {data.samples_preserved.length > 0 ? (
          <Stack gap="xs">
            {data.samples_preserved.map((sample) => (
              <Paper key={`${sample.sample_type}-${sample.collected_date}`} withBorder p="xs">
                <Text size="sm" fw={600}>
                  {sample.sample_type}
                </Text>
                <Text size="xs" c="dimmed">
                  Quantity: {sample.quantity} · Preserved in: {sample.preservation_method} ·
                  Collected: {sample.collected_date}
                </Text>
                <Text size="xs" c="dimmed">
                  Handed to: {printDisplayValue(sample.handed_to)} · Handed date:{" "}
                  {printDisplayValue(sample.handed_date)}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No preserved samples recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Important Dates</Title>
        {data.important_dates.length > 0 ? (
          <Stack gap={2}>
            {data.important_dates.map((entry) => (
              <Text key={`${entry.event_date}-${entry.event_description}`} size="sm">
                <Text span fw={600}>
                  {entry.event_date}:
                </Text>{" "}
                {entry.event_description}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No timeline entries recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Certificates Issued</Title>
        {data.certificates_issued.length > 0 ? (
          <Stack gap={2}>
            {data.certificates_issued.map((certificate) => (
              <Text key={certificate} size="sm">
                {certificate}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No certificates recorded.
          </Text>
        )}
      </Box>
    </Stack>
  );
}

function MlcPoliceIntimationPrintPreview({ data }: { data: MlcPoliceIntimationPrintData }) {
  return (
    <Stack gap="md">
      <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
        <PrintDataField label="Intimation number" value={data.intimation_number} />
        <PrintDataField label="MLC number" value={data.mlc_number} />
        <PrintDataField label="Patient" value={data.patient_name} />
        <PrintDataField label="UHID" value={data.uhid} />
        <PrintDataField label="Age" value={data.age} />
        <PrintDataField label="Gender" value={data.gender} />
        <PrintDataField label="Police station" value={data.police_station} />
        <PrintDataField label="Sent at" value={data.sent_at} />
        <PrintDataField label="Sent via" value={data.sent_via} />
        <PrintDataField label="Sent by" value={data.sent_by} />
      </SimpleGrid>

      <Box className="print-section">
        <Title order={6}>Police Contact</Title>
        <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
          <PrintDataField label="Officer" value={data.officer_name} />
          <PrintDataField label="Designation" value={data.officer_designation} />
          <PrintDataField label="Contact" value={data.officer_contact} />
          <PrintDataField
            label="Receipt"
            value={data.receipt_confirmed ? "Confirmed" : "Pending"}
          />
          <PrintDataField label="Receipt number" value={data.receipt_number} />
          <PrintDataField label="Receipt confirmed at" value={data.receipt_confirmed_at} />
        </SimpleGrid>
      </Box>

      <Box className="print-section">
        <Title order={6}>Notes</Title>
        <Text size="sm">{printDisplayValue(data.notes)}</Text>
      </Box>

      <Text size="xs" c="dimmed">
        Generated at {data.generated_at}
      </Text>
    </Stack>
  );
}

function MlcCaseDetail({
  mlcCase,
  canViewPatientRecord,
}: {
  mlcCase: MlcCase;
  canViewPatientRecord: boolean;
}) {
  const qc = useQueryClient();
  const canCreateSbar = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.SBAR_CREATE);
  const canCreateAgeEstimation = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.AGE_ESTIMATION_CREATE);
  const canCreatePocsoDocument = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.POCSO_CREATE);
  const canCreateCourtSummons = useHasPermission(P.EMERGENCY.MLC_DOCUMENTS.COURT_SUMMONS_CREATE);
  const canListMlcDocuments = useHasPermission(P.EMERGENCY.MLC_LIST);
  const canPrintMlc = useHasPermission(P.EMERGENCY.MLC_PRINT);
  const canReprintMlc = useHasPermission(P.EMERGENCY.MLC_REPRINT);
  const canListPoliceIntimations = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.LIST);
  const canRecordPoliceIntimationPermission = useHasPermission(
    P.EMERGENCY.MLC_POLICE_INTIMATIONS.CREATE,
  );
  const canConfirmPoliceReceipt = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.CONFIRM);
  const canPrintPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.PRINT);
  const canReprintPoliceIntimation = useHasPermission(P.EMERGENCY.MLC_POLICE_INTIMATIONS.REPRINT);
  const canPrintMlcPacket = canPrintMlc && canViewPatientRecord;
  const canReprintMlcPacket = canReprintMlc && canViewPatientRecord;
  const canPrintPoliceIntimationPacket = canPrintPoliceIntimation && canViewPatientRecord;
  const canReprintPoliceIntimationPacket = canReprintPoliceIntimation && canViewPatientRecord;
  const firNumberAccess = useFieldAccess("emergency.mlc.fir_number");
  const policeStationAccess = useFieldAccess("emergency.mlc.police_station");
  const informantNameAccess = useFieldAccess("emergency.mlc.informant_name");
  const informantRelationAccess = useFieldAccess("emergency.mlc.informant_relation");
  const informantContactAccess = useFieldAccess("emergency.mlc.informant_contact");
  const historyAccess = useFieldAccess("emergency.mlc.history_of_incident");
  const examinationAccess = useFieldAccess("emergency.mlc.examination_findings");
  const medicalOpinionAccess = useFieldAccess("emergency.mlc.medical_opinion");
  const causeOfDeathAccess = useFieldAccess("emergency.mlc.cause_of_death");
  const pocsoReportAccess = useFieldAccess("emergency.mlc.pocso_report");
  const canViewPocsoReport = canViewSensitiveField(pocsoReportAccess);
  const canRecordPoliceIntimation =
    canRecordPoliceIntimationPermission && canEditSensitiveField(policeStationAccess);
  const canReviewPoliceIntimations =
    canListPoliceIntimations ||
    canRecordPoliceIntimation ||
    canConfirmPoliceReceipt ||
    canPrintPoliceIntimation ||
    canReprintPoliceIntimation;
  const canUsePoliceIntimations =
    canReviewPoliceIntimations ||
    canRecordPoliceIntimation ||
    canConfirmPoliceReceipt ||
    canPrintPoliceIntimation ||
    canReprintPoliceIntimation;
  const canCreatePocsoReport =
    canCreatePocsoDocument && mlcCase.is_pocso && canEditSensitiveField(pocsoReportAccess);
  const hasMlcDocumentActions =
    canCreateSbar ||
    canCreateAgeEstimation ||
    canCreatePocsoReport ||
    canCreateCourtSummons ||
    canRecordPoliceIntimation ||
    canConfirmPoliceReceipt ||
    canPrintPoliceIntimationPacket ||
    canReprintPoliceIntimationPacket ||
    canPrintMlcPacket ||
    canReprintMlcPacket;
  const canReviewMlcDocuments =
    canListMlcDocuments ||
    canCreateSbar ||
    canCreateAgeEstimation ||
    canCreatePocsoReport ||
    canCreateCourtSummons ||
    canPrintMlcPacket ||
    canReprintMlcPacket;

  // Sub-drawer state
  const [sbarOpened, { open: openSbar, close: closeSbar }] = useDisclosure(false);
  const [ageEstOpened, { open: openAgeEst, close: closeAgeEst }] = useDisclosure(false);
  const [pocsoOpened, { open: openPocso, close: closePocso }] = useDisclosure(false);
  const [summonsOpened, { open: openSummons, close: closeSummons }] = useDisclosure(false);
  const [policeIntimationOpened, { open: openPoliceIntimation, close: closePoliceIntimation }] =
    useDisclosure(false);
  const [policeReceiptOpened, { open: openPoliceReceipt, close: closePoliceReceipt }] =
    useDisclosure(false);
  const [mlcReprintOpened, { open: openMlcReprint, close: closeMlcReprint }] = useDisclosure(false);
  const [
    policeIntimationReprintOpened,
    { open: openPoliceIntimationReprint, close: closePoliceIntimationReprint },
  ] = useDisclosure(false);
  const [
    mlcPrintPreviewOpened,
    { open: openMlcPrintPreview, close: closeMlcPrintPreviewDisclosure },
  ] = useDisclosure(false);
  const [receiptTarget, setReceiptTarget] = useState<MlcPoliceIntimation | null>(null);
  const [policePrintTarget, setPolicePrintTarget] = useState<MlcPoliceIntimation | null>(null);
  const [mlcPrintPreview, setMlcPrintPreview] = useState<MlcPrintPreview | null>(null);
  const [lastMlcPrintAction, setLastMlcPrintAction] = useState<"print" | "reprint">("print");
  const mlcPrintRef = useRef<HTMLDivElement>(null);

  const {
    formState: { errors: sbarErrors },
    handleSubmit: handleSbarSubmit,
    register: registerSbar,
    reset: resetSbar,
  } = useForm<MlcSbarFormInput>({
    resolver: zodResolver(mlcSbarFormSchema),
    defaultValues: EMPTY_SBAR,
  });
  const {
    formState: { errors: ageEstErrors },
    handleSubmit: handleAgeEstSubmit,
    register: registerAgeEst,
    reset: resetAgeEst,
  } = useForm<MlcAgeEstimationFormInput>({
    resolver: zodResolver(mlcAgeEstimationFormSchema),
    defaultValues: EMPTY_AGE_EST,
  });
  const {
    control: pocsoControl,
    formState: { errors: pocsoErrors },
    handleSubmit: handlePocsoSubmit,
    register: registerPocso,
    reset: resetPocso,
  } = useForm<MlcPocsoReportFormInput>({
    resolver: zodResolver(mlcPocsoReportFormSchema),
    defaultValues: EMPTY_POCSO,
  });
  const {
    control: summonsControl,
    formState: { errors: summonsErrors },
    handleSubmit: handleSummonsSubmit,
    register: registerSummons,
    reset: resetSummons,
  } = useForm<MlcCourtSummonsFormInput>({
    resolver: zodResolver(mlcCourtSummonsFormSchema),
    defaultValues: EMPTY_SUMMONS,
  });
  const {
    control: policeIntimationControl,
    formState: { errors: policeIntimationErrors },
    handleSubmit: handlePoliceIntimationSubmit,
    register: registerPoliceIntimation,
    reset: resetPoliceIntimation,
  } = useForm<MlcPoliceIntimationFormInput>({
    resolver: zodResolver(mlcPoliceIntimationFormSchema),
    defaultValues: {
      ...EMPTY_POLICE_INTIMATION,
      police_station: mlcCase.police_station ?? "",
    },
  });
  const {
    formState: { errors: policeReceiptErrors },
    handleSubmit: handlePoliceReceiptSubmit,
    register: registerPoliceReceipt,
    reset: resetPoliceReceipt,
  } = useForm<MlcPoliceReceiptConfirmationFormInput>({
    resolver: zodResolver(mlcPoliceReceiptConfirmationFormSchema),
    defaultValues: EMPTY_POLICE_RECEIPT_CONFIRMATION,
  });
  const mlcReprintForm = useForm<MlcPrintReprintFormInput>({
    resolver: zodResolver(mlcPrintReprintFormSchema),
    defaultValues: EMPTY_MLC_PRINT_REPRINT,
  });
  const policeIntimationReprintForm = useForm<MlcPrintReprintFormInput>({
    resolver: zodResolver(mlcPrintReprintFormSchema),
    defaultValues: EMPTY_MLC_PRINT_REPRINT,
  });

  // Fetch documents for this MLC case
  const { data: documents = [] } = useQuery({
    queryKey: ["mlc-documents", mlcCase.id],
    queryFn: () => emergencyService.listMlcDocuments(mlcCase.id),
    enabled: canReviewMlcDocuments,
  });
  const { data: policeIntimations = [], isLoading: policeIntimationsLoading } = useQuery({
    queryKey: ["mlc-police-intimations", mlcCase.id],
    queryFn: () => emergencyService.listPoliceIntimations(mlcCase.id),
    enabled: canReviewPoliceIntimations,
  });

  const createDocMut = useMutation({
    mutationFn: (data: CreateMlcDocumentInput) =>
      emergencyService.createMlcDocument(mlcCase.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-documents", mlcCase.id] });
      notifications.show({ title: "Document Created", message: "MLC document saved successfully" });
    },
  });
  const createPoliceIntimationMut = useMutation({
    mutationFn: (data: CreatePoliceIntimationInput) =>
      emergencyService.createPoliceIntimation(mlcCase.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-police-intimations", mlcCase.id] });
      closePoliceIntimation();
      resetPoliceIntimation({
        ...EMPTY_POLICE_INTIMATION,
        police_station: mlcCase.police_station ?? "",
      });
      notifications.show({
        title: "Police Intimation Saved",
        message: "MLC police intimation has been recorded",
      });
    },
  });
  const confirmPoliceReceiptMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConfirmPoliceReceiptInput }) =>
      emergencyService.confirmPoliceReceipt(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-police-intimations", mlcCase.id] });
      closePoliceReceipt();
      setReceiptTarget(null);
      resetPoliceReceipt(EMPTY_POLICE_RECEIPT_CONFIRMATION);
      notifications.show({
        title: "Receipt Confirmed",
        message: "Police receipt confirmation has been recorded",
      });
    },
  });
  const mlcPrintMut = useMutation({
    mutationFn: async (variables: {
      packetType: MlcPrintPacketTypeFormValue;
      reprintReason?: string;
    }): Promise<MlcPrintPreview> => {
      const params = variables.reprintReason
        ? { reprint_reason: variables.reprintReason }
        : undefined;
      if (variables.packetType === "register") {
        return {
          packetType: "register",
          data: await emergencyService.getMlcRegisterPrintData(mlcCase.id, params),
        };
      }
      return {
        packetType: "documentation",
        data: await emergencyService.getMlcDocumentationPrintData(mlcCase.id, params),
      };
    },
    onSuccess: (preview, variables) => {
      setMlcPrintPreview(preview);
      setLastMlcPrintAction(variables.reprintReason ? "reprint" : "print");
      closeMlcReprint();
      mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
      openMlcPrintPreview();
      notifications.show({
        title: variables.reprintReason ? "MLC reprint prepared" : "MLC print prepared",
        message:
          preview.packetType === "register"
            ? "MLC register extract is ready to print"
            : "MLC documentation packet is ready to print",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "MLC print failed",
        message: error instanceof Error ? error.message : "Unable to prepare MLC print packet",
        color: "red",
      });
    },
  });
  const policeIntimationPrintMut = useMutation({
    mutationFn: async (variables: {
      intimationId: string;
      reprintReason?: string;
    }): Promise<MlcPrintPreview> => {
      const params = variables.reprintReason
        ? { reprint_reason: variables.reprintReason }
        : undefined;
      return {
        packetType: "police-intimation",
        data: await emergencyService.getMlcPoliceIntimationPrintData(
          variables.intimationId,
          params,
        ),
      };
    },
    onSuccess: (preview, variables) => {
      setMlcPrintPreview(preview);
      setLastMlcPrintAction(variables.reprintReason ? "reprint" : "print");
      closePoliceIntimationReprint();
      setPolicePrintTarget(null);
      policeIntimationReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
      openMlcPrintPreview();
      notifications.show({
        title: variables.reprintReason
          ? "Police intimation reprint prepared"
          : "Police intimation print prepared",
        message: "MLC police intimation is ready to print",
      });
    },
    onError: (error) => {
      notifications.show({
        title: "Police intimation print failed",
        message:
          error instanceof Error ? error.message : "Unable to prepare police intimation print",
        color: "red",
      });
    },
  });

  const submitSbar = handleSbarSubmit((values) => {
    if (!canCreateSbar) return;
    createDocMut.mutate({
      document_type: "sbar_handover",
      title: `SBAR Handover - ${mlcCase.mlc_number}`,
      content: values,
    });
    closeSbar();
    resetSbar(EMPTY_SBAR);
  });

  const submitAgeEst = handleAgeEstSubmit((values) => {
    if (!canCreateAgeEstimation) return;
    createDocMut.mutate({
      document_type: "age_estimation",
      title: `Age Estimation - ${mlcCase.mlc_number}`,
      content: values,
    });
    closeAgeEst();
    resetAgeEst(EMPTY_AGE_EST);
  });

  const submitPocso = handlePocsoSubmit((values) => {
    if (!canCreatePocsoReport) return;
    createDocMut.mutate({
      document_type: "pocso_report",
      title: `POCSO Report - ${mlcCase.mlc_number}`,
      content: values,
    });
    closePocso();
    resetPocso(EMPTY_POCSO);
  });

  const submitSummons = handleSummonsSubmit((values) => {
    if (!canCreateCourtSummons) return;
    createDocMut.mutate({
      document_type: "court_summons",
      title: `Court Summons - ${values.court_name}`,
      content: values,
    });
    closeSummons();
    resetSummons(EMPTY_SUMMONS);
  });
  const submitPoliceIntimation = handlePoliceIntimationSubmit((values) => {
    if (!canRecordPoliceIntimation) return;
    createPoliceIntimationMut.mutate({
      police_station: values.police_station.trim(),
      officer_name: emergencyOptionalText(values.officer_name),
      officer_designation: emergencyOptionalText(values.officer_designation),
      officer_contact: emergencyOptionalText(values.officer_contact),
      sent_via: values.sent_via,
      notes: emergencyOptionalText(values.notes),
    });
  });
  const openReceiptConfirmation = (row: MlcPoliceIntimation) => {
    setReceiptTarget(row);
    resetPoliceReceipt(EMPTY_POLICE_RECEIPT_CONFIRMATION);
    openPoliceReceipt();
  };
  const closeReceiptConfirmation = () => {
    closePoliceReceipt();
    setReceiptTarget(null);
    resetPoliceReceipt(EMPTY_POLICE_RECEIPT_CONFIRMATION);
  };
  const submitPoliceReceipt = handlePoliceReceiptSubmit((values) => {
    if (!canConfirmPoliceReceipt || !receiptTarget) return;
    confirmPoliceReceiptMut.mutate({
      id: receiptTarget.id,
      data: {
        receipt_number: values.receipt_number.trim(),
        notes: emergencyOptionalText(values.notes),
      },
    });
  });
  const prepareMlcPrint = (packetType: MlcPrintPacketTypeFormValue) => {
    if (!canPrintMlcPacket) return;
    mlcPrintMut.mutate({ packetType });
  };
  const prepareMlcReprint = mlcReprintForm.handleSubmit((values) => {
    if (!canReprintMlcPacket) return;
    mlcPrintMut.mutate({
      packetType: values.packet_type,
      reprintReason: values.reprint_reason.trim(),
    });
  });
  const preparePoliceIntimationPrint = (row: MlcPoliceIntimation) => {
    if (!canPrintPoliceIntimationPacket) return;
    policeIntimationPrintMut.mutate({ intimationId: row.id });
  };
  const openPoliceIntimationReprintModal = (row: MlcPoliceIntimation) => {
    setPolicePrintTarget(row);
    policeIntimationReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
    openPoliceIntimationReprint();
  };
  const closePoliceIntimationReprintModal = () => {
    closePoliceIntimationReprint();
    setPolicePrintTarget(null);
    policeIntimationReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
  };
  const preparePoliceIntimationReprint = policeIntimationReprintForm.handleSubmit((values) => {
    if (!canReprintPoliceIntimationPacket || !policePrintTarget) return;
    policeIntimationPrintMut.mutate({
      intimationId: policePrintTarget.id,
      reprintReason: values.reprint_reason.trim(),
    });
  });
  const closeMlcPrintPreviewModal = () => {
    closeMlcPrintPreviewDisclosure();
    setMlcPrintPreview(null);
  };

  // Filter documents by type
  const sbarDocs = documents.filter((d) => d.document_type === "sbar_handover");
  const ageEstDocs = documents.filter((d) => d.document_type === "age_estimation");
  const pocsoDocs = documents.filter((d) => d.document_type === "pocso_report");
  const courtSummonsDocs = documents.filter((d) => d.document_type === "court_summons");
  const mlcPrintPreviewTitle =
    mlcPrintPreview?.packetType === "police-intimation"
      ? "MLC Police Intimation"
      : mlcPrintPreview?.packetType === "register"
        ? "MLC Register Extract"
        : "MLC Documentation Packet";

  return (
    <>
      <Stack>
        {/* POCSO Banner */}
        {mlcCase.is_pocso && (
          <Alert
            color="danger"
            variant="filled"
            icon={<IconAlertOctagon size={20} />}
            title="POCSO Case"
          >
            This is a POCSO (Protection of Children from Sexual Offences) case. All documentation
            must comply with POCSO Act, 2012. Ensure child-friendly procedures and mandatory
            reporting to police/SJPU within 24 hours.
          </Alert>
        )}

        {/* Case Info */}
        <Card withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Title order={5}>{mlcCase.mlc_number}</Title>
            <Group gap="xs">
              {mlcCase.is_pocso && (
                <Badge color="danger" size="lg">
                  POCSO
                </Badge>
              )}
              {mlcCase.is_death_case && (
                <Badge color="dark" size="lg">
                  Death Case
                </Badge>
              )}
              <Badge color={mlcCase.status === "closed" ? "success" : "orange"} size="lg">
                {mlcCase.status}
              </Badge>
            </Group>
          </Group>
          <Text size="sm">
            <Text span fw={600}>
              Type:
            </Text>{" "}
            {mlcCase.case_type ?? "---"}
          </Text>
          <Text size="sm">
            <Text span fw={600}>
              Registered:
            </Text>{" "}
            {new Date(mlcCase.registered_at).toLocaleString()}
          </Text>
          {(mlcCase.fir_number || !canViewSensitiveField(firNumberAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                FIR #:
              </Text>{" "}
              {renderSensitiveValue(firNumberAccess, mlcCase.fir_number)}
            </Text>
          )}
          {(mlcCase.police_station || !canViewSensitiveField(policeStationAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Police Station:
              </Text>{" "}
              {renderSensitiveValue(policeStationAccess, mlcCase.police_station)}
            </Text>
          )}
          {(mlcCase.history_of_incident || !canViewSensitiveField(historyAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                History:
              </Text>{" "}
              {renderSensitiveValue(historyAccess, mlcCase.history_of_incident)}
            </Text>
          )}
          {(mlcCase.informant_name || !canViewSensitiveField(informantNameAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Informant:
              </Text>{" "}
              {renderSensitiveValue(informantNameAccess, mlcCase.informant_name)}
            </Text>
          )}
          {(mlcCase.informant_relation || !canViewSensitiveField(informantRelationAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Informant relation:
              </Text>{" "}
              {renderSensitiveValue(informantRelationAccess, mlcCase.informant_relation)}
            </Text>
          )}
          {(mlcCase.informant_contact || !canViewSensitiveField(informantContactAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Informant contact:
              </Text>{" "}
              {renderSensitiveValue(informantContactAccess, mlcCase.informant_contact)}
            </Text>
          )}
          {(mlcCase.examination_findings || !canViewSensitiveField(examinationAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Examination:
              </Text>{" "}
              {renderSensitiveValue(examinationAccess, mlcCase.examination_findings)}
            </Text>
          )}
          {(mlcCase.medical_opinion || !canViewSensitiveField(medicalOpinionAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Medical opinion:
              </Text>{" "}
              {renderSensitiveValue(medicalOpinionAccess, mlcCase.medical_opinion)}
            </Text>
          )}
          {(mlcCase.cause_of_death || !canViewSensitiveField(causeOfDeathAccess)) && (
            <Text size="sm">
              <Text span fw={600}>
                Cause of death:
              </Text>{" "}
              {renderSensitiveValue(causeOfDeathAccess, mlcCase.cause_of_death)}
            </Text>
          )}
        </Card>

        {/* Action Buttons */}
        {hasMlcDocumentActions && (
          <Group>
            {canCreateSbar && (
              <Button
                leftSection={<IconShieldCheck size={16} />}
                variant="light"
                onClick={openSbar}
              >
                SBAR Handover
              </Button>
            )}
            {canCreateAgeEstimation && (
              <Button
                leftSection={<IconScale size={16} />}
                variant="light"
                color="violet"
                onClick={openAgeEst}
              >
                Age Estimation
              </Button>
            )}
            {canCreatePocsoReport && (
              <Button
                leftSection={<IconAlertOctagon size={16} />}
                variant="light"
                color="danger"
                onClick={openPocso}
              >
                POCSO Report
              </Button>
            )}
            {canCreateCourtSummons && (
              <Button
                leftSection={<IconGavel size={16} />}
                variant="light"
                color="warning"
                onClick={openSummons}
              >
                Add Court Summons
              </Button>
            )}
            {canRecordPoliceIntimation && (
              <Button
                leftSection={<IconBell size={16} />}
                variant="light"
                color="primary"
                onClick={() => {
                  resetPoliceIntimation({
                    ...EMPTY_POLICE_INTIMATION,
                    police_station: mlcCase.police_station ?? "",
                  });
                  openPoliceIntimation();
                }}
              >
                Police Intimation
              </Button>
            )}
            {canPrintMlcPacket && (
              <Menu position="bottom-end" withinPortal shadow="md">
                <Menu.Target>
                  <Button
                    leftSection={<IconPrinter size={16} />}
                    variant="light"
                    color="teal"
                    loading={mlcPrintMut.isPending}
                  >
                    Print MLC
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {MLC_PRINT_PACKET_OPTIONS.map((option) => (
                    <Menu.Item
                      key={option.value}
                      leftSection={<IconFileText size={14} />}
                      onClick={() => prepareMlcPrint(option.value)}
                    >
                      {option.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
            {canReprintMlcPacket && (
              <Button
                leftSection={<IconPrinter size={16} />}
                variant="default"
                disabled={mlcPrintMut.isPending}
                onClick={() => {
                  mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
                  openMlcReprint();
                }}
              >
                Reprint MLC
              </Button>
            )}
          </Group>
        )}

        <Divider />

        {canUsePoliceIntimations && (
          <Box>
            <Group justify="space-between" mb="xs">
              <Title order={6}>Police Intimations</Title>
              {canReviewPoliceIntimations && (
                <Badge variant="light">{policeIntimations.length} record(s)</Badge>
              )}
            </Group>
            {canReviewPoliceIntimations ? (
              <Paper withBorder>
                <DataTable
                  columns={[
                    {
                      key: "intimation_number",
                      label: "Intimation #",
                      render: (row: MlcPoliceIntimation) => (
                        <Text fw={600}>{row.intimation_number}</Text>
                      ),
                    },
                    {
                      key: "sent_at",
                      label: "Sent",
                      render: (row: MlcPoliceIntimation) => new Date(row.sent_at).toLocaleString(),
                    },
                    {
                      key: "police_station",
                      label: "Police Station",
                      render: (row: MlcPoliceIntimation) =>
                        renderSensitiveValue(policeStationAccess, row.police_station),
                    },
                    {
                      key: "officer",
                      label: "Officer",
                      render: (row: MlcPoliceIntimation) => (
                        <Stack gap={0}>
                          <Text size="sm">{row.officer_name ?? "---"}</Text>
                          {(row.officer_designation || row.officer_contact) && (
                            <Text size="xs" c="dimmed">
                              {[row.officer_designation, row.officer_contact]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          )}
                        </Stack>
                      ),
                    },
                    {
                      key: "sent_via",
                      label: "Mode",
                      render: (row: MlcPoliceIntimation) =>
                        row.sent_via ? (
                          <TableValueBadge value={row.sent_via} kind="category" />
                        ) : (
                          "---"
                        ),
                    },
                    {
                      key: "receipt",
                      label: "Receipt",
                      render: (row: MlcPoliceIntimation) => (
                        <Stack gap={0}>
                          <Badge color={row.receipt_confirmed ? "success" : "orange"} size="sm">
                            {row.receipt_confirmed ? "Confirmed" : "Pending"}
                          </Badge>
                          {row.receipt_number && (
                            <Text size="xs" c="dimmed">
                              Ref: {row.receipt_number}
                            </Text>
                          )}
                          {row.receipt_confirmed_at && (
                            <Text size="xs" c="dimmed">
                              {new Date(row.receipt_confirmed_at).toLocaleString()}
                            </Text>
                          )}
                        </Stack>
                      ),
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (row: MlcPoliceIntimation) => (
                        <Group gap={4} wrap="nowrap" justify="flex-end">
                          {canPrintPoliceIntimationPacket && (
                            <Tooltip label="Print police intimation">
                              <ActionIcon
                                color="teal"
                                variant="light"
                                aria-label="Print police intimation"
                                disabled={policeIntimationPrintMut.isPending}
                                onClick={() => preparePoliceIntimationPrint(row)}
                              >
                                <IconPrinter size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {canReprintPoliceIntimationPacket && (
                            <Tooltip label="Reprint police intimation">
                              <ActionIcon
                                color="orange"
                                variant="light"
                                aria-label="Reprint police intimation"
                                disabled={policeIntimationPrintMut.isPending}
                                onClick={() => openPoliceIntimationReprintModal(row)}
                              >
                                <IconPrinter size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {canConfirmPoliceReceipt && !row.receipt_confirmed && (
                            <Tooltip label="Confirm police receipt">
                              <ActionIcon
                                color="success"
                                variant="light"
                                aria-label="Confirm police receipt"
                                disabled={confirmPoliceReceiptMut.isPending}
                                onClick={() => openReceiptConfirmation(row)}
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      ),
                    },
                  ]}
                  data={policeIntimations}
                  loading={policeIntimationsLoading}
                  rowKey={(row) => row.id}
                />
              </Paper>
            ) : (
              <Text size="sm" c="dimmed">
                Police intimation history is restricted for this role.
              </Text>
            )}
          </Box>
        )}

        {/* SBAR Handover Documents */}
        {sbarDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">
              SBAR Handover Records
            </Title>
            <Stack gap="xs">
              {sbarDocs.map((doc) => {
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        S:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "situation")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        B:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "background")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        A:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "assessment")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        R:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "recommendation")}
                    </Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Age Estimation Documents */}
        {ageEstDocs.length > 0 && (
          <Box>
            <Title order={6} mb="xs">
              Age Estimation Reports
            </Title>
            <Stack gap="xs">
              {ageEstDocs.map((doc) => {
                return (
                  <Card key={doc.id} withBorder p="sm">
                    <Text size="xs" c="dimmed" mb="xs">
                      {new Date(doc.created_at).toLocaleString()}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Ossification:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "ossification_center_findings")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Dental:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "dental_examination")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Secondary Sexual:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "secondary_sexual_characteristics")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Estimated Range:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "estimated_age_range")}
                    </Text>
                    <Text size="sm">
                      <Text span fw={600}>
                        Opinion:
                      </Text>{" "}
                      {mlcDocumentText(doc.content, "examiner_opinion")}
                    </Text>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* POCSO Reports */}
        {pocsoDocs.length > 0 && !canViewPocsoReport && (
          <Alert color="gray" variant="light" icon={<IconAlertTriangle size={16} />}>
            POCSO report content is restricted for this role.
          </Alert>
        )}
        {pocsoDocs.length > 0 && canViewPocsoReport && (
          <Box>
            <Title order={6} mb="xs">
              POCSO Reports
            </Title>
            <Stack gap="xs">
              {pocsoDocs.map((doc) => (
                <Card key={doc.id} withBorder p="sm">
                  <Text size="xs" c="dimmed" mb="xs">
                    {new Date(doc.created_at).toLocaleString()}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Child Age:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(pocsoReportAccess, doc.content, "child_age")}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Guardian:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(pocsoReportAccess, doc.content, "guardian_details")}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Statement:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(pocsoReportAccess, doc.content, "statement_summary")}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Injuries:
                    </Text>{" "}
                    {mlcDocumentSensitiveText(
                      pocsoReportAccess,
                      doc.content,
                      "injuries_documented",
                    )}
                  </Text>
                  <Text size="sm">
                    <Text span fw={600}>
                      Psych Assessment Needed:
                    </Text>{" "}
                    {mlcDocumentSensitiveBoolean(
                      pocsoReportAccess,
                      doc.content,
                      "psych_assessment_needed",
                    )}
                  </Text>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Court Summons */}
        <Box>
          <Group justify="space-between" mb="xs">
            <Title order={6}>Court Summons</Title>
            <Badge variant="light">{courtSummonsDocs.length} record(s)</Badge>
          </Group>
          {courtSummonsDocs.length > 0 ? (
            <Paper withBorder>
              <DataTable
                columns={[
                  {
                    key: "date",
                    label: "Date",
                    render: (d: MlcDocument) => {
                      const date = mlcDocumentText(d.content, "date");
                      return date === "---" ? date : new Date(date).toLocaleDateString();
                    },
                  },
                  {
                    key: "court_name",
                    label: "Court",
                    render: (d: MlcDocument) => mlcDocumentText(d.content, "court_name"),
                  },
                  {
                    key: "case_number",
                    label: "Case #",
                    render: (d: MlcDocument) => mlcDocumentText(d.content, "case_number"),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (d: MlcDocument) => {
                      const status = mlcDocumentText(d.content, "status");
                      const s = status === "---" ? "pending" : status;
                      const color =
                        s === "attended"
                          ? "success"
                          : s === "adjourned"
                            ? "warning"
                            : s === "pending"
                              ? "primary"
                              : "slate";
                      return (
                        <Badge color={color} size="sm">
                          {s}
                        </Badge>
                      );
                    },
                  },
                  {
                    key: "created_at",
                    label: "Created",
                    render: (d: MlcDocument) => new Date(d.created_at).toLocaleString(),
                  },
                ]}
                data={courtSummonsDocs}
                loading={false}
                rowKey={(r) => r.id}
              />
            </Paper>
          ) : (
            <Text size="sm" c="dimmed">
              No court summons recorded.
            </Text>
          )}
        </Box>
      </Stack>

      <Modal
        opened={mlcReprintOpened}
        onClose={() => {
          closeMlcReprint();
          mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
        }}
        title="MLC reprint"
        centered
      >
        <form onSubmit={prepareMlcReprint}>
          <Stack gap="sm">
            <Controller
              name="packet_type"
              control={mlcReprintForm.control}
              render={({ field, fieldState }) => (
                <Select
                  label="Packet"
                  data={MLC_PRINT_PACKET_OPTIONS}
                  value={field.value}
                  onChange={(value) => {
                    if (isMlcPrintPacketType(value)) {
                      field.onChange(value);
                    }
                  }}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
            <Controller
              name="reprint_reason"
              control={mlcReprintForm.control}
              render={({ field, fieldState }) => (
                <Textarea
                  label="Reason"
                  placeholder="Example: original legal copy damaged or duplicate requested by police"
                  minRows={3}
                  error={fieldState.error?.message}
                  required
                  {...field}
                />
              )}
            />
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              Reprints are audited and require a reason. First prints should use Print MLC.
            </Alert>
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => {
                  closeMlcReprint();
                  mlcReprintForm.reset(EMPTY_MLC_PRINT_REPRINT);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={mlcPrintMut.isPending}>
                Prepare reprint
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={policeIntimationReprintOpened}
        onClose={closePoliceIntimationReprintModal}
        title="Police intimation reprint"
        centered
      >
        <form onSubmit={preparePoliceIntimationReprint}>
          <Stack gap="sm">
            {policePrintTarget && (
              <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
                Reprinting {policePrintTarget.intimation_number} for{" "}
                {renderSensitiveValue(policeStationAccess, policePrintTarget.police_station)}.
              </Alert>
            )}
            <Controller
              name="reprint_reason"
              control={policeIntimationReprintForm.control}
              render={({ field, fieldState }) => (
                <Textarea
                  label="Reason"
                  placeholder="Example: duplicate copy requested by police station"
                  minRows={3}
                  error={fieldState.error?.message}
                  required
                  {...field}
                />
              )}
            />
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              Police intimation reprints are audited and require a reason.
            </Alert>
            <Group justify="flex-end">
              <Button variant="default" onClick={closePoliceIntimationReprintModal}>
                Cancel
              </Button>
              <Button type="submit" loading={policeIntimationPrintMut.isPending}>
                Prepare reprint
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={mlcPrintPreviewOpened}
        onClose={closeMlcPrintPreviewModal}
        title={
          lastMlcPrintAction === "reprint"
            ? `${mlcPrintPreviewTitle} Reprint`
            : mlcPrintPreviewTitle
        }
        size="xl"
      >
        {mlcPrintPreview && (
          <Stack gap="md">
            <Box ref={mlcPrintRef} className="print-page">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Title order={4}>{mlcPrintPreviewTitle}</Title>
                    <Text size="sm" c="dimmed">
                      {mlcPrintPreview.packetType === "police-intimation"
                        ? "Police intimation print record"
                        : mlcPrintPreview.packetType === "register"
                          ? "Medico-legal register extract"
                          : "Consolidated medico-legal documentation packet"}
                    </Text>
                  </Box>
                  {lastMlcPrintAction === "reprint" && (
                    <Badge className="duplicate" color="orange" variant="light">
                      Duplicate
                    </Badge>
                  )}
                </Group>
                {mlcPrintPreview.packetType === "police-intimation" ? (
                  <MlcPoliceIntimationPrintPreview data={mlcPrintPreview.data} />
                ) : mlcPrintPreview.packetType === "register" ? (
                  <MlcRegisterPrintPreview data={mlcPrintPreview.data} />
                ) : (
                  <MlcDocumentationPrintPreview data={mlcPrintPreview.data} />
                )}
              </Stack>
            </Box>
            <Group justify="flex-end">
              <Button variant="default" onClick={closeMlcPrintPreviewModal}>
                Close
              </Button>
              <Button
                leftSection={<IconPrinter size={14} />}
                onClick={() => printHtmlElement(mlcPrintPreviewTitle, mlcPrintRef.current)}
              >
                {lastMlcPrintAction === "reprint" ? "Print Duplicate" : "Print"}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* SBAR Handover Drawer */}
      <Drawer
        opened={sbarOpened}
        onClose={() => {
          closeSbar();
          resetSbar(EMPTY_SBAR);
        }}
        title="SBAR Handover"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitSbar}>
          <Alert color="primary" variant="light" icon={<IconShieldCheck size={16} />}>
            SBAR (Situation-Background-Assessment-Recommendation) is a standardized communication
            tool for clinical handovers as recommended by WHO and NABH.
          </Alert>
          <Textarea
            label="Situation"
            description="Concise statement of the problem: who is the patient, what is the current concern?"
            error={sbarErrors.situation?.message}
            {...registerSbar("situation")}
            minRows={3}
            required
          />
          <Textarea
            label="Background"
            description="Pertinent history, context: relevant medical history, current medications, allergies, lab results"
            error={sbarErrors.background?.message}
            {...registerSbar("background")}
            minRows={3}
            required
          />
          <Textarea
            label="Assessment"
            description="Your clinical assessment: what you think the problem is"
            error={sbarErrors.assessment?.message}
            {...registerSbar("assessment")}
            minRows={3}
            required
          />
          <Textarea
            label="Recommendation"
            description="What you need: specific request, action needed, timeline"
            error={sbarErrors.recommendation?.message}
            {...registerSbar("recommendation")}
            minRows={3}
            required
          />
          <Button type="submit" loading={createDocMut.isPending}>
            Save SBAR Handover
          </Button>
        </Stack>
      </Drawer>

      {/* Age Estimation Drawer */}
      <Drawer
        opened={ageEstOpened}
        onClose={() => {
          closeAgeEst();
          resetAgeEst(EMPTY_AGE_EST);
        }}
        title="Age Estimation Documentation"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitAgeEst}>
          <Alert color="violet" variant="light" icon={<IconScale size={16} />}>
            Age estimation is a medico-legal procedure. Document all findings carefully. Ensure the
            examination is conducted by an authorized medical officer.
          </Alert>
          <Textarea
            label="Ossification Center Findings"
            description="X-ray findings of wrist, elbow, pelvis, and other ossification centers"
            error={ageEstErrors.ossification_center_findings?.message}
            {...registerAgeEst("ossification_center_findings")}
            minRows={3}
            required
          />
          <Textarea
            label="Dental Examination"
            description="Eruption of teeth, third molar status, dental age assessment"
            error={ageEstErrors.dental_examination?.message}
            {...registerAgeEst("dental_examination")}
            minRows={3}
            required
          />
          <Textarea
            label="Secondary Sexual Characteristics"
            description="Development stage as per Tanner staging"
            error={ageEstErrors.secondary_sexual_characteristics?.message}
            {...registerAgeEst("secondary_sexual_characteristics")}
            minRows={3}
            required
          />
          <TextInput
            label="Estimated Age Range"
            description="e.g., 16-18 years"
            error={ageEstErrors.estimated_age_range?.message}
            {...registerAgeEst("estimated_age_range")}
            required
          />
          <Textarea
            label="Examiner Opinion"
            description="Final opinion on probable age with reasoning"
            error={ageEstErrors.examiner_opinion?.message}
            {...registerAgeEst("examiner_opinion")}
            minRows={3}
            required
          />
          <Button color="violet" type="submit" loading={createDocMut.isPending}>
            Save Age Estimation
          </Button>
        </Stack>
      </Drawer>

      {/* POCSO Report Drawer */}
      <Drawer
        opened={pocsoOpened}
        onClose={() => {
          closePocso();
          resetPocso(EMPTY_POCSO);
        }}
        title="POCSO Report"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitPocso}>
          <Alert color="danger" variant="filled" icon={<IconAlertOctagon size={16} />}>
            POCSO Act, 2012 mandates mandatory reporting. This report is a legal document. Ensure
            child-friendly language and procedures throughout.
          </Alert>
          <TextInput
            label="Child Age"
            description="Age of the child victim"
            error={pocsoErrors.child_age?.message}
            {...registerPocso("child_age")}
            required
          />
          <Textarea
            label="Guardian Details"
            description="Name, relation, contact of guardian/parent accompanying the child"
            error={pocsoErrors.guardian_details?.message}
            {...registerPocso("guardian_details")}
            minRows={2}
            required
          />
          <Textarea
            label="Statement Summary"
            description="Summary of statement in the child's own words (do not lead or suggest)"
            error={pocsoErrors.statement_summary?.message}
            {...registerPocso("statement_summary")}
            minRows={4}
            required
          />
          <Textarea
            label="Injuries Documented"
            description="Clinical findings: injuries, marks, physical examination findings"
            error={pocsoErrors.injuries_documented?.message}
            {...registerPocso("injuries_documented")}
            minRows={3}
            required
          />
          <Controller
            name="psych_assessment_needed"
            control={pocsoControl}
            render={({ field }) => (
              <Checkbox
                label="Psychological assessment needed"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button color="danger" type="submit" loading={createDocMut.isPending}>
            Save POCSO Report
          </Button>
        </Stack>
      </Drawer>

      {/* Court Summons Drawer */}
      <Drawer
        opened={summonsOpened}
        onClose={() => {
          closeSummons();
          resetSummons(EMPTY_SUMMONS);
        }}
        title="Add Court Summons"
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={submitSummons}>
          <TextInput
            label="Date"
            type="date"
            error={summonsErrors.date?.message}
            {...registerSummons("date")}
            required
          />
          <TextInput
            label="Court Name"
            error={summonsErrors.court_name?.message}
            {...registerSummons("court_name")}
            required
          />
          <TextInput
            label="Case Number"
            error={summonsErrors.case_number?.message}
            {...registerSummons("case_number")}
            required
          />
          <Controller
            name="status"
            control={summonsControl}
            render={({ field }) => (
              <Select
                label="Status"
                data={[
                  { value: "pending", label: "Pending" },
                  { value: "attended", label: "Attended" },
                  { value: "adjourned", label: "Adjourned" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={summonsErrors.status?.message}
              />
            )}
          />
          <Textarea
            label="Notes"
            error={summonsErrors.notes?.message}
            {...registerSummons("notes")}
          />
          <Button color="warning" type="submit" loading={createDocMut.isPending}>
            Save Court Summons
          </Button>
        </Stack>
      </Drawer>

      {/* Police Intimation Drawer */}
      <Drawer
        opened={policeIntimationOpened}
        onClose={() => {
          closePoliceIntimation();
          resetPoliceIntimation({
            ...EMPTY_POLICE_INTIMATION,
            police_station: mlcCase.police_station ?? "",
          });
        }}
        title="Record Police Intimation"
        position="right"
        size="md"
      >
        <Stack component="form" onSubmit={submitPoliceIntimation}>
          <Alert color="primary" variant="light" icon={<IconBell size={16} />}>
            Record the mandatory police intimation details for this medico-legal case. The
            police-station field follows MLC field-access restrictions.
          </Alert>
          <Controller
            name="police_station"
            control={policeIntimationControl}
            render={({ field }) => (
              <TextInput
                label="Police Station"
                disabled={!canEditSensitiveField(policeStationAccess)}
                error={policeIntimationErrors.police_station?.message}
                required
                {...field}
              />
            )}
          />
          <TextInput
            label="Officer Name"
            error={policeIntimationErrors.officer_name?.message}
            {...registerPoliceIntimation("officer_name")}
          />
          <TextInput
            label="Officer Designation"
            error={policeIntimationErrors.officer_designation?.message}
            {...registerPoliceIntimation("officer_designation")}
          />
          <TextInput
            label="Officer Contact"
            error={policeIntimationErrors.officer_contact?.message}
            {...registerPoliceIntimation("officer_contact")}
          />
          <Controller
            name="sent_via"
            control={policeIntimationControl}
            render={({ field }) => (
              <Select
                label="Sent Via"
                data={emergencyMlcPoliceSentViaOptions}
                value={field.value}
                onChange={field.onChange}
                error={policeIntimationErrors.sent_via?.message}
                required
              />
            )}
          />
          <Textarea
            label="Notes"
            error={policeIntimationErrors.notes?.message}
            {...registerPoliceIntimation("notes")}
            minRows={3}
          />
          <Button type="submit" loading={createPoliceIntimationMut.isPending}>
            Save Police Intimation
          </Button>
        </Stack>
      </Drawer>

      <Modal
        opened={policeReceiptOpened}
        onClose={closeReceiptConfirmation}
        title="Confirm Police Receipt"
        centered
      >
        <Stack component="form" onSubmit={submitPoliceReceipt}>
          {receiptTarget && (
            <Alert color="success" variant="light" icon={<IconCheck size={16} />}>
              Confirming receipt for {receiptTarget.intimation_number}
            </Alert>
          )}
          <TextInput
            label="Receipt / reference number"
            error={policeReceiptErrors.receipt_number?.message}
            {...registerPoliceReceipt("receipt_number")}
            required
          />
          <Textarea
            label="Receipt notes"
            error={policeReceiptErrors.notes?.message}
            {...registerPoliceReceipt("notes")}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeReceiptConfirmation}>
              Cancel
            </Button>
            <Button color="success" type="submit" loading={confirmPoliceReceiptMut.isPending}>
              Confirm Receipt
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mlc-cases"] });
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
              <ActionIcon
                variant="light"
                color="primary"
                aria-label="View MLC case details and documents"
                onClick={() => handleViewCase(r)}
              >
                <IconFileText size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip label="Update MLC case">
              <ActionIcon
                color="primary"
                variant="light"
                aria-label="Update MLC case"
                disabled={updateMutation.isPending}
                onClick={() => handleOpenUpdateCase(r)}
              >
                <IconPencil size={16} />
              </ActionIcon>
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
            <Alert color="orange" variant="light" icon={<IconGavel size={16} />}>
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
            <Button variant="subtle" onClick={handleCloseUpdateCase}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
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
          <Button type="submit" loading={mutation.isPending}>
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

function MassCasualtyTab({
  canView,
  canCreate,
  canUpdate,
  canClose,
}: {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canClose: boolean;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  const [updateOpened, { open: openUpdate, close: closeUpdate }] = useDisclosure(false);
  const [eventToUpdate, setEventToUpdate] = useState<MassCasualtyEvent | null>(null);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["mass-casualty"],
    queryFn: () => emergencyService.listMassCasualtyEvents(),
    enabled: canView,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MassCasualtyEventFormInput>({
    resolver: zodResolver(massCasualtyEventFormSchema),
    defaultValues: emptyMassCasualtyEventForm,
  });
  const {
    control: updateControl,
    handleSubmit: handleUpdateSubmit,
    reset: resetUpdate,
    formState: { errors: updateErrors },
  } = useForm<MassCasualtyEventUpdateFormInput>({
    resolver: zodResolver(massCasualtyEventUpdateFormSchema),
    defaultValues: emptyMassCasualtyEventUpdateForm,
  });
  const mutation = useMutation({
    mutationFn: (d: CreateMassCasualtyEventRequest) => emergencyService.createMassCasualtyEvent(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mass-casualty"] });
      close();
      notifications.show({
        title: "Code Yellow",
        message: "Mass casualty event activated",
        color: "danger",
      });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }: { id: string; data: UpdateMassCasualtyEventRequest }) =>
      emergencyService.updateMassCasualtyEvent(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mass-casualty"] });
      closeUpdate();
      setEventToUpdate(null);
      resetUpdate(emptyMassCasualtyEventUpdateForm);
      notifications.show({
        title: "Mass Casualty Updated",
        message: "Mass casualty event status updated",
        color: "success",
      });
    },
  });

  const submitMassCasualtyEvent = (values: MassCasualtyEventFormInput) => {
    mutation.mutate({
      event_name: values.event_name.trim(),
      event_type: values.event_type || undefined,
      location: emergencyOptionalText(values.location),
      estimated_casualties: emergencyOptionalInteger(values.estimated_casualties),
      notes: emergencyOptionalText(values.notes),
    });
  };

  const editableMassCasualtyStatus = (
    status: MassCasualtyEvent["status"],
  ): MassCasualtyEventUpdateFormInput["status"] => {
    switch (status) {
      case "activated":
      case "ongoing":
      case "scaling_down":
        return status;
      case "deactivated":
        return "scaling_down";
    }
  };

  const handleOpenUpdate = (event: MassCasualtyEvent) => {
    setEventToUpdate(event);
    resetUpdate({
      status: editableMassCasualtyStatus(event.status),
      actual_casualties: event.actual_casualties ?? event.estimated_casualties ?? "",
      notes: event.notes ?? "",
    });
    openUpdate();
  };

  const handleCloseUpdate = () => {
    closeUpdate();
    setEventToUpdate(null);
    resetUpdate(emptyMassCasualtyEventUpdateForm);
  };

  const submitMassCasualtyUpdate = (values: MassCasualtyEventUpdateFormInput) => {
    if (!eventToUpdate) {
      return;
    }
    updateMutation.mutate({
      id: eventToUpdate.id,
      data: {
        status: values.status,
        actual_casualties: emergencyOptionalInteger(values.actual_casualties),
        notes: emergencyOptionalText(values.notes),
      },
    });
  };

  const deactivateMassCasualtyEvent = (event: MassCasualtyEvent) => {
    if (!canClose || event.status === "deactivated") return;
    const actualCasualties = event.actual_casualties ?? event.estimated_casualties;
    const payload: UpdateMassCasualtyEventRequest = {
      status: "deactivated",
      notes: "Deactivated from emergency dashboard",
    };
    if (actualCasualties !== null) {
      payload.actual_casualties = actualCasualties;
    }
    updateMutation.mutate({
      id: event.id,
      data: payload,
    });
  };

  const mcStatusColor = (s: string) => {
    switch (s) {
      case "activated":
        return "danger";
      case "ongoing":
        return "orange";
      case "scaling_down":
        return "warning";
      case "deactivated":
        return "success";
      default:
        return "gray";
    }
  };

  const columns = [
    {
      key: "event_name",
      label: "Event",
      render: (r: MassCasualtyEvent) => <Text fw={600}>{r.event_name}</Text>,
    },
    {
      key: "event_type",
      label: "Type",
      render: (r: MassCasualtyEvent) =>
        r.event_type ? <TableValueBadge value={r.event_type} kind="priority" /> : "---",
    },
    {
      key: "status",
      label: "Status",
      render: (r: MassCasualtyEvent) => (
        <TableValueBadge value={r.status} color={mcStatusColor(r.status)} variant="filled" />
      ),
    },
    {
      key: "activated_at",
      label: "Activated",
      render: (r: MassCasualtyEvent) => new Date(r.activated_at).toLocaleString(),
    },
    {
      key: "estimated_casualties",
      label: "Est. Casualties",
      render: (r: MassCasualtyEvent) => r.estimated_casualties ?? "---",
    },
    {
      key: "actual_casualties",
      label: "Actual",
      render: (r: MassCasualtyEvent) => r.actual_casualties ?? "---",
    },
    { key: "location", label: "Location", render: (r: MassCasualtyEvent) => r.location ?? "---" },
    ...(canUpdate || canClose
      ? [
          {
            key: "actions",
            label: "Actions",
            render: (r: MassCasualtyEvent) => (
              <Group gap="xs">
                {canUpdate && r.status !== "deactivated" && (
                  <Tooltip label="Update response">
                    <ActionIcon
                      color="primary"
                      variant="light"
                      aria-label="Update mass casualty response"
                      disabled={updateMutation.isPending}
                      onClick={() => handleOpenUpdate(r)}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {canClose && (
                  <Tooltip
                    label={r.status === "deactivated" ? "Already deactivated" : "Deactivate event"}
                  >
                    <ActionIcon
                      color="success"
                      variant="light"
                      aria-label="Deactivate mass casualty event"
                      disabled={r.status === "deactivated" || updateMutation.isPending}
                      onClick={() => deactivateMassCasualtyEvent(r)}
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack mt="md">
      {canCreate && (
        <Group justify="flex-end">
          <Button
            leftSection={<IconBell size={16} />}
            color="danger"
            onClick={() => {
              reset(emptyMassCasualtyEventForm);
              open();
            }}
          >
            Activate Mass Casualty
          </Button>
        </Group>
      )}
      {canView ? (
        <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Mass casualty event list is not available for your role. You can activate a new event
            when creation is allowed.
          </Text>
        </Card>
      )}

      <Drawer
        opened={updateOpened}
        onClose={handleCloseUpdate}
        title={eventToUpdate ? `Update ${eventToUpdate.event_name}` : "Update Mass Casualty Event"}
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleUpdateSubmit(submitMassCasualtyUpdate)}>
          {eventToUpdate && (
            <Alert color="orange" variant="light" icon={<IconUsers size={16} />}>
              <Text size="sm" fw={600}>
                {eventToUpdate.event_name}
              </Text>
              <Text size="sm" c="dimmed">
                {eventToUpdate.location ?? "Location not recorded"} - activated{" "}
                {new Date(eventToUpdate.activated_at).toLocaleString()}
              </Text>
            </Alert>
          )}
          <Controller
            name="status"
            control={updateControl}
            render={({ field }) => (
              <Select
                label="Response status"
                required
                data={emergencyMassCasualtyStatusOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "ongoing")}
                error={updateErrors.status?.message}
              />
            )}
          />
          <Controller
            name="actual_casualties"
            control={updateControl}
            render={({ field }) => (
              <NumberInput
                label="Actual casualties"
                value={field.value}
                onChange={field.onChange}
                error={updateErrors.actual_casualties?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={updateControl}
            render={({ field }) => (
              <Textarea
                label="Operational notes"
                placeholder="Triage summary, resources deployed, notifications completed"
                minRows={4}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleCloseUpdate}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save Update
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Drawer
        opened={opened}
        onClose={close}
        title="Activate Mass Casualty Event"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(submitMassCasualtyEvent)}>
          <Controller
            name="event_name"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Event Name"
                required
                {...field}
                error={errors.event_name?.message}
              />
            )}
          />
          <Controller
            name="event_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Event Type"
                data={emergencyMassCasualtyTypeOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                clearable
                error={errors.event_type?.message}
              />
            )}
          />
          <Controller
            name="location"
            control={control}
            render={({ field }) => <TextInput label="Location" {...field} />}
          />
          <Controller
            name="estimated_casualties"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Estimated Casualties"
                value={field.value}
                onChange={field.onChange}
                error={errors.estimated_casualties?.message}
              />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button color="danger" type="submit" loading={mutation.isPending}>
            Activate Mass Casualty
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
