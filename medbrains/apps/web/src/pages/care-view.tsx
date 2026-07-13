import { Select, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { WardListRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconActivityHeartbeat,
  IconBabyBottle,
  IconBabyCarriage,
  IconBed,
  IconBottle,
  IconBrain,
  IconCandy,
  IconClipboardList,
  IconDroplet,
  IconDropletFilled,
  IconDroplets,
  IconFlask,
  IconHeartbeat,
  IconHeartRateMonitor,
  IconLogout,
  IconLungs,
  IconLungsFilled,
  IconMoodConfuzed,
  IconMoodSad,
  IconPill,
  IconSalad,
  IconUserHeart,
  IconVirus,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { careViewService } from "@/services/careView.service";
import { AldreteTab } from "./care-view/AldreteTab";
import { CamIcuTab } from "./care-view/CamIcuTab";
import { Cha2ds2VascTab } from "./care-view/Cha2ds2VascTab";
import { ChildPughTab } from "./care-view/ChildPughTab";
import { CiwaArTab } from "./care-view/CiwaArTab";
import { CpotTab } from "./care-view/CpotTab";
import { DischargeTrackerTab } from "./care-view/DischargeTrackerTab";
import { GcsTab } from "./care-view/GcsTab";
import { HandoverTab } from "./care-view/HandoverTab";
import { HasBledTab } from "./care-view/HasBledTab";
import { HypoglycemiaTab } from "./care-view/HypoglycemiaTab";
import { MedReconciliationTab } from "./care-view/MedReconciliationTab";
import { MeowsTab } from "./care-view/MeowsTab";
import { MyTasksTab } from "./care-view/MyTasksTab";
import { News2Tab } from "./care-view/News2Tab";
import { NutritionTab } from "./care-view/NutritionTab";
import { PaediatricFluidTab } from "./care-view/PaediatricFluidTab";
import { PatientGridTab } from "./care-view/PatientGridTab";
import { PewsTab } from "./care-view/PewsTab";
import { SepsisBundleTab } from "./care-view/SepsisBundleTab";
import { SepsisTab } from "./care-view/SepsisTab";
import { VteTab } from "./care-view/VteTab";
import { WellsPeTab } from "./care-view/WellsPeTab";

export function CareViewPage() {
  useRequirePermission(P.CARE_VIEW.VIEW);

  const canMyTasks = useHasPermission(P.CARE_VIEW.MY_TASKS);
  const canHandover = useHasPermission(P.CARE_VIEW.HANDOVER);
  const canDischarge = useHasPermission(P.CARE_VIEW.DISCHARGE_TRACKER);
  const canManage = useHasPermission(P.CARE_VIEW.MANAGE_TASKS);

  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("grid");

  const { data: wards } = useQuery<WardListRow[]>({
    queryKey: ["wards"],
    queryFn: () => careViewService.listWards(),
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
          <Tabs.Tab value="vte" leftSection={<IconHeartbeat size={16} />}>
            VTE Risk
          </Tabs.Tab>
          <Tabs.Tab value="news2" leftSection={<IconActivityHeartbeat size={16} />}>
            NEWS2
          </Tabs.Tab>
          <Tabs.Tab value="sepsis" leftSection={<IconVirus size={16} />}>
            Sepsis (qSOFA)
          </Tabs.Tab>
          <Tabs.Tab value="sepsis-bundle" leftSection={<IconDroplet size={16} />}>
            Sepsis Bundle
          </Tabs.Tab>
          <Tabs.Tab value="med-recon" leftSection={<IconPill size={16} />}>
            Med Reconciliation
          </Tabs.Tab>
          <Tabs.Tab value="aldrete" leftSection={<IconLungs size={16} />}>
            Aldrete (PACU)
          </Tabs.Tab>
          <Tabs.Tab value="meows" leftSection={<IconBabyCarriage size={16} />}>
            MEOWS
          </Tabs.Tab>
          <Tabs.Tab value="pews" leftSection={<IconBabyBottle size={16} />}>
            PEWS
          </Tabs.Tab>
          <Tabs.Tab value="nutrition" leftSection={<IconSalad size={16} />}>
            Nutrition (MUST)
          </Tabs.Tab>
          <Tabs.Tab value="hypoglycemia" leftSection={<IconCandy size={16} />}>
            Hypoglycaemia
          </Tabs.Tab>
          <Tabs.Tab value="gcs" leftSection={<IconBrain size={16} />}>
            GCS
          </Tabs.Tab>
          <Tabs.Tab value="cam-icu" leftSection={<IconMoodConfuzed size={16} />}>
            CAM-ICU
          </Tabs.Tab>
          <Tabs.Tab value="cpot" leftSection={<IconMoodSad size={16} />}>
            CPOT Pain
          </Tabs.Tab>
          <Tabs.Tab value="wells-pe" leftSection={<IconLungsFilled size={16} />}>
            Wells PE
          </Tabs.Tab>
          <Tabs.Tab value="cha2ds2-vasc" leftSection={<IconHeartRateMonitor size={16} />}>
            CHA₂DS₂-VASc
          </Tabs.Tab>
          <Tabs.Tab value="has-bled" leftSection={<IconDroplets size={16} />}>
            HAS-BLED
          </Tabs.Tab>
          <Tabs.Tab value="ciwa-ar" leftSection={<IconBottle size={16} />}>
            CIWA-Ar
          </Tabs.Tab>
          <Tabs.Tab value="child-pugh" leftSection={<IconFlask size={16} />}>
            Child-Pugh
          </Tabs.Tab>
          <Tabs.Tab value="paeds-fluid" leftSection={<IconDropletFilled size={16} />}>
            Paeds Fluid
          </Tabs.Tab>
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

        <Tabs.Panel value="vte" pt="md">
          <VteTab />
        </Tabs.Panel>

        <Tabs.Panel value="news2" pt="md">
          <News2Tab />
        </Tabs.Panel>

        <Tabs.Panel value="sepsis" pt="md">
          <SepsisTab />
        </Tabs.Panel>

        <Tabs.Panel value="sepsis-bundle" pt="md">
          <SepsisBundleTab />
        </Tabs.Panel>

        <Tabs.Panel value="med-recon" pt="md">
          <MedReconciliationTab />
        </Tabs.Panel>

        <Tabs.Panel value="aldrete" pt="md">
          <AldreteTab />
        </Tabs.Panel>

        <Tabs.Panel value="meows" pt="md">
          <MeowsTab />
        </Tabs.Panel>

        <Tabs.Panel value="pews" pt="md">
          <PewsTab />
        </Tabs.Panel>

        <Tabs.Panel value="nutrition" pt="md">
          <NutritionTab />
        </Tabs.Panel>

        <Tabs.Panel value="hypoglycemia" pt="md">
          <HypoglycemiaTab />
        </Tabs.Panel>

        <Tabs.Panel value="gcs" pt="md">
          <GcsTab />
        </Tabs.Panel>

        <Tabs.Panel value="cam-icu" pt="md">
          <CamIcuTab />
        </Tabs.Panel>

        <Tabs.Panel value="cpot" pt="md">
          <CpotTab />
        </Tabs.Panel>

        <Tabs.Panel value="wells-pe" pt="md">
          <WellsPeTab />
        </Tabs.Panel>

        <Tabs.Panel value="cha2ds2-vasc" pt="md">
          <Cha2ds2VascTab />
        </Tabs.Panel>

        <Tabs.Panel value="has-bled" pt="md">
          <HasBledTab />
        </Tabs.Panel>

        <Tabs.Panel value="ciwa-ar" pt="md">
          <CiwaArTab />
        </Tabs.Panel>

        <Tabs.Panel value="child-pugh" pt="md">
          <ChildPughTab />
        </Tabs.Panel>

        <Tabs.Panel value="paeds-fluid" pt="md">
          <PaediatricFluidTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
