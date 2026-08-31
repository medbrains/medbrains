import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * The narcotics register must not read as empty when the read failed.
 *
 * `lab_report_dispatches` aside, this is the one screen in the module that is
 * a statutory record: the NDPS Act register of controlled-drug movements.
 * Both its reads fail quietly — the table falls back to `[]` and the balance
 * strip is hidden when `balance` is undefined — so an outage renders as "no
 * transactions" and "none held". Those are the two conclusions nobody should
 * draw from a network fault, least of all during a stock reconciliation.
 */
let listEntries: () => Promise<unknown> = async () => ({ entries: [] });
let getBalance: () => Promise<unknown> = async () => ({ entries: [] });

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listNdpsEntries: () => listEntries(),
      getNdpsBalance: () => getBalance(),
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useFieldAccess: () => "edit",
}));

const { NdpsRegisterTab } = await import("./ndps-register");

const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("the narcotics register when a read fails", () => {
  beforeEach(() => {
    listEntries = async () => ({ entries: [] });
    getBalance = async () => ({ entries: [] });
  });

  it("says the register could not be read rather than showing it empty", async () => {
    listEntries = async () => {
      throw new Error("503 upstream");
    };

    render(<NdpsRegisterTab />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText(/could not be read/i)).toBeInTheDocument());
  });

  it("warns when only the balance read fails, because a hidden strip reads as none held", async () => {
    getBalance = async () => {
      throw new Error("503 upstream");
    };

    render(<NdpsRegisterTab />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.getByText(/could not be read/i)).toBeInTheDocument());
  });

  it("stays quiet when the register genuinely holds nothing", async () => {
    render(<NdpsRegisterTab />, { queryClient: silentClient() });

    await waitFor(() => expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument());
  });
});
