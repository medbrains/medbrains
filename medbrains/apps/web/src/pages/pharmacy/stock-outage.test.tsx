import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * An empty stock list is read as "we do not hold this".
 *
 * A pharmacist acts on that by turning a patient away, or by ordering
 * against stock that is in fact on the shelf. On a failed read `stock` is []
 * and makes the same statement, with nothing to tell the two apart.
 */
let listStock: () => Promise<unknown[]> = async () => [];

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      // Names taken from pharmacy.service.ts, not guessed: the page calls
      // myPharmacies/listStock/listPharmacyBatches/listStoreLocations, and a
      // wrong name leaves the real fetch in place, which returns a non-array
      // and crashes on .find before anything under test renders.
      listStock: () => listStock(),
      myPharmacies: async () => [],
      listPharmacyBatches: async () => [],
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

describe("the pharmacy stock list when the read fails", () => {
  beforeEach(() => {
    listStock = async () => [];
  });

  it("says stock could not be read rather than showing an empty shelf", async () => {
    listStock = async () => {
      throw new Error("503 upstream");
    };

    render(<StockTab canManage />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText(/could not be read/i)).toBeInTheDocument());
  });

  it("stays quiet when the shelf is genuinely empty", async () => {
    render(<StockTab canManage />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument());
  });
});
