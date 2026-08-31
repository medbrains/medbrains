import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * A camp's follow-up list is the conversion mechanism.
 *
 * The screening finds a pressure or a sugar worth acting on, and whether the
 * person ever reaches the hospital depends on somebody ringing them. An
 * empty list says nobody is owed a call. On a failed read `followups` is []
 * and says exactly the same thing, which at a camp means the afternoon's
 * findings quietly go nowhere.
 */
let listFollowups: () => Promise<unknown[]> = async () => [];

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listCampFollowups: () => listFollowups(),
      getCampStats: async () => ({}),
      listCampRegistrations: async () => [],
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));

const { FollowupsTab } = await import("./followups-tab");

const silentClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

const CAMP = "11111111-1111-1111-1111-111111111111";

describe("the camp follow-up list when the read fails", () => {
  beforeEach(() => {
    listFollowups = async () => [];
  });

  it("says calls may still be owed rather than showing an empty list", async () => {
    listFollowups = async () => {
      throw new Error("503 upstream");
    };

    render(<FollowupsTab campId={CAMP} selectedCamp={null} />, {
      queryClient: silentClient(),
    });

    await waitFor(() => expect(screen.getByText(/could not be read/i)).toBeInTheDocument());
  });

  it("stays quiet when no follow-ups are genuinely owed", async () => {
    render(<FollowupsTab campId={CAMP} selectedCamp={null} />, {
      queryClient: silentClient(),
    });

    await waitFor(() => expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument());
  });
});
