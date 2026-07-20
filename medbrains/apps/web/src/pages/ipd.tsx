import { Card, Stack, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBed,
  IconBuildingHospital,
  IconCalendarTime,
  IconChartBar,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ClinicalEventProvider, PageHeader } from "@/components";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { Alert, Button } from "@/components/ui";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AdmissionDetail } from "./ipd/admission-detail";
import { AdmissionForm } from "./ipd/admission-form";
import { AdmissionsTab } from "./ipd/admissions";
import { BedDashboardTab } from "./ipd/bed-dashboard";
import { ExpectedDischargesTab } from "./ipd/expected-discharges";
import { ReportsTab } from "./ipd/reports-tab";
import { WardsTab } from "./ipd/wards";

const IPD_LANDING_DEFAULT_TAB = "admissions";

export function IpdPage() {
  useRequirePermission(P.IPD.ADMISSIONS_LIST);

  return (
    <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-admissions">
      <IpdPageInner />
    </ClinicalEventProvider>
  );
}

function IpdPageInner() {
  const { t } = useTranslation("ipd");
  const canViewBedDashboard = useHasPermission(P.IPD.BED_DASHBOARD_VIEW);
  const canManageWards = useHasPermission(P.IPD.WARDS_MANAGE);
  const canViewReports = useHasPermission(P.IPD.REPORTS_VIEW);
  const canViewWards = canManageWards || canViewBedDashboard;
  const landingTabValues = useMemo(
    () => [
      IPD_LANDING_DEFAULT_TAB,
      ...(canViewWards ? ["wards"] : []),
      ...(canViewBedDashboard ? ["bed-dashboard"] : []),
      ...(canViewReports ? ["reports"] : []),
      "expected-discharges",
    ],
    [canViewBedDashboard, canViewReports, canViewWards],
  );
  const [activeLandingTab, setActiveLandingTab] = useHashTabs(
    IPD_LANDING_DEFAULT_TAB,
    landingTabValues,
  );
  const safeActiveLandingTab = landingTabValues.includes(activeLandingTab)
    ? activeLandingTab
    : IPD_LANDING_DEFAULT_TAB;

  return (
    <div>
      <PageHeader
        title={t("title.ipd")}
        subtitle={t("subtitle.inpatientDepartment")}
        icon={<IconBed size={20} stroke={1.5} />}
        color="primary"
      />

      <Tabs value={safeActiveLandingTab} onChange={setActiveLandingTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="admissions" leftSection={<IconBed size={16} />}>
            {t("admissions")}
          </Tabs.Tab>
          {canViewWards && (
            <Tabs.Tab value="wards" leftSection={<IconBuildingHospital size={16} />}>
              {t("wards")}
            </Tabs.Tab>
          )}
          {canViewBedDashboard && (
            <Tabs.Tab value="bed-dashboard" leftSection={<IconLayoutGrid size={16} />}>
              {t("bedDashboard")}
            </Tabs.Tab>
          )}
          {canViewReports && (
            <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>
              {t("reports")}
            </Tabs.Tab>
          )}
          <Tabs.Tab value="expected-discharges" leftSection={<IconCalendarTime size={16} />}>
            {t("expectedDischarges")}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="admissions">
          <AdmissionsTab />
        </Tabs.Panel>
        {canViewWards && (
          <Tabs.Panel value="wards">
            <WardsTab />
          </Tabs.Panel>
        )}
        {canViewBedDashboard && (
          <Tabs.Panel value="bed-dashboard">
            <BedDashboardTab />
          </Tabs.Panel>
        )}
        {canViewReports && (
          <Tabs.Panel value="reports">
            <ReportsTab />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="expected-discharges">
          <ExpectedDischargesTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Admissions Tab ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export function IpdNewAdmissionPage() {
  useRequirePermission(P.IPD.ADMISSIONS_CREATE);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get("patient_id") ?? "";

  return (
    <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-new-admission">
      <Stack>
        <PageHeader
          title="New IPD admission"
          subtitle="Admit a registered patient into an inpatient bed and care team."
          icon={<IconBed size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/ipd")}>
              Back to IPD
            </Button>
          }
        />
        {initialPatientId && <PatientContextBanner patientId={initialPatientId} />}
        <Card withBorder radius="md" p="md">
          <AdmissionForm
            key={initialPatientId}
            initialPatientId={initialPatientId}
            onCancel={() => navigate("/ipd")}
            onCreated={(result) => navigate(`/ipd/admissions/${result.admission.id}`)}
          />
        </Card>
      </Stack>
    </ClinicalEventProvider>
  );
}

export function IpdAdmissionDetailPage() {
  useRequirePermission(P.IPD.ADMISSIONS_VIEW);

  const navigate = useNavigate();
  const { admissionId } = useParams<{ admissionId: string }>();
  const canCreate = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const canManageBeds = useHasPermission(P.IPD.BEDS_MANAGE);
  const canDischarge = useHasPermission(P.IPD.DISCHARGE_CREATE);

  if (!admissionId) {
    return (
      <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-admission-detail">
        <Stack>
          <PageHeader
            title="IPD admission"
            subtitle="Admission route is missing an admission identifier."
            icon={<IconBed size={20} stroke={1.5} />}
            color="primary"
            actions={
              <Button tone="ghost" onClick={() => navigate("/ipd")}>
                Back to IPD
              </Button>
            }
          />
          <Alert tone="danger" icon={<IconAlertTriangle size={16} />}>
            Unable to open this IPD admission because the route does not include an admission ID.
          </Alert>
        </Stack>
      </ClinicalEventProvider>
    );
  }

  return (
    <ClinicalEventProvider moduleCode="ipd" contextCode="ipd-admission-detail">
      <Stack>
        <PageHeader
          title="IPD admission"
          subtitle="Patient, orders, nursing, discharge, billing, and documentation workspace."
          icon={<IconBed size={20} stroke={1.5} />}
          color="primary"
          actions={
            <Button tone="ghost" onClick={() => navigate("/ipd")}>
              Back to IPD
            </Button>
          }
        />
        <AdmissionDetail
          admissionId={admissionId}
          canCreate={canCreate}
          canManageBeds={canManageBeds}
          canDischarge={canDischarge}
        />
      </Stack>
    </ClinicalEventProvider>
  );
}

// ═══════════════════════════════════════════════════════════
// ── Admission Detail ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════
