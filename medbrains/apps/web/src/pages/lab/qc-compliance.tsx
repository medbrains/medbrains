// Lab QcComplianceTab — split from lab.tsx (pure move).

import { Stack, Tabs } from "@mantine/core";
import { IconClock } from "@tabler/icons-react";
import { useState } from "react";
import { CalibrationsSection } from "./calibrations";
import { EqasSection } from "./eqas";
import { NablDocumentsSection } from "./nabl-documents";
import { ProficiencyTestingSection } from "./proficiency-testing";
import { QcResultsSection } from "./qc-results";
import { ReagentConsumptionSection } from "./reagent-consumption";
import { ReagentLotsSection } from "./reagent-lots";
import { TatAnalyticsSection } from "./tat-analytics";

export function QcComplianceTab() {
  const [subTab, setSubTab] = useState("reagent-lots");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "reagent-lots")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="reagent-lots">Reagent Lots</Tabs.Tab>
          <Tabs.Tab value="qc-results">QC Results</Tabs.Tab>
          <Tabs.Tab value="calibrations">Calibrations</Tabs.Tab>
          <Tabs.Tab value="eqas">EQAS</Tabs.Tab>
          <Tabs.Tab value="proficiency">Proficiency Testing</Tabs.Tab>
          <Tabs.Tab value="nabl">NABL Documents</Tabs.Tab>
          <Tabs.Tab value="consumption">Reagent Consumption</Tabs.Tab>
          <Tabs.Tab value="tat-analytics" leftSection={<IconClock size={14} />}>
            TAT Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="reagent-lots">
          <ReagentLotsSection />
        </Tabs.Panel>
        <Tabs.Panel value="qc-results">
          <QcResultsSection />
        </Tabs.Panel>
        <Tabs.Panel value="calibrations">
          <CalibrationsSection />
        </Tabs.Panel>
        <Tabs.Panel value="eqas">
          <EqasSection />
        </Tabs.Panel>
        <Tabs.Panel value="proficiency">
          <ProficiencyTestingSection />
        </Tabs.Panel>
        <Tabs.Panel value="nabl">
          <NablDocumentsSection />
        </Tabs.Panel>
        <Tabs.Panel value="consumption">
          <ReagentConsumptionSection />
        </Tabs.Panel>
        <Tabs.Panel value="tat-analytics">
          <TatAnalyticsSection />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
