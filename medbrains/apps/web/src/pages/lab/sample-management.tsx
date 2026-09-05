// Lab SampleManagementTab — split from lab.tsx (pure move).

import { Stack, Tabs } from "@mantine/core";
import { useState } from "react";
import { BenchWorklistSection } from "./bench-worklist";
import { CollectionCentersSection } from "./collection-centers";
import { HomeCollectionsSection } from "./home-collections";
import { SampleArchiveSection } from "./sample-archive";

export function SampleManagementTab() {
  // The bench worklist opens first: it is the one thing in here somebody is
  // waiting on.
  const [subTab, setSubTab] = useState("bench");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "bench")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="bench">Bench Worklist</Tabs.Tab>
          <Tabs.Tab value="home-collections">Home Collections</Tabs.Tab>
          <Tabs.Tab value="collection-centers">Collection Centers</Tabs.Tab>
          <Tabs.Tab value="sample-archive">Sample Archive</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="bench">
          <BenchWorklistSection />
        </Tabs.Panel>
        <Tabs.Panel value="home-collections">
          <HomeCollectionsSection />
        </Tabs.Panel>
        <Tabs.Panel value="collection-centers">
          <CollectionCentersSection />
        </Tabs.Panel>
        <Tabs.Panel value="sample-archive">
          <SampleArchiveSection />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
