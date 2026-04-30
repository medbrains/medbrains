/**
 * Pharmacy module — dispensing queue, NDPS register, stock,
 * formulary. Regulatory: NDPS Act + D&C Act; Schedule H/H1/X
 * dispensing requires duplicate record + witness.
 */

import { P } from "@medbrains/types";
import type { Module } from "@medbrains/mobile-shell";
import { ModuleHome } from "../components/module-home.js";

function PharmacyScreen() {
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

export const pharmacyModule: Module = {
  id: "pharmacy",
  displayName: "Pharmacy",
  icon: () => null,
  requiredPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST],
  navigator: PharmacyScreen,
  offlineDocTypes: ["dispense_event", "ndps_entry"],
};
