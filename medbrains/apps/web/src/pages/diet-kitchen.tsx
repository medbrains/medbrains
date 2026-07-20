import { Tabs, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconClipboardList,
  IconPackage,
  IconSalad,
  IconShieldCheck,
  IconToolsKitchen2,
} from "@tabler/icons-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { AuditsTab } from "./diet-kitchen/audits-tab";
import { DietOrdersTab } from "./diet-kitchen/diet-orders-tab";
import { DietTemplatesTab } from "./diet-kitchen/diet-templates-tab";
import { InventoryTab } from "./diet-kitchen/inventory-tab";
import { KitchenTab } from "./diet-kitchen/kitchen-tab";

type DietKitchenTabKey = "orders" | "templates" | "kitchen" | "inventory" | "audits";

const DIET_PAGE_PERMISSIONS = [
  P.DIET.ORDERS_LIST,
  P.DIET.ORDERS_CREATE,
  P.DIET.TEMPLATES_LIST,
  P.DIET.TEMPLATES_MANAGE,
  P.DIET.KITCHEN_LIST,
  P.DIET.KITCHEN_MANAGE,
  P.DIET.INVENTORY_LIST,
  P.DIET.INVENTORY_MANAGE,
  P.DIET.AUDITS_LIST,
  P.DIET.AUDITS_CREATE,
] as const;

function dietTabFromSearch(value: string | null): DietKitchenTabKey | null {
  if (
    value === "orders" ||
    value === "templates" ||
    value === "kitchen" ||
    value === "inventory" ||
    value === "audits"
  ) {
    return value;
  }

  return null;
}

// ══════════════════════════════════════════════════════════
//  Diet Orders Tab
// ══════════════════════════════════════════════════════════

export function DietKitchenPage() {
  useRequirePermission(DIET_PAGE_PERMISSIONS);
  const [searchParams] = useSearchParams();
  const requestedTab = dietTabFromSearch(searchParams.get("tab"));
  const canViewOrders = useHasPermission(P.DIET.ORDERS_LIST);
  const canCreateOrders = useHasPermission(P.DIET.ORDERS_CREATE);
  const canViewTemplates = useHasPermission(P.DIET.TEMPLATES_LIST);
  const canManageTemplates = useHasPermission(P.DIET.TEMPLATES_MANAGE);
  const canViewKitchen = useHasPermission(P.DIET.KITCHEN_LIST);
  const canManageKitchen = useHasPermission(P.DIET.KITCHEN_MANAGE);
  const canViewInventory = useHasPermission(P.DIET.INVENTORY_LIST);
  const canManageInventory = useHasPermission(P.DIET.INVENTORY_MANAGE);
  const canViewAudits = useHasPermission(P.DIET.AUDITS_LIST);
  const canCreateAudits = useHasPermission(P.DIET.AUDITS_CREATE);

  const availableTabs = [
    {
      value: "orders" as const,
      label: "Diet Orders",
      icon: <IconClipboardList size={16} />,
      visible: canViewOrders || canCreateOrders,
    },
    {
      value: "templates" as const,
      label: "Templates",
      icon: <IconSalad size={16} />,
      visible: canViewTemplates || canManageTemplates,
    },
    {
      value: "kitchen" as const,
      label: "Kitchen",
      icon: <IconToolsKitchen2 size={16} />,
      visible: canViewKitchen || canManageKitchen,
    },
    {
      value: "inventory" as const,
      label: "Inventory",
      icon: <IconPackage size={16} />,
      visible: canViewInventory || canManageInventory,
    },
    {
      value: "audits" as const,
      label: "FSSAI Audits",
      icon: <IconShieldCheck size={16} />,
      visible: canViewAudits || canCreateAudits,
    },
  ].filter((item) => item.visible);
  const fallbackTab = availableTabs[0]?.value ?? "orders";
  const initialTab =
    requestedTab && availableTabs.some((item) => item.value === requestedTab)
      ? requestedTab
      : fallbackTab;
  const [selectedTab, setSelectedTab] = useState<DietKitchenTabKey>(initialTab);
  const activeTab = availableTabs.some((item) => item.value === selectedTab)
    ? selectedTab
    : fallbackTab;

  return (
    <div>
      <PageHeader
        title="Diet & Kitchen"
        subtitle="Patient dietary orders, meal planning, kitchen operations, and FSSAI compliance"
      />
      {availableTabs.length === 0 ? (
        <Text c="dimmed" size="sm">
          No diet or kitchen work areas are available for your current role.
        </Text>
      ) : (
        <Tabs
          value={activeTab}
          onChange={(value) => {
            const nextTab = dietTabFromSearch(value);
            if (nextTab) {
              setSelectedTab(nextTab);
            }
          }}
          keepMounted={false}
        >
          <Tabs.List mb="md">
            {availableTabs.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {(canViewOrders || canCreateOrders) && (
            <Tabs.Panel value="orders">
              <DietOrdersTab />
            </Tabs.Panel>
          )}
          {(canViewTemplates || canManageTemplates) && (
            <Tabs.Panel value="templates">
              <DietTemplatesTab />
            </Tabs.Panel>
          )}
          {(canViewKitchen || canManageKitchen) && (
            <Tabs.Panel value="kitchen">
              <KitchenTab />
            </Tabs.Panel>
          )}
          {(canViewInventory || canManageInventory) && (
            <Tabs.Panel value="inventory">
              <InventoryTab />
            </Tabs.Panel>
          )}
          {(canViewAudits || canCreateAudits) && (
            <Tabs.Panel value="audits">
              <AuditsTab />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </div>
  );
}
