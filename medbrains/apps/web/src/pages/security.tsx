import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBabyCarriage,
  IconFileReport,
  IconShieldLock,
  IconVideo,
} from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AccessControlTab } from "./security/access-control-tab";
import { CctvTab } from "./security/cctv-tab";
import { CodeDebriefsTab } from "./security/code-debriefs-tab";
import { IncidentsTab } from "./security/incidents-tab";
import { PatientSafetyTab } from "./security/patient-safety-tab";

export function SecurityPage() {
  useRequirePermission(P.SECURITY.ACCESS_LIST);

  return (
    <div>
      <PageHeader
        title="Security Department"
        subtitle="Access control, CCTV, incident management, patient safety tags"
      />
      <Tabs defaultValue="access">
        <Tabs.List>
          <Tabs.Tab value="access" leftSection={<IconShieldLock size={16} />}>
            Access Control
          </Tabs.Tab>
          <Tabs.Tab value="cctv" leftSection={<IconVideo size={16} />}>
            CCTV
          </Tabs.Tab>
          <Tabs.Tab value="incidents" leftSection={<IconAlertTriangle size={16} />}>
            Incidents
          </Tabs.Tab>
          <Tabs.Tab value="patient-safety" leftSection={<IconBabyCarriage size={16} />}>
            Patient Safety
          </Tabs.Tab>
          <Tabs.Tab value="debriefs" leftSection={<IconFileReport size={16} />}>
            Code Debriefs
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="access" pt="md">
          <AccessControlTab />
        </Tabs.Panel>
        <Tabs.Panel value="cctv" pt="md">
          <CctvTab />
        </Tabs.Panel>
        <Tabs.Panel value="incidents" pt="md">
          <IncidentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="patient-safety" pt="md">
          <PatientSafetyTab />
        </Tabs.Panel>
        <Tabs.Panel value="debriefs" pt="md">
          <CodeDebriefsTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
