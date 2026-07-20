import { Tabs } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconChartBar,
  IconChecklist,
  IconClipboardText,
  IconGavel,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AppealsTab } from "./insurance/appeals-tab";
import { DashboardTab } from "./insurance/dashboard-tab";
import { PriorAuthTab } from "./insurance/prior-auth-tab";
import { RulesTab } from "./insurance/rules-tab";
import { VerificationTab } from "./insurance/verification-tab";

export function InsurancePage() {
  useRequirePermission(P.INSURANCE.VERIFICATION_LIST);
  const canViewPriorAuth = useHasPermission(P.INSURANCE.PRIOR_AUTH_LIST);
  const canViewAppeals = useHasPermission(P.INSURANCE.APPEALS_LIST);
  const canListRules = useHasPermission(P.INSURANCE.RULES_LIST);
  const canManageRules = useHasPermission(P.INSURANCE.RULES_MANAGE);
  const canViewRules = canListRules || canManageRules;
  const canViewDashboard = useHasPermission(P.INSURANCE.DASHBOARD_VIEW);

  return (
    <Tabs defaultValue="verification">
      <Tabs.List>
        <Tabs.Tab value="verification" leftSection={<IconShieldCheck size={16} />}>
          Verification
        </Tabs.Tab>
        {canViewPriorAuth && (
          <Tabs.Tab value="prior-auth" leftSection={<IconClipboardText size={16} />}>
            Prior Authorization
          </Tabs.Tab>
        )}
        {canViewAppeals && (
          <Tabs.Tab value="appeals" leftSection={<IconGavel size={16} />}>
            Appeals
          </Tabs.Tab>
        )}
        {canViewRules && (
          <Tabs.Tab value="rules" leftSection={<IconChecklist size={16} />}>
            PA Rules
          </Tabs.Tab>
        )}
        {canViewDashboard && (
          <Tabs.Tab value="dashboard" leftSection={<IconChartBar size={16} />}>
            Dashboard
          </Tabs.Tab>
        )}
      </Tabs.List>

      <Tabs.Panel value="verification" pt="md">
        <VerificationTab />
      </Tabs.Panel>
      {canViewPriorAuth && (
        <Tabs.Panel value="prior-auth" pt="md">
          <PriorAuthTab />
        </Tabs.Panel>
      )}
      {canViewAppeals && (
        <Tabs.Panel value="appeals" pt="md">
          <AppealsTab />
        </Tabs.Panel>
      )}
      {canViewRules && (
        <Tabs.Panel value="rules" pt="md">
          <RulesTab />
        </Tabs.Panel>
      )}
      {canViewDashboard && (
        <Tabs.Panel value="dashboard" pt="md">
          <DashboardTab />
        </Tabs.Panel>
      )}
    </Tabs>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 1 — Verification
// ═══════════════════════════════════════════════════════
