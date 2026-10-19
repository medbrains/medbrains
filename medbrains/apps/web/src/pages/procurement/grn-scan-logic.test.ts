import type { GrnScanDraft, GrnScanDraftLine } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  accuracyOf,
  confidenceLabel,
  fromForm,
  groupIssues,
  needsCheck,
  parseLinePath,
  sha256Hex,
  suggestionsFor,
  toForm,
} from "./grn-scan-logic";

const line = (over: Partial<GrnScanDraftLine> = {}): GrnScanDraftLine => ({
  product_name: "Dolo 650",
  supplier_code: "D650",
  pack: "1x15",
  strength: "650 mg",
  dosage_form: "tablet",
  manufacturer: "Micro Labs",
  inn_name: "paracetamol",
  hsn_code: "3004",
  batch_number: "B12",
  expiry_date: "2028-06-30",
  manufacture_date: null,
  mrp: "30.00",
  ptr: null,
  rate: "20.00",
  quantity: 10,
  free_quantity: 1,
  discount_amount: null,
  gst_rate: "5",
  quantity_rejected: null,
  catalog_item_id: "item-1",
  suggested_item_id: "item-1",
  po_item_id: null,
  ...over,
});

const draft = (): GrnScanDraft => ({
  header: {
    vendor_id: "v1",
    po_id: null,
    store_location_id: null,
    supplier_gstin: "29ABCDE1234F1Z5",
    supplier_name: "Stockist",
    invoice_number: "INV-45",
    invoice_date: "2026-10-01",
    invoice_amount: "231.00",
    irn: null,
  },
  lines: [line(), line({ batch_number: "B13", suggested_item_id: null })],
  confidence: { "lines[0].batch_number": 0.62, "lines[1].expiry_date": 0 },
});

describe("server field paths", () => {
  it("maps GRN line names onto the draft's", () => {
    expect(parseLinePath("items[2].unit_price")).toEqual({ line: 2, field: "rate" });
    expect(parseLinePath("lines[0].catalog_item_id")).toEqual({
      line: 0,
      field: "catalog_item_id",
    });
    expect(parseLinePath("invoice_amount")).toBeNull();
  });

  it("groups findings by line and field, header apart", () => {
    const grouped = groupIssues([
      { field: "items[1].mrp", severity: "block", message: "MRP below rate" },
      { field: "invoice_amount", severity: "block", message: "Totals differ" },
    ]);
    expect(grouped.get("1.mrp")?.[0]?.message).toBe("MRP below rate");
    expect(grouped.get("header")?.[0]?.field).toBe("invoice_amount");
  });
});

describe("confidence", () => {
  it("flags fields read below the threshold and names unread ones", () => {
    const { confidence } = draft();
    expect(needsCheck(confidence, "lines[0].batch_number", 0.95)).toBe(true);
    expect(needsCheck(confidence, "lines[0].mrp", 0.95)).toBe(false);
    expect(confidenceLabel(confidence, "lines[0].batch_number")).toBe("Read at 62% — check");
    expect(confidenceLabel(confidence, "lines[1].expiry_date")).toBe(
      "Could not be read — enter it",
    );
  });
});

describe("draft round trip", () => {
  it("keeps what the screen does not edit and never rewrites the suggestion", () => {
    const original = draft();
    const form = toForm(original);
    expect(form.remember_matches).toBe(true);
    const first = form.lines[0];
    if (!first) throw new Error("a line");
    first.batch_number = "B12A";
    first.catalog_item_id = "item-2";
    const back = fromForm(form, original);
    expect(back.lines[0]?.batch_number).toBe("B12A");
    expect(back.lines[0]?.catalog_item_id).toBe("item-2");
    expect(back.lines[0]?.suggested_item_id).toBe("item-1");
    expect(back.lines[0]?.pack).toBe("1x15");
    expect(back.lines[0]?.quantity).toBe(10);
    expect(back.confidence).toEqual(original.confidence);
  });

  it("drops a removed line and keeps the rest aligned to their source", () => {
    const original = draft();
    const form = toForm(original);
    form.lines = form.lines.slice(1);
    const back = fromForm(form, original);
    expect(back.lines).toHaveLength(1);
    expect(back.lines[0]?.batch_number).toBe("B13");
  });
});

describe("suggestions and accuracy", () => {
  it("lists a line's candidates best first", () => {
    const s = (line: number, score: number, id: string) => ({
      line,
      score,
      catalog_item_id: id,
      code: id,
      name: id,
      strength: null,
      dosage_form: null,
      pack_size: null,
      manufacturer: null,
      drug_schedule: null,
      is_controlled: null,
    });
    const found = suggestionsFor([s(0, 0.4, "a"), s(1, 0.9, "x"), s(0, 0.8, "b")], 0);
    expect(found.map((f) => f.catalog_item_id)).toEqual(["b", "a"]);
  });

  it("reports nothing to measure as null, not 0%", () => {
    const row = {
      vendor_id: "v",
      vendor_name: "V",
      scans: 2,
      fields_total: 40,
      fields_corrected: 4,
      lines_total: 6,
      lines_auto_matched: 0,
      lines_rematched: 0,
    };
    expect(accuracyOf(row)).toEqual({ fields: 90, matches: null });
    expect(accuracyOf({ ...row, lines_auto_matched: 3, lines_rematched: 1 }).matches).toBe(75);
  });

  it("hashes a file the way the server compares it", async () => {
    const hex = await sha256Hex(new Blob(["abc"]));
    expect(hex).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
