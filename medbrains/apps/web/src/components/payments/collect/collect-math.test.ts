import type { PaymentCapabilities } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  buildCollectRequest,
  changeDue,
  focusBills,
  remainingAfter,
  type TenderPart,
  tendersOf,
} from "./collect-math";
import { planDeposit } from "./DepositTender";
import { startTile, type TileContext, usableTiles } from "./tender-tiles";
import { bill } from "./test-fixtures";

const LAB = bill("lab", { balance: "1200.00", encounter_id: "e1" });
const PHARMACY = bill("ph", { lanes: ["pharmacy"], balance: "450.00", can_collect: false });
const OPD = bill("opd", { lanes: ["opd", "registration"], encounter_id: "e1" });

describe("which bills the drawer is about", () => {
  it("a department's desk sees its department's bills", () => {
    expect(focusBills([LAB, PHARMACY, OPD], { lane: "lab" }).map((b) => b.invoice_id)).toEqual([
      "lab",
    ]);
  });

  it("a visit and a department narrow together", () => {
    const bills = [LAB, OPD, bill("old-opd", { lanes: ["opd"], encounter_id: "e0" })];
    expect(focusBills(bills, { encounterId: "e1", lane: "opd" }).map((b) => b.invoice_id)).toEqual([
      "opd",
    ]);
  });

  it("with no department named, only the bills this desk may collect", () => {
    expect(focusBills([LAB, PHARMACY], {}).map((b) => b.invoice_id)).toEqual(["lab"]);
  });
});

describe("a split", () => {
  const card: TenderPart = {
    id: "c",
    mode: "card",
    amount: 1000,
    gatewayTransactionId: "txn-1",
    reference: "RRN",
    label: "Card",
  };

  it("counts down what is left, to the paisa", () => {
    expect(remainingAfter(1650, [card])).toBe(650);
    expect(
      remainingAfter(0.3, [
        { ...card, amount: 0.1 },
        { ...card, amount: 0.2 },
      ]),
    ).toBe(0);
  });

  it("gives change only on what was handed over beyond the amount", () => {
    expect(changeDue(650, 700)).toBe(50);
    expect(changeDue(650, 600)).toBe(0);
  });

  it("sends an approved machine payment by its id and typed money by amount", () => {
    const cash: TenderPart = { id: "x", mode: "cash", amount: 650, tendered: 700, label: "Cash" };
    expect(tendersOf([card, cash])).toEqual([
      { mode: "card", amount: 1000, reference: "RRN", gateway_transaction_id: "txn-1" },
      { mode: "cash", amount: 650, reference: undefined },
    ]);
  });

  it("collects exactly the bills shown, under one key", () => {
    const req = buildCollectRequest({
      patientId: "p",
      focus: { lane: "lab" },
      scope: "focus",
      bills: [LAB],
      parts: [card],
      idempotencyKey: "key-12345",
      stationId: null,
    });
    expect(req).toMatchObject({
      scope: "department",
      lane: "lab",
      invoice_ids: ["lab"],
      idempotency_key: "key-12345",
    });
    const all = buildCollectRequest({
      ...{ patientId: "p", focus: { lane: "lab" } },
      scope: "all",
      bills: [LAB, OPD],
      parts: [card],
      idempotencyKey: "k-1234567",
    });
    expect(all.scope).toBe("all");
    expect(all.lane).toBeUndefined();
  });
});

const CAPS: PaymentCapabilities = {
  checkout: true,
  dynamic_qr: true,
  payment_links: true,
  partial_refund: true,
  multiple_refunds: true,
  payouts: false,
  upi_collect: false,
  emi: true,
};

const DESK: TileContext = {
  isSale: false,
  cashAllowed: true,
  canUseGateway: false,
  capabilities: CAPS,
  billCount: 1,
  hasDraft: false,
  canApplyDeposit: false,
  depositBalance: 0,
  creditAllowed: false,
  isInsured: false,
};

describe("which ways of paying a desk is offered", () => {
  const shown = (c: TileContext) => usableTiles(c).map((t) => t.tile);

  it("a lab desk without the gateway takes cash, card slips and UPI by UTR — never online", () => {
    expect(shown(DESK)).toEqual(["cash", "card", "upi"]);
    expect(usableTiles(DESK).find((t) => t.tile === "upi")?.hint).toBe("Enter the UTR");
  });

  it("online checkout pays exactly one bill, with the gateway and a provider that checks out", () => {
    const gateway = { ...DESK, canUseGateway: true };
    expect(shown(gateway)).toContain("online");
    expect(shown({ ...gateway, billCount: 2 })).not.toContain("online");
    expect(shown({ ...gateway, capabilities: { ...CAPS, checkout: false } })).not.toContain(
      "online",
    );
    expect(shown({ ...gateway, capabilities: null })).not.toContain("online");
  });

  it("the UPI QR confirms itself only where the provider makes dynamic QRs", () => {
    const hint = (c: TileContext) => usableTiles(c).find((t) => t.tile === "upi")?.hint;
    expect(hint({ ...DESK, canUseGateway: true })).toBe("Confirms itself");
    const noQr = { ...DESK, canUseGateway: true, capabilities: { ...CAPS, dynamic_qr: false } };
    expect(hint(noQr)).toBe("Enter the UTR");
  });

  it("the payment link is offered where the provider makes links, and says so where it does not", () => {
    const gateway = { ...DESK, canUseGateway: true };
    const tile = (c: TileContext) => usableTiles(c).find((t) => t.tile === "link");
    expect(tile(gateway)).toMatchObject({ disabled: false, hint: "All or part, by SMS" });
    const noLinks = { ...gateway, capabilities: { ...CAPS, payment_links: false } };
    expect(tile(noLinks)).toMatchObject({ disabled: true, hint: "Not supported by this provider" });
    // A draft can still change: issue it first.
    expect(tile({ ...gateway, hasDraft: true })).toMatchObject({ disabled: true });
    // No provider, no gateway, or a counter sale with no bill: no link tile at all.
    expect(shown({ ...gateway, capabilities: null })).not.toContain("link");
    expect(shown(DESK)).not.toContain("link");
    expect(shown({ ...gateway, isSale: true })).not.toContain("link");
  });

  it("a deposit is offered with a balance, and refused on draft bills", () => {
    const withDeposit = { ...DESK, canApplyDeposit: true, depositBalance: 4000 };
    expect(usableTiles(withDeposit).find((t) => t.tile === "advance")?.disabled).toBe(false);
    expect(
      usableTiles({ ...withDeposit, hasDraft: true }).find((t) => t.tile === "advance")?.disabled,
    ).toBe(true);
  });

  it("a counter with no open cash drawer takes no cash, and starts on the next tile", () => {
    const tiles = usableTiles({ ...DESK, isSale: true, cashAllowed: false });
    expect(tiles.map((t) => t.tile)).not.toContain("cash");
    expect(startTile(tiles, "cash")).toBe("card");
  });

  it("starts on the tile last used at this counter", () => {
    expect(startTile(usableTiles(DESK), "upi")).toBe("upi");
    const noLinks = {
      ...DESK,
      canUseGateway: true,
      capabilities: { ...CAPS, payment_links: false },
    };
    expect(startTile(usableTiles(noLinks), "link")).toBe("cash");
  });
});

describe("paying from a deposit", () => {
  it("covers the oldest bills first, never more than each owes or the deposit holds", () => {
    const deposit = { id: "a1", balance: "150.00" } as Parameters<typeof planDeposit>[0][number];
    expect(planDeposit([deposit], [bill("1"), bill("2")], 500)).toEqual([
      { advanceId: "a1", invoiceId: "1", amount: 100 },
      { advanceId: "a1", invoiceId: "2", amount: 50 },
    ]);
  });
});
