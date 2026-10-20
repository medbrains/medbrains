import { Stack, Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconCalendarDollar,
  IconChecklist,
  IconFileInvoice,
  IconListDetails,
  IconReportAnalytics,
  IconScale,
  IconSend,
  IconShieldCheck,
  IconTable,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/PageHeader";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AgreementsTab } from "./agreements-tab";
import { ApprovalsTab } from "./approvals-tab";
import { DaySettlementTab } from "./day-settlement-tab";
import { LedgerTab } from "./ledger-tab";
import { PayoutRunTab } from "./payout-run-tab";
import { PolicyTab } from "./policy-tab";
import { RateCardsTab } from "./rate-cards-tab";
import { ReportsTab } from "./reports-tab";
import { StatementsTab } from "./statements-tab";

const D = P.DOCTOR_PAYOUTS;

/** Every permission that opens a tab on this page. */
const PAGE_PERMISSIONS = [
  D.AGREEMENTS.MANAGE,
  D.RATE_CARDS.MANAGE,
  D.LEDGER.VIEW,
  D.STATEMENTS.PREPARE,
  D.STATEMENTS.APPROVE,
  D.PAYOUTS.EXECUTE,
  D.DAY_SETTLEMENT.EXECUTE,
  D.REPORTS.VIEW,
  D.POLICY.MANAGE,
] as const;

interface TabDef {
  value: string;
  label: string;
  icon: ReactNode;
  allowed: boolean;
  panel: ReactNode;
}

function useTabs(): TabDef[] {
  const can = {
    agreements: useHasPermission(D.AGREEMENTS.MANAGE),
    rates: useHasPermission(D.RATE_CARDS.MANAGE),
    ledger: useHasPermission(D.LEDGER.VIEW),
    prepare: useHasPermission(D.STATEMENTS.PREPARE),
    approve: useHasPermission(D.STATEMENTS.APPROVE),
    pay: useHasPermission(D.PAYOUTS.EXECUTE),
    day: useHasPermission(D.DAY_SETTLEMENT.EXECUTE),
    reports: useHasPermission(D.REPORTS.VIEW),
    policy: useHasPermission(D.POLICY.MANAGE),
  };
  const icon = (Icon: typeof IconTable) => <Icon size={16} aria-hidden />;
  return [
    {
      value: "day",
      label: "Day settlement",
      icon: icon(IconCalendarDollar),
      allowed: can.day,
      panel: <DaySettlementTab />,
    },
    {
      value: "statements",
      label: "Statements",
      icon: icon(IconFileInvoice),
      allowed: can.prepare,
      panel: <StatementsTab />,
    },
    {
      value: "approvals",
      label: "Approvals",
      icon: icon(IconChecklist),
      allowed: can.approve,
      panel: <ApprovalsTab />,
    },
    {
      value: "payouts",
      label: "Payout run",
      icon: icon(IconSend),
      allowed: can.pay,
      panel: <PayoutRunTab />,
    },
    {
      value: "ledger",
      label: "Ledger",
      icon: icon(IconListDetails),
      allowed: can.ledger,
      panel: <LedgerTab />,
    },
    {
      value: "agreements",
      label: "Agreements",
      icon: icon(IconScale),
      allowed: can.agreements,
      panel: <AgreementsTab />,
    },
    {
      value: "rate-cards",
      label: "Rate cards",
      icon: icon(IconTable),
      allowed: can.rates,
      panel: <RateCardsTab />,
    },
    {
      value: "reports",
      label: "Reports",
      icon: icon(IconReportAnalytics),
      allowed: can.reports,
      panel: <ReportsTab />,
    },
    {
      value: "policy",
      label: "Policy",
      icon: icon(IconShieldCheck),
      allowed: can.policy,
      panel: <PolicyTab />,
    },
  ].filter((t) => t.allowed);
}

/**
 * Doctor payouts: how visiting, day and fee-for-service doctors are paid —
 * agreements and rate cards, what each doctor earned, statements approved
 * by someone other than their preparer, and the payout with TDS.
 */
export function DoctorPayoutsPage() {
  useRequirePermission(PAGE_PERMISSIONS);
  const tabs = useTabs();
  const [params, setParams] = useSearchParams();
  const active = tabs.some((t) => t.value === params.get("tab"))
    ? (params.get("tab") as string)
    : tabs[0]?.value;
  return (
    <Stack gap="md">
      <PageHeader
        title="Doctor payouts"
        description="What each doctor earned, the statements that gather it, and paying them with TDS."
      />
      <Tabs
        value={active}
        onChange={(v) => v && setParams({ tab: v }, { replace: true })}
        keepMounted={false}
      >
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Tab key={t.value} value={t.value} leftSection={t.icon}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {tabs.map((t) => (
          <Tabs.Panel key={t.value} value={t.value} pt="md">
            {t.panel}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}
