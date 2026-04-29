import { useState } from "react";
import { Select, Tabs } from "@mantine/core";
import { IconBed, IconClipboardList, IconLogout, IconUserHeart } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { DischargeTrackerTab } from "./care-view/DischargeTrackerTab";
import { HandoverTab } from "./care-view/HandoverTab";
import { MyTasksTab } from "./care-view/MyTasksTab";
import { PatientGridTab } from "./care-view/PatientGridTab";

export function CareViewPage() {
  useRequirePermission(P.CARE_VIEW.VIEW);

  const canMyTasks = useHasPermission(P.CARE_VIEW.MY_TASKS);
  const canHandover = useHasPermission(P.CARE_VIEW.HANDOVER);
  const canDischarge = useHasPermission(P.CARE_VIEW.DISCHARGE_TRACKER);
  const canManage = useHasPermission(P.CARE_VIEW.MANAGE_TASKS);

  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("grid");

  const { data: wards } = useQuery({
    queryKey: ["wards"],
    queryFn: () => api.listWards(),
  });

  const wardOptions = [
    { value: "", label: "All Wards" },
    ...(wards?.map((ward) => ({ value: ward.id, label: ward.name })) ?? []),
  ];

  return (
    <div>
      <PageHeader
        title="Care View"
        subtitle="Ward dashboard for nursing care"
        actions={
          <Select
            placeholder="Filter by ward"
            data={wardOptions}
            value={selectedWard ?? ""}
            onChange={(value) => setSelectedWard(value || null)}
            clearable
            w={250}
          />
        }
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="grid" leftSection={<IconBed size={16} />}>
            Patient Grid
          </Tabs.Tab>
          {canMyTasks && (
            <Tabs.Tab value="tasks" leftSection={<IconClipboardList size={16} />}>
              My Tasks
            </Tabs.Tab>
          )}
          {canHandover && (
            <Tabs.Tab value="handover" leftSection={<IconUserHeart size={16} />}>
              Handover
            </Tabs.Tab>
          )}
          {canDischarge && (
            <Tabs.Tab value="discharge" leftSection={<IconLogout size={16} />}>
              Discharge Tracker
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="grid" pt="md">
          <PatientGridTab wardId={selectedWard} />
        </Tabs.Panel>

        {canMyTasks && (
          <Tabs.Panel value="tasks" pt="md">
            <MyTasksTab wardId={selectedWard} canManage={canManage} />
          </Tabs.Panel>
        )}

        {canHandover && (
          <Tabs.Panel value="handover" pt="md">
            <HandoverTab wardId={selectedWard} />
          </Tabs.Panel>
        )}

        {canDischarge && (
          <Tabs.Panel value="discharge" pt="md">
            <DischargeTrackerTab wardId={selectedWard} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}
