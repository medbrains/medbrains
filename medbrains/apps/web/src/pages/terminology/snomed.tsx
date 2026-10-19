/**
 * SNOMED CT: browse the loaded release (concepts, hierarchy, ECL) and count
 * the hospital's coded diagnoses by hierarchy.
 */
import { Stack, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconBinaryTree, IconChartBar } from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { SnomedLicenceNotice, useSnomedStatus } from "@/components/Clinical/SnomedLicenceNotice";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { SnomedAnalyticsTab } from "./SnomedAnalyticsTab";
import { SnomedBrowseTab } from "./SnomedBrowseTab";

export function SnomedPage() {
  useRequirePermission([P.TERMINOLOGY.SNOMED.VIEW, P.TERMINOLOGY.SNOMED.ANALYTICS]);
  const canBrowse = useHasPermission(P.TERMINOLOGY.SNOMED.VIEW);
  const canCount = useHasPermission(P.TERMINOLOGY.SNOMED.ANALYTICS);
  const status = useSnomedStatus();
  const loaded = status.data?.loaded === true;

  return (
    <Stack gap="md">
      <PageHeader
        title="SNOMED CT"
        subtitle="Browse the clinical terminology and count records by its hierarchy"
      />
      <SnomedLicenceNotice />
      {loaded && (
        <Tabs defaultValue={canBrowse ? "browse" : "analytics"}>
          <Tabs.List>
            {canBrowse && (
              <Tabs.Tab value="browse" leftSection={<IconBinaryTree size={16} />}>
                Browse
              </Tabs.Tab>
            )}
            {canCount && (
              <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
                Analytics
              </Tabs.Tab>
            )}
          </Tabs.List>
          {canBrowse && (
            <Tabs.Panel value="browse" pt="md">
              <SnomedBrowseTab />
            </Tabs.Panel>
          )}
          {canCount && (
            <Tabs.Panel value="analytics" pt="md">
              <SnomedAnalyticsTab />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </Stack>
  );
}
