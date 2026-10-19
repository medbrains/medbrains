import { useHasPermission } from "@medbrains/stores";
import { P, type PharmacyCatalog, type PrescriptionHistoryItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { opdService } from "@/services/opd.service";
import { prescriptionItemsToRx } from "./rxAdapter";
import type { FormularyDrug, RxItem } from "./rxModel";

export interface LastPrescription {
  /** "12 Sep 2026 · Dr. Rao" — what the doctor is about to repeat. */
  label: string;
  items: RxItem[];
  /** Drugs that can't be repeated: no longer stocked, or never catalogued. */
  skipped: string[];
}

/**
 * The patient's most recent prescription from another visit, ready to load
 * into the writer. It loads like an order set: the doctor still reviews it,
 * the safety rail re-runs, and the server re-checks at save.
 */
export function pickLastPrescription(
  history: readonly PrescriptionHistoryItem[],
  encounterId: string,
  catalog: readonly PharmacyCatalog[],
  formularyById: Record<string, FormularyDrug>,
): LastPrescription | null {
  // History comes newest first.
  const last = history.find(
    (h) => h.prescription.encounter_id !== encounterId && h.items.length > 0,
  );
  if (!last) return null;
  const active = new Set(catalog.filter((c) => c.is_active).map((c) => c.id));
  // Lines the doctor removed by editing never arrive: the history carries
  // active lines only.
  const repeatable = last.items.filter(
    (i) => i.catalog_item_id && active.has(i.catalog_item_id) && formularyById[i.catalog_item_id],
  );
  const date = new Date(last.encounter_date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return {
    label: last.doctor_name ? `${date} · Dr. ${last.doctor_name}` : date,
    items: prescriptionItemsToRx(repeatable, formularyById),
    skipped: last.items.filter((i) => !repeatable.includes(i)).map((i) => i.drug_name),
  };
}

export function useLastPrescription(
  patientId: string | undefined,
  encounterId: string,
  catalog: readonly PharmacyCatalog[],
  formularyById: Record<string, FormularyDrug>,
  enabled: boolean,
): LastPrescription | null {
  // The history endpoint requires patients.view; don't ask without it.
  const canRead = useHasPermission(P.PATIENTS.VIEW);
  const { data: history = [] } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => opdService.listPatientPrescriptions(patientId ?? ""),
    enabled: enabled && canRead && Boolean(patientId),
  });
  return useMemo(
    () => pickLastPrescription(history, encounterId, catalog, formularyById),
    [history, encounterId, catalog, formularyById],
  );
}
