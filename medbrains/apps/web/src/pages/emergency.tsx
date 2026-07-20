import { Tabs, Text } from "@mantine/core";

export { EmergencyVisitCreatePage } from "./emergency/visit-create-page";
export { EmergencyVisitDetailPage } from "./emergency/visit-detail-page";

import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconFirstAidKit,
  IconGavel,
  IconHeartbeat,
  IconUrgent,
  IconUsers,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { ClinicalEventProvider } from "@/components/ClinicalEventProvider";
import { ErBaysTab } from "@/components/Emergency/ErBaysTab";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Alert } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { CodesTab } from "./emergency/codes";
import { MassCasualtyTab } from "./emergency/mass-casualty";
import { MlcTab } from "./emergency/mlc";
import { ResuscitationTab } from "./emergency/resuscitation";
import { TriageLogTab } from "./emergency/triage-log";
import { VisitsTab } from "./emergency/visits";
import { emergencyTabFromSearch, emergencyVisibleTab } from "./emergency-workspace";

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
