// Lab SampleManagementTab — split from lab.tsx (pure move).

import { Stack, Tabs } from "@mantine/core";
import { useState } from "react";
import { CollectionCentersSection } from "./collection-centers";
import { HomeCollectionsSection } from "./home-collections";
import { SampleArchiveSection } from "./sample-archive";

export function SampleManagementTab() {
  const [subTab, setSubTab] = useState("home-collections");
  return (
    <Stack>
      <Tabs value={subTab} onChange={(v) => setSubTab(v ?? "home-collections")}>
        <Tabs.List mb="sm">
          <Tabs.Tab value="home-collections">Home Collections</Tabs.Tab>
          <Tabs.Tab value="collection-centers">Collection Centers</Tabs.Tab>
          <Tabs.Tab value="sample-archive">Sample Archive</Tabs.Tab>
        </Tabs.List>
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
