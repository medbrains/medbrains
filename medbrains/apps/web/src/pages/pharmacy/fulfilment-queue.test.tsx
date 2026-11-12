import { ApiError } from "@medbrains/api";
import type { FulfilmentQueueRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";

const state = vi.hoisted(() => ({
  claims: [] as Record<string, unknown>[],
  refuseUnacknowledged: true,
}));

vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => code === P.PHARMACY.FULFILMENT.PICK,
  useHasAnyPermission: () => false,
}));

const row = {
  id: "o1",
  status: "ordered",
  patient_id: "p1",
  patient_name: "Meena S",
  uhid: "UH-9",
  token_number: "T-12",
  store_location_id: null,
  created_at: "2026-11-10T08:00:00Z",
  line_count: 2,
  unverified_lines: 0,
  near_expiry_lines: 1,
} as unknown as FulfilmentQueueRow;

vi.mock("@/services/pharmacy.service", () => ({
  pharmacyService: {
    listFulfilmentQueue: () => Promise.resolve([row]),
    claimFulfilmentOrder: (_id: string, body: Record<string, unknown>) => {
      state.claims.push(body);
      if (state.refuseUnacknowledged && !body.allergy_status_acknowledged) {
        return Promise.reject(
          new ApiError("This patient's allergy status is unknown: ask first", 400),
        );
      }
      return Promise.resolve({ status: "picking" });
    },
  },
}));

const { FulfilmentQueuePage } = await import("./fulfilment-queue");

const quietClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

describe("claiming an order whose patient's allergies nobody recorded", () => {
  beforeEach(() => {
    state.claims = [];
    state.refuseUnacknowledged = true;
  });

  it("asks the picker to check with the patient, then claims with the acknowledgement", async () => {
    render(<FulfilmentQueuePage />, { queryClient: quietClient() });
    expect(await screen.findByText("short-dated")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Claim" }));
    expect(await screen.findByText("Allergy status unknown for T-12")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I asked the patient, claim" }));
    await waitFor(() => expect(state.claims).toHaveLength(2));
    expect(state.claims[0]).toEqual({});
    expect(state.claims[1]).toEqual({ allergy_status_acknowledged: true });
  });

  it("claims nothing when the picker keeps the order", async () => {
    render(<FulfilmentQueuePage />, { queryClient: quietClient() });
    await userEvent.click(await screen.findByRole("button", { name: "Claim" }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep the order" }));
    expect(state.claims).toHaveLength(1);
  });
});
