import { LosMonitoringTab } from "./utilization-review/los-monitoring-tab";
import { PayerLogTab } from "./utilization-review/payer-log-tab";
import { ReviewsTab } from "./utilization-review/reviews-tab";
import { StatusTrackingTab } from "./utilization-review/status-tracking-tab";
import "@mantine/charts/styles.css";
import { Tabs } from "@mantine/core";
import { P } from "@medbrains/types";
import {
  IconAlertCircle,
  IconArrowsExchange,
  IconClipboardCheck,
  IconMessageCircle,
} from "@tabler/icons-react";
import { useRequirePermission } from "@/hooks/useRequirePermission";

export function UtilizationReviewPage() {
  useRequirePermission(P.UR.REVIEWS_LIST);

  return (
    <Tabs defaultValue="reviews">
      <Tabs.List>
        <Tabs.Tab value="reviews" leftSection={<IconClipboardCheck size={16} />}>
          Reviews
        </Tabs.Tab>
        <Tabs.Tab value="los" leftSection={<IconAlertCircle size={16} />}>
          LOS Monitoring
        </Tabs.Tab>
        <Tabs.Tab value="payer" leftSection={<IconMessageCircle size={16} />}>
          Payer Log
        </Tabs.Tab>
        <Tabs.Tab value="status" leftSection={<IconArrowsExchange size={16} />}>
          Status Tracking
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="reviews" pt="md">
        <ReviewsTab />
      </Tabs.Panel>
      <Tabs.Panel value="los" pt="md">
        <LosMonitoringTab />
      </Tabs.Panel>
      <Tabs.Panel value="payer" pt="md">
        <PayerLogTab />
      </Tabs.Panel>
      <Tabs.Panel value="status" pt="md">
        <StatusTrackingTab />
      </Tabs.Panel>
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 1 — Reviews
// ═══════════════════════════════════════════════════════
