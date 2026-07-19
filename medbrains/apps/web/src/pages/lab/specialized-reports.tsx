// Lab SpecializedReportsTab — split from lab.tsx (pure move).

import { Stack, Tabs } from "@mantine/core";
import { useState } from "react";
import { CytologySection } from "./cytology";
import { HistopathSection } from "./histopath";
import { MolecularSection } from "./molecular";

export function SpecializedReportsTab() {
  const [subTab, setSubTab] = useState("histopath");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "histopath")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="histopath">Histopathology</Tabs.Tab>
          <Tabs.Tab value="cytology">Cytology</Tabs.Tab>
          <Tabs.Tab value="molecular">Molecular / PCR</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="histopath">
          <HistopathSection />
        </Tabs.Panel>
        <Tabs.Panel value="cytology">
          <CytologySection />
        </Tabs.Panel>
        <Tabs.Panel value="molecular">
          <MolecularSection />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
