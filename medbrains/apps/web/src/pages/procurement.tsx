import { Tabs } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconBuildingWarehouse,
  IconCash,
  IconChartBar,
  IconContract,
  IconFileInvoice,
  IconPackage,
  IconReceipt,
  IconTruck,
  IconUsers,
} from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { PageHeader } from "@/components";
import { ConsignmentPanel } from "@/components/Procurement/ConsignmentPanel";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { BatchStockPanel } from "./procurement/batch-stock-panel";
import { GrnPanel } from "./procurement/grn-panel";
import { PurchaseOrderPanel } from "./procurement/purchase-order-panel";
import { RateContractPanel } from "./procurement/rate-contract-panel";
import { StoreLocationPanel } from "./procurement/store-location-panel";
import { SupplierPaymentsPanel } from "./procurement/supplier-payments-panel";
import { VendorPanel } from "./procurement/vendor-panel";
import { VendorPerformancePanel } from "./procurement/vendor-performance-panel";

// ── Status colors ────────────────────────────────────────────

const PROCUREMENT_PAGE_PERMISSIONS: readonly string[] = [
  P.PROCUREMENT.VENDORS_LIST,
  P.PROCUREMENT.PO_LIST,
  P.PROCUREMENT.GRN_LIST,
  P.PROCUREMENT.RC_LIST,
  P.PROCUREMENT.STORES_LIST,
  P.PROCUREMENT.STORES_MANAGE,
  P.PROCUREMENT.PAYMENTS_LIST,
  P.PROCUREMENT.PERFORMANCE_VIEW,
  P.INDENT.STOCK_MANAGE,
];

interface ProcurementTabConfig {
  value: string;
  label: string;
  icon: ReactNode;
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function ProcurementPage() {
  useRequirePermission(PROCUREMENT_PAGE_PERMISSIONS);

  const canViewVendors = useHasPermission(P.PROCUREMENT.VENDORS_LIST);
  const canViewPo = useHasPermission(P.PROCUREMENT.PO_LIST);
  const canViewGrn = useHasPermission(P.PROCUREMENT.GRN_LIST);
  const canViewRc = useHasPermission(P.PROCUREMENT.RC_LIST);
  const canViewBatchStock = useHasPermission(P.INDENT.STOCK_MANAGE);
  const canViewStores = useHasAnyPermission([
    P.PROCUREMENT.STORES_LIST,
    P.PROCUREMENT.STORES_MANAGE,
  ]);
  const canCreateVendorPermission = useHasPermission(P.PROCUREMENT.VENDORS_CREATE);
  const canCreatePoPermission = useHasPermission(P.PROCUREMENT.PO_CREATE);
  const canCreateGrnPermission = useHasPermission(P.PROCUREMENT.GRN_CREATE);
  const canManageRcPermission = useHasPermission(P.PROCUREMENT.RC_MANAGE);
  const canManageStores = useHasPermission(P.PROCUREMENT.STORES_MANAGE);
  const canViewPerformancePermission = useHasPermission(P.PROCUREMENT.PERFORMANCE_VIEW);
  const canViewPayments = useHasPermission(P.PROCUREMENT.PAYMENTS_LIST);
  const canManagePaymentsPermission = useHasPermission(P.PROCUREMENT.PAYMENTS_MANAGE);
  const canCreateVendor = canViewVendors && canCreateVendorPermission;
  const canCreatePo = canViewVendors && canViewPo && canCreatePoPermission;
  const canCreateGrn = canViewPo && canCreateGrnPermission;
  const canManageRc = canViewVendors && canManageRcPermission;
  const canViewPerformance = canViewVendors && canViewPerformancePermission;
  const canManagePayments = canViewVendors && canManagePaymentsPermission;

  const visibleTabs: ProcurementTabConfig[] = [];
  if (canViewVendors) {
    visibleTabs.push({
      value: "vendors",
      label: "Vendors",
      icon: <IconUsers size={16} />,
    });
  }
  if (canViewPo) {
    visibleTabs.push({
      value: "purchase-orders",
      label: "Purchase Orders",
      icon: <IconFileInvoice size={16} />,
    });
  }
  if (canViewGrn) {
    visibleTabs.push({
      value: "grn",
      label: "GRN",
      icon: <IconPackage size={16} />,
    });
  }
  if (canViewRc) {
    visibleTabs.push({
      value: "rate-contracts",
      label: "Rate Contracts",
      icon: <IconContract size={16} />,
    });
  }
  if (canViewBatchStock) {
    visibleTabs.push({
      value: "batch-stock",
      label: "Batch Stock",
      icon: <IconBuildingWarehouse size={16} />,
    });
  }
  if (canViewBatchStock) {
    visibleTabs.push({
      value: "consignment",
      label: "Consignment",
      icon: <IconReceipt size={16} />,
    });
  }
  if (canViewStores) {
    visibleTabs.push({
      value: "store-locations",
      label: "Store Locations",
      icon: <IconBuildingWarehouse size={16} />,
    });
  }
  if (canViewPerformance) {
    visibleTabs.push({
      value: "vendor-performance",
      label: "Vendor Performance",
      icon: <IconChartBar size={16} />,
    });
  }
  if (canViewPayments) {
    visibleTabs.push({
      value: "supplier-payments",
      label: "Supplier Payments",
      icon: <IconCash size={16} />,
    });
  }

  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const activeTab = visibleTabs.some((tab) => tab.value === selectedTab)
    ? selectedTab
    : (visibleTabs[0]?.value ?? null);

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle="Vendors, purchase orders, GRN, rate contracts, and batch stock"
        icon={<IconTruck size={20} stroke={1.5} />}
        color="violet"
      />

      <Tabs value={activeTab} onChange={setSelectedTab}>
        <Tabs.List mb="md">
          {visibleTabs.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {canViewVendors && (
          <Tabs.Panel value="vendors">
            <VendorPanel canCreate={canCreateVendor} />
          </Tabs.Panel>
        )}
        {canViewPo && (
          <Tabs.Panel value="purchase-orders">
            <PurchaseOrderPanel canCreate={canCreatePo} />
          </Tabs.Panel>
        )}
        {canViewGrn && (
          <Tabs.Panel value="grn">
            <GrnPanel canCreate={canCreateGrn} />
          </Tabs.Panel>
        )}
        {canViewRc && (
          <Tabs.Panel value="rate-contracts">
            <RateContractPanel canManage={canManageRc} />
          </Tabs.Panel>
        )}
        {canViewBatchStock && (
          <Tabs.Panel value="batch-stock">
            <BatchStockPanel />
          </Tabs.Panel>
        )}
        {canViewBatchStock && (
          <Tabs.Panel value="consignment">
            <ConsignmentPanel />
          </Tabs.Panel>
        )}
        {canViewStores && (
          <Tabs.Panel value="store-locations">
            <StoreLocationPanel canManage={canManageStores} />
          </Tabs.Panel>
        )}
        {canViewPerformance && (
          <Tabs.Panel value="vendor-performance">
            <VendorPerformancePanel />
          </Tabs.Panel>
        )}
        {canViewPayments && (
          <Tabs.Panel value="supplier-payments">
            <SupplierPaymentsPanel canManage={canManagePayments} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Vendors Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Purchase Orders Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  GRN Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Rate Contracts Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Batch Stock Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Vendor Performance Panel
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
//  Supplier Payments Panel
// ══════════════════════════════════════════════════════════
