import type { PharmacyCatalog, PrescriptionHistoryItem } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import type { FormularyDrug } from "./rxModel";
import { pickLastPrescription } from "./useLastPrescription";

const item = (id: string, name: string, extra: object = {}) => ({
  id: `item-${id}`,
  tenant_id: "t",
  prescription_id: "rx",
  drug_name: name,
  dosage: "500 mg",
  frequency: "1-0-1",
  duration: "5 days",
  route: "oral",
  instructions: null,
  created_at: "2026-09-01T00:00:00Z",
  item_status: "active",
  discontinued_at: null,
  discontinued_by: null,
  discontinue_reason: null,
  catalog_item_id: id,
  ...extra,
});

const visit = (encounter: string, date: string, items: ReturnType<typeof item>[]) =>
  ({
    prescription: { id: `rx-${encounter}`, encounter_id: encounter },
    items,
    encounter_date: date,
    doctor_name: "Rao",
  }) as unknown as PrescriptionHistoryItem;

const catalog = [
  { id: "para", is_active: true },
  { id: "metf", is_active: true },
  { id: "old", is_active: false },
] as PharmacyCatalog[];
const formulary = Object.fromEntries(
  ["para", "metf", "old"].map((id) => [id, { id, name: id, brands: [id] } as FormularyDrug]),
);

describe("repeat last prescription", () => {
  it("takes the newest prescription from another visit, not this one", () => {
    const history = [
      visit("today", "2026-10-10", [item("para", "Paracetamol")]),
      visit("sept", "2026-09-12", [item("metf", "Metformin")]),
    ];
    const last = pickLastPrescription(history, "today", catalog, formulary);
    expect(last?.items.map((i) => i.name)).toEqual(["Metformin"]);
    expect(last?.label).toContain("Dr. Rao");
  });

  it("leaves out drugs no longer stocked or never catalogued, and names them", () => {
    const history = [
      visit("sept", "2026-09-12", [
        item("metf", "Metformin"),
        item("old", "Ranitidine"),
        item("x", "Free-text tonic", { catalog_item_id: null }),
      ]),
    ];
    const last = pickLastPrescription(history, "today", catalog, formulary);
    expect(last?.items.map((i) => i.name)).toEqual(["Metformin"]);
    expect(last?.skipped).toEqual(["Ranitidine", "Free-text tonic"]);
  });

  it("keeps the frequency of a line saved as a bare code", () => {
    const history = [
      visit("sept", "2026-09-12", [
        item("metf", "Metformin", { frequency: "BD" }),
        item("para", "Paracetamol", { frequency: "TDS" }),
      ]),
    ];
    const last = pickLastPrescription(history, "today", catalog, formulary);
    expect(last?.items.map((i) => i.doses.length)).toEqual([2, 3]);
  });

  it("offers nothing when the patient has no earlier prescription", () => {
    const history = [visit("today", "2026-10-10", [item("para", "Paracetamol")])];
    expect(pickLastPrescription(history, "today", catalog, formulary)).toBeNull();
  });
});
