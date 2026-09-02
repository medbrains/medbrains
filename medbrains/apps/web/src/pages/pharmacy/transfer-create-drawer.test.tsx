import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * What the drawer knows that the API does not: whether the source store can
 * actually cover a line, before anyone approves the transfer.
 *
 * Dispatch refuses stock the source does not hold. Without this the refusal
 * lands after an approval, and the person who raised the transfer learns it
 * was impossible from an error on somebody else's screen.
 */
const STORE_A = "11111111-1111-1111-1111-111111111111";
const STORE_B = "22222222-2222-2222-2222-222222222222";
const DRUG = "33333333-3333-3333-3333-333333333333";

let listPharmacyBatches: () => Promise<unknown[]> = async () => [];

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listStoreLocations: async () => [
        { id: STORE_A, name: "Main Store" },
        { id: STORE_B, name: "Camp Store" },
      ],
      listPharmacyBatches: () => listPharmacyBatches(),
      searchPharmacyCatalog: async () => [],
      listPharmacyCatalog: async () => [],
    },
  };
});

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useFieldAccess: () => "edit",
}));

const { TransferCreateDrawer, indexStock } = await import("./transfer-create-drawer");

const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

const batch = (over: Record<string, unknown>) =>
  ({
    id: "b",
    catalog_item_id: DRUG,
    store_location_id: STORE_A,
    quantity_on_hand: 10,
    expiry_date: "2027-06-30",
    ...over,
  }) as never;

describe("what the source store holds", () => {
  it("adds up every batch of the same item in the same store", () => {
    const index = indexStock([
      batch({ id: "b1", quantity_on_hand: 40 }),
      batch({ id: "b2", quantity_on_hand: 25 }),
    ]);

    expect(index.get(`${STORE_A}:${DRUG}`)?.onHand).toBe(65);
  });

  it("reports the earliest expiry, because that is what leaves first", () => {
    const index = indexStock([
      batch({ id: "b1", expiry_date: "2027-06-30" }),
      batch({ id: "b2", expiry_date: "2026-11-30" }),
      batch({ id: "b3", expiry_date: "2028-01-31" }),
    ]);

    expect(index.get(`${STORE_A}:${DRUG}`)?.earliestExpiry).toBe("2026-11-30");
  });

  it("ignores stock that belongs to no store", () => {
    // Such stock cannot be dispatched from anywhere, so counting it would
    // promise a transfer that dispatch then refuses.
    expect(indexStock([batch({ store_location_id: null })]).size).toBe(0);
  });

  it("ignores emptied batches", () => {
    expect(indexStock([batch({ quantity_on_hand: 0 })]).size).toBe(0);
  });

  it("keeps each store's holding separate", () => {
    const index = indexStock([
      batch({ id: "b1", store_location_id: STORE_A, quantity_on_hand: 40 }),
      batch({ id: "b2", store_location_id: STORE_B, quantity_on_hand: 7 }),
    ]);

    expect(index.get(`${STORE_A}:${DRUG}`)?.onHand).toBe(40);
    expect(index.get(`${STORE_B}:${DRUG}`)?.onHand).toBe(7);
  });
});

describe("raising a stock transfer", () => {
  it("does not read stock until a source store is named", async () => {
    let reads = 0;
    listPharmacyBatches = async () => {
      reads += 1;
      return [];
    };

    render(<TransferCreateDrawer opened onClose={() => {}} />, { queryClient: silentClient() });
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /from store/i })).toBeInTheDocument(),
    );

    // The endpoint caps at 500 rows tenant-wide; an unscoped read can truncate
    // away the source store's own batches and understate what it holds.
    expect(reads, "batches must not be fetched before a source store is chosen").toBe(0);
  });
});
