import { Box, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconBuildingBank,
  IconClipboardList,
  IconFlask,
  IconLungs,
  IconMapPin,
  IconPill,
  IconReportMedical,
  IconVirus,
} from "@tabler/icons-react";
import { PageHeader, type RailGroup, WorkspaceRail } from "@/components";
import { useHashTabs } from "@/hooks/useHashTabs";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { FormularyTab } from "./clinical-kb/formulary-tab";
import { IhipTab } from "./clinical-kb/ihip-tab";
import { LabReferenceTab } from "./clinical-kb/lab-reference-tab";
import { NikshayTab } from "./clinical-kb/nikshay-tab";
import { NotifiableDiseasesTab } from "./clinical-kb/notifiable-diseases-tab";
import { ReportsTab } from "./clinical-kb/reports-tab";
import { StateFormularyTab } from "./clinical-kb/state-formulary-tab";
import { StateListTab } from "./clinical-kb/state-list-tab";
import styles from "./mrd.module.scss";

const CKB_TABS = [
  "notifiable",
  "state-list",
  "reports",
  "nikshay",
  "ihip",
  "formulary",
  "lab",
  "schemes",
] as const;

export function ClinicalKbPage() {
  useRequirePermission(P.CKB.VIEW);
  const canManage = useHasPermission(P.CKB.REPORTS_MANAGE);
  const canListReports = useHasPermission(P.CKB.REPORTS_LIST);
  const canManageRules = useHasPermission(P.CKB.NOTIFIABLE_RULES_MANAGE);
  const canExport = useHasPermission(P.CKB.REPORTS_EXPORT);

  const groups: RailGroup[] = [
    {
      label: "Statutory",
      items: [
        { value: "notifiable", label: "Notifiable diseases", icon: <IconVirus size={14} /> },
        { value: "state-list", label: "This hospital's list", icon: <IconMapPin size={14} /> },
        { value: "reports", label: "Reporting worklist", icon: <IconReportMedical size={14} /> },
        { value: "nikshay", label: "TB · Ni-kshay", icon: <IconLungs size={14} /> },
        { value: "ihip", label: "IDSP · IHIP lists", icon: <IconClipboardList size={14} /> },
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
          <Tabs.Panel value="state-list">
            <StateListTab canManage={canManageRules} />
          </Tabs.Panel>
          <Tabs.Panel value="reports">
            <ReportsTab canManage={canManage} canList={canListReports} />
          </Tabs.Panel>
          <Tabs.Panel value="nikshay">
            <NikshayTab canList={canListReports} canManage={canManage} canExport={canExport} />
          </Tabs.Panel>
          <Tabs.Panel value="ihip">
            <IhipTab canList={canListReports} canManage={canManage} canExport={canExport} />
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
