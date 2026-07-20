import { AdherenceTab } from "./chronic-care/adherence-tab";
import { DrugOgramTab } from "./chronic-care/drug-ogram-tab";
import { EnrollmentsTab } from "./chronic-care/enrollments-tab";
import { OutcomesTab } from "./chronic-care/outcomes-tab";
import { ProgramsTab } from "./chronic-care/programs-tab";
import { TreatmentSummaryTab } from "./chronic-care/treatment-summary-tab";
import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconFileText,
  IconHeartRateMonitor,
  IconReportMedical,
  IconTargetArrow,
  IconTimeline,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function ChronicCarePage() {
  useRequirePermission(P.CHRONIC.ENROLLMENTS_LIST);

  const canCreateProgram = useHasPermission(P.CHRONIC.PROGRAMS_CREATE);
  const canCreateEnrollment = useHasPermission(P.CHRONIC.ENROLLMENTS_CREATE);
  const canViewAdherence = useHasPermission(P.CHRONIC.ADHERENCE_LIST);
  const canViewOutcomes = useHasPermission(P.CHRONIC.OUTCOMES_VIEW);
  const canViewTimeline = useHasPermission(P.CHRONIC.TIMELINE_VIEW);

  return (
    <div>
      <PageHeader
        title="Chronic Care"
        subtitle="Disease management programs, enrollment tracking, and outcomes"
      />
      <Tabs defaultValue="enrollments">
        <Tabs.List>
          <Tabs.Tab value="programs" leftSection={<IconReportMedical size={14} />}>
            Programs
          </Tabs.Tab>
          <Tabs.Tab value="enrollments" leftSection={<IconUsers size={14} />}>
            Enrollments
          </Tabs.Tab>
          {canViewAdherence && (
            <Tabs.Tab value="adherence" leftSection={<IconHeartRateMonitor size={14} />}>
              Adherence
            </Tabs.Tab>
          )}
          {canViewOutcomes && (
            <Tabs.Tab value="outcomes" leftSection={<IconTargetArrow size={14} />}>
              Outcomes
            </Tabs.Tab>
          )}
          {canViewTimeline && (
            <Tabs.Tab value="drugogram" leftSection={<IconTimeline size={14} />}>
              Drug-o-gram
            </Tabs.Tab>
          )}
          {canViewTimeline && (
            <Tabs.Tab value="treatment-summary" leftSection={<IconFileText size={14} />}>
              Treatment Summary
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="programs" pt="md">
          <ProgramsTab canCreate={canCreateProgram} />
        </Tabs.Panel>
        <Tabs.Panel value="enrollments" pt="md">
          <EnrollmentsTab canCreate={canCreateEnrollment} />
        </Tabs.Panel>
        {canViewAdherence && (
          <Tabs.Panel value="adherence" pt="md">
            <AdherenceTab />
          </Tabs.Panel>
        )}
        {canViewOutcomes && (
          <Tabs.Panel value="outcomes" pt="md">
            <OutcomesTab />
          </Tabs.Panel>
        )}
        {canViewTimeline && (
          <Tabs.Panel value="drugogram" pt="md">
            <DrugOgramTab />
          </Tabs.Panel>
        )}
        {canViewTimeline && (
          <Tabs.Panel value="treatment-summary" pt="md">
            <TreatmentSummaryTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}
