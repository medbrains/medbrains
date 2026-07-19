import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { ColdChainTab } from "./blood-bank/cold-chain-tab";
import { ComplianceTab } from "./blood-bank/compliance-tab";
import { CrossmatchTab } from "./blood-bank/crossmatch-tab";
import { DonorsTab } from "./blood-bank/donors-tab";
import { InventoryTab } from "./blood-bank/inventory-tab";
import { ReportsTab } from "./blood-bank/reports-tab";
import { ReturnsAndMsbosTab } from "./blood-bank/returns-msbos-tab";
import { TransfusionsTab } from "./blood-bank/transfusions-tab";

// Dropdown options for categorical fields
// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function BloodBankPage() {
  useRequirePermission(P.BLOOD_BANK.DONORS_LIST);

  return (
    <div>
      <PageHeader title="Blood Bank" subtitle="Donor management, inventory & transfusion" />
      <Tabs defaultValue="donors">
        <Tabs.List>
          <Tabs.Tab value="donors">Donors</Tabs.Tab>
          <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
          <Tabs.Tab value="crossmatch">Crossmatch</Tabs.Tab>
          <Tabs.Tab value="transfusions">Transfusions</Tabs.Tab>
          <Tabs.Tab value="reports">Reports</Tabs.Tab>
          <Tabs.Tab value="returns">Returns & MSBOS</Tabs.Tab>
          <Tabs.Tab value="coldchain">Cold Chain</Tabs.Tab>
          <Tabs.Tab value="compliance">Compliance</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="donors">
          <DonorsTab />
        </Tabs.Panel>
        <Tabs.Panel value="inventory">
          <InventoryTab />
        </Tabs.Panel>
        <Tabs.Panel value="crossmatch">
          <CrossmatchTab />
        </Tabs.Panel>
        <Tabs.Panel value="transfusions">
          <TransfusionsTab />
        </Tabs.Panel>
        <Tabs.Panel value="reports">
          <ReportsTab />
        </Tabs.Panel>
        <Tabs.Panel value="returns">
          <ReturnsAndMsbosTab />
        </Tabs.Panel>
        <Tabs.Panel value="coldchain">
          <ColdChainTab />
        </Tabs.Panel>
        <Tabs.Panel value="compliance">
          <ComplianceTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Donors Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Inventory Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Crossmatch Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Transfusions Tab
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Reports Tab (TTI + Hemovigilance)
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Returns & MSBOS Tab
// ══════════════════════════════════════════════════════════
