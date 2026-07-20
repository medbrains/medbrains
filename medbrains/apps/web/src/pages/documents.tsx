import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconCalendarEvent,
  IconFileDescription,
  IconFileText,
  IconPrinter,
  IconRoute,
  IconSettings,
} from "@tabler/icons-react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { OutputsTab } from "./documents/outputs-tab";
import { PrintQueueTab } from "./documents/print-queue-tab";
import { PrintRoutingTab } from "./documents/print-routing-tab";
import { PrintersTab } from "./documents/printers-tab";
import { ReviewScheduleTab } from "./documents/review-schedule-tab";
import { TemplatesTab } from "./documents/templates-tab";

// ── Constants ────────────────────────────────────────────

// ── Templates Tab ────────────────────────────────────────

export function DocumentsPage() {
  useRequirePermission([P.DOCUMENTS.TEMPLATES_LIST, P.DOCUMENTS.PRINTERS_LIST]);
  const canViewDocuments = useHasPermission(P.DOCUMENTS.TEMPLATES_LIST);
  const canViewPrinters = useHasPermission(P.DOCUMENTS.PRINTERS_LIST);
  const defaultTab = canViewDocuments ? "templates" : "queue";

  return (
    <div>
      <PageHeader
        title="Documents & Printing"
        subtitle="Manage templates, generated outputs, print queues, and copy/printer routing"
      />
      <Tabs defaultValue={defaultTab}>
        <Tabs.List>
          {canViewDocuments && (
            <Tabs.Tab value="templates" leftSection={<IconFileText size={16} />}>
              Templates
            </Tabs.Tab>
          )}
          {canViewDocuments && (
            <Tabs.Tab value="outputs" leftSection={<IconFileDescription size={16} />}>
              Generated Documents
            </Tabs.Tab>
          )}
          {canViewDocuments && (
            <Tabs.Tab value="review" leftSection={<IconCalendarEvent size={16} />}>
              Review Schedule
            </Tabs.Tab>
          )}
          {canViewPrinters && (
            <Tabs.Tab value="queue" leftSection={<IconPrinter size={16} />}>
              Print Queue
            </Tabs.Tab>
          )}
          {canViewPrinters && (
            <Tabs.Tab value="routes" leftSection={<IconRoute size={16} />}>
              Print Routes
            </Tabs.Tab>
          )}
          {canViewPrinters && (
            <Tabs.Tab value="printers" leftSection={<IconSettings size={16} />}>
              Printers
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canViewDocuments && (
          <Tabs.Panel value="templates" pt="md">
            <TemplatesTab />
          </Tabs.Panel>
        )}
        {canViewDocuments && (
          <Tabs.Panel value="outputs" pt="md">
            <OutputsTab />
          </Tabs.Panel>
        )}
        {canViewDocuments && (
          <Tabs.Panel value="review" pt="md">
            <ReviewScheduleTab />
          </Tabs.Panel>
        )}
        {canViewPrinters && (
          <Tabs.Panel value="queue" pt="md">
            <PrintQueueTab />
          </Tabs.Panel>
        )}
        {canViewPrinters && (
          <Tabs.Panel value="routes" pt="md">
            <PrintRoutingTab />
          </Tabs.Panel>
        )}
        {canViewPrinters && (
          <Tabs.Panel value="printers" pt="md">
            <PrintersTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}
