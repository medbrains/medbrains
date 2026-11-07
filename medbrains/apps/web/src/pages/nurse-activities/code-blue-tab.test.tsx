import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * The code-blue screen must say what did not go out. A page that only went
 * in-app, shown as a plain active code, tells the nurse the team was texted.
 */
const code = (over: Record<string, unknown> = {}) => ({
  id: "cb-1",
  patient_id: "p-1",
  location: "Ward 4 bed 2",
  started_at: "2026-11-07T09:00:00Z",
  ended_at: null,
  page_round: 1,
  routing_note: "No code team on the roster: alerting all clinicians (12)",
  delivery_warning: "SMS is not set up: only in-app alerts went out",
  delivery: [],
  ...over,
});

let listCodes: () => Promise<unknown[]> = async () => [];
const roster: () => Promise<unknown> = async () => ({
  members: [
    { id: "m-1", user_id: "u-1", full_name: "Dr Meera Nair", code_type: "code_blue", tier: 1 },
  ],
  candidates: [],
  response_secs: 60,
  max_rounds: 5,
});

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      listCodeBlue: () => listCodes(),
      listCodeBlueResponders: async () => [],
      getCodeBlueTeam: () => roster(),
    },
  };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
  useAuthStore: (select: (s: { user: { id: string } }) => unknown) =>
    select({ user: { id: "me" } }),
}));

const { CodeBlueTab } = await import("./code-blue-tab");

const silent = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

const tab = <CodeBlueTab patientId="p-1" encounterId="" wardId="" bedId="" />;

describe("the code-blue tab", () => {
  beforeEach(() => {
    listCodes = async () => [code()];
  });

  it("shows who was reached and that SMS did not go out", async () => {
    render(tab, { queryClient: silent() });
    await waitFor(() =>
      expect(
        screen.getByText("SMS is not set up: only in-app alerts went out"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/alerting all clinicians/)).toBeInTheDocument();
  });

  it("says the list failed rather than that no code is active", async () => {
    listCodes = async () => {
      throw new Error("503");
    };
    render(tab, { queryClient: silent() });
    await waitFor(() =>
      expect(screen.getByText("Active code blues unavailable")).toBeInTheDocument(),
    );
    expect(screen.queryByText("No active code blue events.")).not.toBeInTheDocument();
  });

  it("warns that paging is not confirmed when the page has not reported back", async () => {
    listCodes = async () => [
      code({ routing_note: null, delivery_warning: null, started_at: "2026-11-07T08:00:00Z" }),
    ];
    render(tab, { queryClient: silent() });
    await waitFor(() => expect(screen.getByText("Paging not confirmed")).toBeInTheDocument());
  });

  it("lets a manager see the code team on the roster", async () => {
    render(tab, { queryClient: silent() });
    await waitFor(() => expect(screen.getByText("Dr Meera Nair")).toBeInTheDocument());
    expect(screen.getByText("Tier 2: Duty medical officer")).toBeInTheDocument();
  });
});
