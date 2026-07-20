import { Box, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconBuildingBank,
  IconFlask,
  IconPill,
  IconReportMedical,
  IconVirus,
} from "@tabler/icons-react";
import { PageHeader, type RailGroup, WorkspaceRail } from "@/components";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { FormularyTab } from "./clinical-kb/formulary-tab";
import { LabReferenceTab } from "./clinical-kb/lab-reference-tab";
import { NotifiableDiseasesTab } from "./clinical-kb/notifiable-diseases-tab";
import { ReportsTab } from "./clinical-kb/reports-tab";
import { StateFormularyTab } from "./clinical-kb/state-formulary-tab";
import styles from "./mrd.module.scss";

const CKB_TABS = ["notifiable", "reports", "formulary", "lab", "schemes"] as const;

export function ClinicalKbPage() {
  useRequirePermission(P.CKB.VIEW);
  const canManage = useHasPermission(P.CKB.REPORTS_MANAGE);

  const groups: RailGroup[] = [
    {
      label: "Statutory",
      items: [
        { value: "notifiable", label: "Notifiable diseases", icon: <IconVirus size={14} /> },
        { value: "reports", label: "Reporting worklist", icon: <IconReportMedical size={14} /> },
      ],
    },
    {
      label: "Reference",
      items: [
        { value: "formulary", label: "Drug formulary", icon: <IconPill size={14} /> },
        { value: "lab", label: "Lab reference", icon: <IconFlask size={14} /> },
        { value: "schemes", label: "Govt free drugs", icon: <IconBuildingBank size={14} /> },
      ],
    },
  ];
  const [tab, setTab] = useHashTabs("notifiable", CKB_TABS);

  return (
    <Box className={styles.page}>
      <PageHeader
        title="Clinical Knowledge Base"
        subtitle="Diagnosis reference, notifiable diseases & statutory reporting"
      />
      <Box className={styles.workspace}>
        <WorkspaceRail groups={groups} active={tab} onChange={setTab}>
          <Tabs.Panel value="notifiable">
            <NotifiableDiseasesTab />
          </Tabs.Panel>
          <Tabs.Panel value="reports">
            <ReportsTab canManage={canManage} />
          </Tabs.Panel>
          <Tabs.Panel value="formulary">
            <FormularyTab />
          </Tabs.Panel>
          <Tabs.Panel value="lab">
            <LabReferenceTab />
          </Tabs.Panel>
          <Tabs.Panel value="schemes">
            <StateFormularyTab />
          </Tabs.Panel>
        </WorkspaceRail>
      </Box>
    </Box>
  );
}
