import type { LineSubstitution, QuarantineRow, StoreOrder } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  awaitsPatient,
  canCancel,
  canReturn,
  destroyProblem,
  ladderProblem,
  parseNppaSheet,
  parsePincodes,
  printableLines,
} from "./storefront-p2";

const order = (over: Partial<StoreOrder>): StoreOrder => ({
  id: "o1",
  status: "awaiting_verification",
  rx_source: "hospital",
  fulfilment: "pickup",
  delivery_payment: null,
  placed_at: null,
  decision_note: null,
  pharmacy_stage: null,
  flags: [],
  return_status: null,
  lines: [],
  total: "0",
  ...over,
});

const sub = (over: Partial<LineSubstitution>): LineSubstitution => ({
  id: "s1",
  substitute_item_id: "i2",
  substitute_name: "Brandtwo",
  status: "with_doctor",
  method: "sign_off",
  reason: "Out of stock",
  patient_consent: null,
  confirm_due_at: null,
  ...over,
});

const pack = (over: Partial<QuarantineRow>): QuarantineRow => ({
  id: "q1",
  source: "online",
  drug_name: "Openamol",
  batch_number: "B1",
  expiry_date: null,
  quantity: 1,
  reasons: ["opened"],
  route: "bmw",
  status: "quarantined",
  certificate_number: null,
  created_at: "2026-10-20T00:00:00Z",
  ...over,
});

describe("substitutes", () => {
  it("the patient answers once, while the substitute still stands", () => {
    expect(awaitsPatient(sub({}))).toBe(true);
    expect(awaitsPatient(sub({ status: "approved" }))).toBe(true);
    expect(awaitsPatient(sub({ patient_consent: "accepted" }))).toBe(false);
    expect(awaitsPatient(sub({ status: "reverted" }))).toBe(false);
    expect(awaitsPatient(null)).toBe(false);
  });
});

describe("cancelling and returning", () => {
  it("cancels only before the pharmacy dispenses", () => {
    expect(canCancel(order({}))).toBe(true);
    expect(canCancel(order({ status: "released", pharmacy_stage: "ordered" }))).toBe(true);
    expect(canCancel(order({ status: "released", pharmacy_stage: "dispensed" }))).toBe(false);
    expect(canCancel(order({ status: "cancelled" }))).toBe(false);
  });

  it("returns only what was dispensed, one return at a time", () => {
    const dispensed = order({ status: "released", pharmacy_stage: "dispensed" });
    expect(canReturn(dispensed)).toBe(true);
    expect(canReturn({ ...dispensed, return_status: "requested" })).toBe(false);
    expect(canReturn({ ...dispensed, return_status: "refused" })).toBe(true);
    expect(canReturn(order({ status: "released", pharmacy_stage: "ordered" }))).toBe(false);
  });

  it("prints only lines still waiting", () => {
    const line = {
      line_id: "l1",
      catalog_item_id: "i1",
      drug_name: "Brandone",
      quantity: 10,
      unit_price: "10",
      approved_quantity: null,
      reject_reason: null,
      substitute_name: null,
      substitution: null,
    };
    const o = order({
      lines: [
        { ...line, status: "pending" },
        { ...line, line_id: "l2", catalog_item_id: "i2", status: "approved" },
      ],
    });
    expect(printableLines(o)).toEqual(["i1"]);
    expect(printableLines({ ...o, status: "released" })).toEqual([]);
  });
});

describe("destroying quarantined packs", () => {
  const form = {
    witnessUserId: null,
    witnessName: "S. Witness",
    cbmwtfName: "",
    manifestNumber: "",
  };

  it("biomedical waste needs the facility and its manifest", () => {
    expect(destroyProblem([pack({})], form)).toMatch(/facility/);
    expect(
      destroyProblem([pack({})], { ...form, cbmwtfName: "CBMWTF", manifestNumber: "MF-1" }),
    ).toBeNull();
  });

  it("a controlled drug needs a second person, and never shares a certificate", () => {
    const ndps = pack({ route: "ndps", reasons: ["controlled"] });
    expect(destroyProblem([ndps], form)).toMatch(/second person/);
    expect(destroyProblem([ndps], { ...form, witnessUserId: "u2" })).toBeNull();
    expect(destroyProblem([ndps, pack({ id: "q2" })], { ...form, witnessUserId: "u2" })).toMatch(
      /separate/,
    );
  });
});

describe("settings input", () => {
  it("a hold ladder ends open and climbs", () => {
    expect(ladderProblem([{ max_available: null, minutes: 15 }])).toBeNull();
    expect(ladderProblem([{ max_available: 10, minutes: 10 }])).toMatch(/any amount/);
    expect(
      ladderProblem([
        { max_available: 10, minutes: 5 },
        { max_available: 5, minutes: 5 },
        { max_available: null, minutes: 15 },
      ]),
    ).toMatch(/smallest/);
  });

  it("pincodes are six digits, kept once", () => {
    expect(parsePincodes("630001, 630001\n630002 0123 abc")).toEqual({
      pincodes: ["630001", "630002"],
      bad: ["0123", "abc"],
    });
  });

  it("an NPPA sheet reads code, ceiling and notification", () => {
    const sheet = "code,ceiling,notification\nPCM-500,2.08,SO 1234(E)\nBAD,0\n";
    const { rows, problems } = parseNppaSheet(sheet);
    expect(rows).toEqual([{ code: "PCM-500", ceiling_price: "2.08", notification: "SO 1234(E)" }]);
    expect(problems).toHaveLength(1);
  });
});
