import { Group, Tabs } from "@mantine/core";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconCheck,
  IconClipboardList,
  IconHeart,
  IconPackage,
  IconPill,
  IconPlus,
  IconRefresh,
  IconTruckDelivery,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClinicalEventProvider, PageHeader } from "@/components";
import { Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { indentService } from "@/services/indent.service";
import { AnalyticsPanel } from "./indent/analytics-panel";
import { AssetsImplantsPanel } from "./indent/assets-implants-panel";
import { CatalogPanel } from "./indent/catalog-panel";
import { CreateIndentPanel } from "./indent/create-indent-panel";
import { FlowTrackerPanel } from "./indent/flow-tracker-panel";
import { IndentListPanel } from "./indent/indent-list-panel";
import { PatientConsumablesPanel } from "./indent/patient-consumables-panel";
import { StockPanel } from "./indent/stock-panel";

// ── Status colors ─────────────────────────────────────────

// ── Status to stepper step mapping ────────────────────────

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function IndentPage() {
  useRequirePermission(P.INDENT.LIST);

  return (
    <ClinicalEventProvider moduleCode="indent" contextCode="indent-requisitions">
      <IndentPageInner />
    </ClinicalEventProvider>
  );
}

function IndentPageInner() {
  const canCreate = useHasPermission(P.INDENT.CREATE);
  const canApprove = useHasPermission(P.INDENT.APPROVE);
  const canStock = useHasPermission(P.INDENT.STOCK_MANAGE);
  const canAnalytics = useHasPermission(P.INDENT.ANALYTICS_VIEW);
  const canConsumables = useHasPermission(P.INDENT.CONSUMABLES_LIST);
  const canImplants = useHasPermission(P.INDENT.IMPLANTS_LIST);

  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<string | null>("my-indents");
  const headerQueryClient = useQueryClient();
  const reorderMutation = useMutation({
    mutationFn: () => indentService.createReorderIndent(),
    onSuccess: () => {
      void headerQueryClient.invalidateQueries({ queryKey: ["indent-requisitions"] });
      toast.success("Reorder indent generated from below-reorder stock", { title: "Reorder" });
      setActiveTab("my-indents");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Nothing to reorder" }),
  });

  return (
    <div>
      <PageHeader
        title="Indent & Store"
        subtitle="Requisitions, approvals, and store management"
        icon={<IconClipboardList size={20} stroke={1.5} />}
        color="info"
        actions={
          canCreate ? (
            <Group gap="xs">
              {canStock && (
                <Button
                  tone="secondary"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => reorderMutation.mutate()}
                  loading={reorderMutation.isPending}
                >
                  Generate reorder indent
                </Button>
              )}
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                onClick={() => setActiveTab("create")}
              >
                New Indent
              </Button>
            </Group>
          ) : undefined
        }
      />

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="my-indents" leftSection={<IconClipboardList size={16} />}>
            My Indents
          </Tabs.Tab>
          {canApprove && (
            <Tabs.Tab value="pending-approval" leftSection={<IconCheck size={16} />}>
              Pending Approval
            </Tabs.Tab>
          )}
          <Tabs.Tab value="all-indents" leftSection={<IconClipboardList size={16} />}>
            All Indents
          </Tabs.Tab>
          <Tabs.Tab value="flow-tracker" leftSection={<IconTruckDelivery size={16} />}>
            Flow Tracker
          </Tabs.Tab>
          {canStock && (
            <>
              <Tabs.Tab value="catalog" leftSection={<IconPackage size={16} />}>
                Store Catalog
              </Tabs.Tab>
              <Tabs.Tab value="stock" leftSection={<IconTruckDelivery size={16} />}>
                Stock
              </Tabs.Tab>
            </>
          )}
          {canAnalytics && (
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          )}
          {canConsumables && (
            <Tabs.Tab value="patient-consumables" leftSection={<IconPill size={16} />}>
              Patient Consumables
            </Tabs.Tab>
          )}
          {canImplants && (
            <Tabs.Tab value="assets-implants" leftSection={<IconHeart size={16} />}>
              Assets &amp; Implants
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="my-indents">
          <IndentListPanel requestedBy={user?.id} />
        </Tabs.Panel>

        {canApprove && (
          <Tabs.Panel value="pending-approval">
            <IndentListPanel status="submitted" />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="all-indents">
          <IndentListPanel />
        </Tabs.Panel>

        <Tabs.Panel value="flow-tracker">
          <FlowTrackerPanel />
        </Tabs.Panel>

        {canStock && (
          <>
            <Tabs.Panel value="catalog">
              <CatalogPanel />
            </Tabs.Panel>
            <Tabs.Panel value="stock">
              <StockPanel />
            </Tabs.Panel>
          </>
        )}

        {canAnalytics && (
          <Tabs.Panel value="analytics">
            <AnalyticsPanel />
          </Tabs.Panel>
        )}
        {canConsumables && (
          <Tabs.Panel value="patient-consumables">
            <PatientConsumablesPanel />
          </Tabs.Panel>
        )}
        {canImplants && (
          <Tabs.Panel value="assets-implants">
            <AssetsImplantsPanel />
          </Tabs.Panel>
        )}

        {activeTab === "create" && canCreate && (
          <CreateIndentPanel onDone={() => setActiveTab("my-indents")} />
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Indent List Panel
// ══════════════════════════════════════════════════════════

// ── Approve Button with quantity editing ──────────────────

// ── Issue Button ──────────────────────────────────────────

// ══════════════════════════════════════════════════════════
//  Flow Tracker Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Create Indent Panel
// ══════════════════════════════════════════════════════════
