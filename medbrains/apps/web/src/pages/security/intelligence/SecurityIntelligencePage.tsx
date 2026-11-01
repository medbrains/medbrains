import { Box, Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import { IconShieldCheck } from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { InternalTab } from "./internal-tab";

/** Security → Intelligence (RFC-OSINT §5). The External tab arrives with phase 3. */
export function SecurityIntelligencePage() {
  useRequirePermission(P.SECURITY.INTEL_VIEW);
  return (
    <Box>
      <PageHeader
        title="Security intelligence"
        subtitle="Continuous checks that assume something is wrong and keep proving otherwise"
      />
      <Tabs defaultValue="internal">
        <Tabs.List>
          <Tabs.Tab value="internal" leftSection={<IconShieldCheck size={16} aria-hidden="true" />}>
            Internal
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="internal" pt="md">
          <InternalTab />
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
