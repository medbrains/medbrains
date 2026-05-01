/**
 * Pharmacy module — Rx queue, dispensing, NDPS, OTC, stock.
 * Regulatory: NDPS Act + D&C Act; Schedule H/H1/X dispensing
 * requires duplicate record + witness.
 */

import type { ReactNode } from "react";
import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import type { IntentTone } from "@medbrains/ui-mobile";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { listPharmacyOrders } from "../api/pharmacy.js";

const STATUS_TONE: Record<string, IntentTone> = {
  draft: "neutral",
  pending: "warn",
  in_progress: "info",
  dispensed: "success",
  cancelled: "alert",
};

function PharmacyHome(): ReactNode {
  const router = useModuleRouter();
  return (
    <ModuleHome
      eyebrow="MODULE"
      title="Pharmacy"
      description="Dispensing, NDPS register, stock, formulary."
      summaries={[
        { eyebrow: "QUEUE", count: "—", title: "Rx awaiting dispense" },
        { eyebrow: "NDPS", count: "—", title: "Controlled balance entries" },
      ]}
      actions={[
        {
          id: "rx-queue",
          label: "Prescription queue",
          description: "Validate + dispense pending prescriptions.",
          permission: P.PHARMACY.RX_QUEUE_LIST,
          onPress: () => router.push("orders"),
        },
        {
          id: "dispense",
          label: "Dispense",
          description: "Schedule check + LASA flag + batch trace.",
          permission: P.PHARMACY.DISPENSING_CREATE,
        },
        {
          id: "ndps",
          label: "NDPS register",
          description: "Controlled-substance entries with witness.",
          permission: P.PHARMACY.NDPS_LIST,
        },
        {
          id: "pos",
          label: "OTC counter sale",
          description: "Walk-in sale (non-prescription only).",
          permission: P.PHARMACY.POS_CREATE,
        },
        {
          id: "stock",
          label: "Stock + batches",
          description: "FEFO check + near-expiry, dead-stock.",
          permission: P.PHARMACY.STOCK_MANAGE,
        },
      ]}
    />
  );
}

function PharmacyOrdersScreen(): ReactNode {
  return (
    <EntityListScreen
      eyebrow="PHARMACY"
      title="Prescription queue"
      description="Pending pharmacy orders."
      fetcher={async () => (await listPharmacyOrders()).orders}
      rowKey={(o) => o.id}
      renderRow={(o) => (
        <EntityRow
          title={o.dispensing_type}
          subtitle={`${new Date(o.created_at).toLocaleString()} · ${o.notes ?? "—"}`}
          badge={{ label: o.status, tone: STATUS_TONE[o.status] ?? "neutral" }}
        />
      )}
      emptyTitle="Queue is empty"
    />
  );
}

function PharmacyScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{ home: <PharmacyHome />, orders: <PharmacyOrdersScreen /> }}
    />
  );
}

export const pharmacyModule: Module = {
  id: "pharmacy",
  displayName: "Pharmacy",
  icon: () => null,
  requiredPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST],
  navigator: PharmacyScreen,
  offlineDocTypes: ["dispense_event", "ndps_entry"],
};
