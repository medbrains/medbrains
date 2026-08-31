import type { ModuleToken } from "@medbrains/types";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * A queue outage must not be drawn as an empty waiting room.
 *
 * "No tokens in the queue" is a statement about the queue. A desk that
 * believes it starts telling people to go home, and at a camp — one clinic,
 * one afternoon, people who travelled to get there — that is the whole
 * session lost. The board failing and the board being empty look identical
 * from the operator's chair unless the screen distinguishes them, which is
 * the repo's own rule that a list never renders an outage as emptiness.
 */

// A plain behaviour hook rather than a `vi.fn()`: a mock records what it
// returned, and a rejected promise sitting in `mock.results` is reported as
// an unhandled rejection even though the component handled it.
let board: () => Promise<ModuleToken[]> = async () => [];

// Spread the real module: the `@/components` barrel reaches ProtectedRoute
// and the session service, which need the rest of the client to exist.
vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listTokenBoard: () => board(),
      listDepartments: async () => [],
    },
  };
});

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const { TokenConsolePage } = await import("./token-console");

/**
 * A client that swallows the query error it is given on purpose. Without a
 * cache-level handler the deliberate rejection reaches vitest as an
 * unhandled one and fails the test that is asserting on it.
 */
const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("the token console when the board cannot be read", () => {
  beforeEach(() => {
    board = async () => [];
  });

  it("says the queue could not be read, not that nobody is waiting", async () => {
    board = async () => {
      throw new Error("503 upstream");
    };

    render(<TokenConsolePage />, { queryClient: silentClient() });

    await waitFor(() =>
      expect(screen.getByText("tokenConsole.boardUnavailable")).toBeInTheDocument(),
    );
    expect(screen.queryByText("tokenConsole.empty")).not.toBeInTheDocument();
  });

  it("still says nobody is waiting when the queue is genuinely empty", async () => {
    board = async () => [];

    render(<TokenConsolePage />);

    await waitFor(() => expect(screen.getByText("tokenConsole.empty")).toBeInTheDocument());
    expect(screen.queryByText("tokenConsole.boardUnavailable")).not.toBeInTheDocument();
  });
});
