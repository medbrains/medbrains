import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * The batch count belongs to the stock row, not to a fetched batch list.
 *
 * `GET /pharmacy/batches` answers at most 500 rows ordered by expiry. The
 * screen used to fetch that window and count it per item in the browser, so a
 * pharmacy holding more than 500 live batches showed "0 batches" — and a
 * drawer reading "No active batch stock recorded for this product" — for an
 * item whose stock simply expired later than the window reached. A pharmacist
 * reconciling against that turns a patient away from stock on the shelf.
 *
 * The count and FEFO date are now aggregated in SQL and ride on the stock row.
 * This test pins that: batches beyond the window are invisible to the batch
 * endpoint, so the count must survive it returning nothing at all.
 */
const stockRow = {
  id: "item-1",
  tenant_id: "t-1",
  code: "PARA500",
  name: "Paracetamol 500mg",
  generic_name: null,
  category: null,
  manufacturer: null,
  unit: "tab",
  base_price: "1.00",
  tax_percent: "0",
  current_stock: 120,
  reorder_level: 20,
  is_active: true,
  drug_schedule: null,
  is_controlled: false,
  inn_name: null,
  atc_code: null,
  rxnorm_code: null,
  snomed_code: null,
  formulary_status: "formulary",
  aware_category: null,
  is_lasa: false,
  lasa_group: null,
  max_dose_per_day: null,
  batch_tracking_required: true,
  storage_conditions: null,
  black_box_warning: null,
  barcode: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  batch_count: 3,
  earliest_expiry: "2026-11-30",
};

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listStock: async () => [stockRow],
      // The window the browser used to count. Empty here on purpose: past 500
      // live batches this item's rows fall outside it entirely.
      listPharmacyBatches: async () => [],
      myPharmacies: async () => [],
      listStoreLocations: async () => [],
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useFieldAccess: () => "edit",
}));

const { StockTab } = await import("./stock");

const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("the batch count on a stock row", () => {
  it("reports the row's own count even when the batch window returns nothing", async () => {
    render(<StockTab canManage />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText(/Paracetamol 500mg/)).toBeInTheDocument());
    // "0 batches" here is the bug this replaces.
    expect(screen.getByRole("button", { name: /3 batches/ })).toBeInTheDocument();
  });

  it("shows the FEFO date from the row rather than the first row of a window", async () => {
    render(<StockTab canManage />, { queryClient: silentClient() });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /FEFO 2026-11-30/ })).toBeInTheDocument(),
    );
  });
});
