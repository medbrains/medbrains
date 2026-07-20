import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import { IconFlame, IconPackage, IconSettings, IconTruckDelivery } from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { EquipmentTab } from "./cssd/equipment-tab";
import { InstrumentsTab } from "./cssd/instruments-tab";
import { IssuanceTab } from "./cssd/issuance-tab";
import { SterilizationTab } from "./cssd/sterilization-tab";

export function CssdPage() {
  useRequirePermission(P.CSSD.INSTRUMENTS_LIST);

  return (
    <div>
      <PageHeader
        title="CSSD"
        subtitle="Central Sterile Supply Department — instruments, sterilization, issuance, equipment"
      />

      <Tabs defaultValue="instruments" mt="md">
        <Tabs.List>
          <Tabs.Tab value="instruments" leftSection={<IconPackage size={16} />}>
            Instruments
          </Tabs.Tab>
          <Tabs.Tab value="sterilization" leftSection={<IconFlame size={16} />}>
            Sterilization
          </Tabs.Tab>
          <Tabs.Tab value="issuance" leftSection={<IconTruckDelivery size={16} />}>
            Issuance
          </Tabs.Tab>
          <Tabs.Tab value="equipment" leftSection={<IconSettings size={16} />}>
            Equipment
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="instruments" pt="md">
          <InstrumentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="sterilization" pt="md">
          <SterilizationTab />
        </Tabs.Panel>
        <Tabs.Panel value="issuance" pt="md">
          <IssuanceTab />
        </Tabs.Panel>
        <Tabs.Panel value="equipment" pt="md">
          <EquipmentTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
