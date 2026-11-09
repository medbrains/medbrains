import type { PharmacyRxDetailItem, PharmacyRxReviewItemInput } from "@medbrains/types";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { rxReviewInputFromItem, rxUnmappedLines } from "./shared";

/**
 * At review, each unmapped line is mapped to the catalogue or confirmed as
 * bought outside; it is never taken as outside because it is unmatched
 * (owner, 2026-11-09). Approve stays shut until every line is one or the
 * other. A line the doctor already marked needs no confirmation.
 */
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useFieldAccess: () => "edit",
}));
vi.mock("./formulary-picker", () => ({ FormularyPicker: () => null }));

const { RxBillingEstimate } = await import("./rx-billing-estimate");

/** One review line as the detail endpoint returns it. */
function line(id: string, source: PharmacyRxDetailItem["price_source"]): PharmacyRxDetailItem {
  return {
    id,
    drug_name: `Drug ${id}`,
    dosage: "1 tab",
    frequency: "OD",
    duration: "5 days",
    route: "oral",
    instructions: null,
    quantity: 5,
    catalog_item_id: source === "catalog" ? `cat-${id}` : null,
    unit_price: source === "catalog" ? 10 : 0,
    tax_percent: 0,
    taxable_amount: 0,
    tax_amount: 0,
    line_total: 0,
    price_source: source,
    buy_outside: source === "buy_outside",
  };
}

const ITEMS = [line("a", "catalog"), line("b", "unmatched"), line("c", "buy_outside")];

/** The estimate as the review modal holds it, reporting what Approve sees. */
function Harness({ onUnmapped }: { onUnmapped: (n: number) => void }) {
  const [review, setReview] = useState<PharmacyRxReviewItemInput[]>(
    ITEMS.map(rxReviewInputFromItem),
  );
  onUnmapped(rxUnmappedLines(ITEMS, review).length);
  return (
    <RxBillingEstimate
      items={ITEMS}
      editable
      reviewItems={review}
      onReviewItemsChange={setReview}
    />
  );
}

describe("Rx review, buy outside", () => {
  it("approves once the unmapped line is confirmed bought outside", async () => {
    const unmapped: number[] = [];
    render(<Harness onUnmapped={(n) => unmapped.push(n)} />);
    expect(unmapped.at(-1)).toBe(1);
    // The doctor's mark shows, with nothing to confirm.
    expect(screen.getAllByText("rxBillingEstimate.buyOutside")).toHaveLength(1);
    const confirm = screen.getByRole("checkbox", { name: "rxBillingEstimate.markBuyOutside" });
    await userEvent.click(confirm);
    expect(unmapped.at(-1)).toBe(0);
    expect(screen.getAllByText("rxBillingEstimate.buyOutside")).toHaveLength(2);
    // Unticked, it is unmapped again: nothing is assumed.
    await userEvent.click(confirm);
    expect(unmapped.at(-1)).toBe(1);
  });

  it("sends the confirmation with no catalogue item and no price", () => {
    const sent = rxUnmappedLines(ITEMS, [
      ...ITEMS.map(rxReviewInputFromItem).filter((l) => l.prescription_item_id !== "b"),
      {
        prescription_item_id: "b",
        catalog_item_id: null,
        quantity: 5,
        unit_price: 0,
        buy_outside: true,
      },
    ]);
    expect(sent).toEqual([]);
    expect(rxUnmappedLines(ITEMS, ITEMS.map(rxReviewInputFromItem)).map((l) => l.id)).toEqual([
      "b",
    ]);
  });
});
