import { Tabs } from "@mantine/core";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useState } from "react";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { CashDrawerTab } from "./pharmacy-finance/cash-drawer-tab";
import { FreeDispensingTab } from "./pharmacy-finance/free-dispensing-tab";
import { MarginsTab } from "./pharmacy-finance/margins-tab";
import { PettyCashTab } from "./pharmacy-finance/petty-cash-tab";
import { SupplierPaymentsTab } from "./pharmacy-finance/supplier-payments-tab";

const PHARMACY_FINANCE_PAGE_PERMISSIONS = [
  P.PHARMACY_FINANCE.CASH_DRAWER_VIEW,
  P.PHARMACY_FINANCE.CASH_DRAWER_OPEN,
  P.PHARMACY_FINANCE.CASH_DRAWER_CLOSE,
  P.PHARMACY_FINANCE.PETTY_CASH_VIEW,
  P.PHARMACY_FINANCE.FREE_DISPENSING_VIEW,
  P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_VIEW,
  P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_MANAGE,
  P.PHARMACY_FINANCE.FINANCE_REPORTS_VIEW,
] as const;

export function PharmacyFinancePage() {
  useRequirePermission(PHARMACY_FINANCE_PAGE_PERMISSIONS);
  const amountAccess = useFieldAccess("billing.amount");
  const canViewCashDrawer = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_VIEW);
  const canOpenCashDrawer = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_OPEN);
  const canCloseCashDrawer = useHasPermission(P.PHARMACY_FINANCE.CASH_DRAWER_CLOSE);
  const canViewPettyCash = useHasPermission(P.PHARMACY_FINANCE.PETTY_CASH_VIEW);
  const canRecordPettyCash = useHasPermission(P.PHARMACY_FINANCE.PETTY_CASH_RECORD);
  const canViewFreeDispensing = useHasPermission(P.PHARMACY_FINANCE.FREE_DISPENSING_VIEW);
  const canViewSupplierPayments = useHasPermission(P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_VIEW);
  const canManageSupplierPayments = useHasPermission(P.PHARMACY_FINANCE.SUPPLIER_PAYMENTS_MANAGE);
  const canViewFinanceReports = useHasPermission(P.PHARMACY_FINANCE.FINANCE_REPORTS_VIEW);
  const [tab, setTab] = useState<string>("cash-drawer");
  const visibleTabs = [
    {
      value: "cash-drawer",
      label: "Cash Drawer",
      visible: canViewCashDrawer || canOpenCashDrawer || canCloseCashDrawer,
    },
    { value: "petty-cash", label: "Petty Cash", visible: canViewPettyCash },
    {
      value: "supplier-payments",
      label: "Supplier Payments",
      visible: canViewSupplierPayments || canManageSupplierPayments,
    },
    {
      value: "free-dispensing",
      label: "Free Dispensing",
      visible: canViewFreeDispensing,
    },
    { value: "margins", label: "Margins", visible: canViewFinanceReports },
  ].filter((item) => item.visible);
  const activeTab = visibleTabs.some((item) => item.value === tab)
    ? tab
    : (visibleTabs[0]?.value ?? "cash-drawer");

  return (
    <div>
      <PageHeader
        title="Pharmacy Finance"
        subtitle="Day-end close, petty cash, free dispensings, supplier payments"
      />
      <Tabs
        value={activeTab}
        onChange={(value) => {
          if (value && visibleTabs.some((item) => item.value === value)) {
            setTab(value);
          }
        }}
        variant="outline"
      >
        <Tabs.List>
          {visibleTabs.map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {(canViewCashDrawer || canOpenCashDrawer || canCloseCashDrawer) && (
          <Tabs.Panel value="cash-drawer" pt="md">
            <CashDrawerTab
              canView={canViewCashDrawer}
              canOpen={canOpenCashDrawer}
              canClose={canCloseCashDrawer}
              amountAccess={amountAccess}
            />
          </Tabs.Panel>
        )}
        {canViewPettyCash && (
          <Tabs.Panel value="petty-cash" pt="md">
            <PettyCashTab canRecord={canRecordPettyCash} amountAccess={amountAccess} />
          </Tabs.Panel>
        )}
        {(canViewSupplierPayments || canManageSupplierPayments) && (
          <Tabs.Panel value="supplier-payments" pt="md">
            <SupplierPaymentsTab
              canView={canViewSupplierPayments}
              canManage={canManageSupplierPayments}
              amountAccess={amountAccess}
            />
          </Tabs.Panel>
        )}
        {canViewFreeDispensing && (
          <Tabs.Panel value="free-dispensing" pt="md">
            <FreeDispensingTab amountAccess={amountAccess} />
          </Tabs.Panel>
        )}
        {canViewFinanceReports && (
          <Tabs.Panel value="margins" pt="md">
            <MarginsTab amountAccess={amountAccess} />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}
