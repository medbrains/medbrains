/**
 * Materials Management — unified operations workspace.
 *
 * Stores, requisitions, procurement and the asset register were three
 * separate nav modules; a storekeeper or department lived across all of
 * them to do one logical job. This is the OPD-style two-pane cockpit that
 * brings them under one roof: a section rail on the left, the section's
 * content on the right. Phase 1 mounts the existing pages as sections
 * (reuse, no rewrite); later phases replace each with a purpose-built,
 * unified panel (one requisition inbox spanning stores + assets, a single
 * inventory view, merged analytics).
 */
import { Stack, Tabs, Text } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconArrowsExchange,
  IconBuildingWarehouse,
  IconClipboardList,
  IconInbox,
  IconPackages,
  IconShoppingCart,
} from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { InventoryView } from "@/components/Materials/InventoryView";
import { RequisitionsInbox } from "@/components/Materials/RequisitionsInbox";
import { PageHeader } from "@/components/PageHeader";
import { type RailItem, WorkspaceRail } from "@/components/WorkspaceRail";
import { AssetsPage } from "./assets";
import { IndentPage } from "./indent";
import { ProcurementPage } from "./procurement";

interface Section extends RailItem {
  content: ReactNode;
}

export function MaterialsPage() {
  const canRequisitions = useHasPermission(P.INDENT.LIST);
  const canAssets = useHasPermission(P.ASSETS.LIST);
  const canProcurement = useHasAnyPermission([
    P.PROCUREMENT.PO_LIST,
    P.PROCUREMENT.VENDORS_LIST,
    P.PROCUREMENT.GRN_LIST,
  ]);

  const sectionDefs: Array<Section | false> = [
    (canRequisitions || canAssets) && {
      value: "inbox",
      label: "Requisitions",
      icon: <IconInbox size={16} />,
      content: <RequisitionsInbox />,
    },
    (canRequisitions || canAssets) && {
      value: "inventory",
      label: "Inventory",
      icon: <IconPackages size={16} />,
      content: <InventoryView />,
    },
    canRequisitions && {
      value: "requisitions",
      label: "Stores & Indents",
      icon: <IconClipboardList size={16} />,
      content: <IndentPage />,
    },
    canAssets && {
      value: "assets",
      label: "Assets & Movement",
      icon: <IconArrowsExchange size={16} />,
      content: <AssetsPage />,
    },
    canProcurement && {
      value: "procurement",
      label: "Procurement",
      icon: <IconShoppingCart size={16} />,
      content: <ProcurementPage />,
    },
  ];
  const sections: Section[] = sectionDefs.filter((s): s is Section => s !== false);

  const [active, setActive] = useState<string | null>(sections[0]?.value ?? null);

  if (sections.length === 0) {
    return (
      <Stack>
        <PageHeader
          title="Materials Management"
          icon={<IconBuildingWarehouse size={20} stroke={1.5} />}
        />
        <Text size="sm" c="dimmed">
          You don't have access to any materials sections.
        </Text>
      </Stack>
    );
  }

  return (
    <WorkspaceRail
      groups={[{ label: "Materials", items: sections.map(({ content: _c, ...item }) => item) }]}
      active={active}
      onChange={setActive}
    >
      {sections.map((s) => (
        <Tabs.Panel key={s.value} value={s.value}>
          {s.content}
        </Tabs.Panel>
      ))}
    </WorkspaceRail>
  );
}
