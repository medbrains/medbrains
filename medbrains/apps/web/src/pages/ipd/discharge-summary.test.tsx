import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";

const state = vi.hoisted(() => ({
  signed: true,
  updates: [] as Record<string, unknown>[],
  confirms: [] as { title: string; onConfirm: () => void }[],
}));

vi.mock("@/components", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useClinicalEmit: () => () => {},
}));
vi.mock("@/components/Signatures/SignRecordButton", () => ({ SignRecordButton: () => null }));
vi.mock("@/lib/confirm-destructive", () => ({
  confirmDestructive: (opts: { title: string; onConfirm: () => void }) => state.confirms.push(opts),
}));
vi.mock("@/services/ipd.service", () => ({
  ipdService: {
    getDischargeSummary: () =>
      Promise.resolve({
        id: "s1",
        admission_id: "a1",
        status: "draft",
        is_signed: state.signed,
        prepared_by: "u1",
        verified_by: null,
        final_diagnosis: "Community-acquired pneumonia",
        medications_on_discharge: [
          { catalog_item_id: "c1", drug_name: "Amoxicillin", quantity: 15, instructions: "TDS" },
          { buy_outside: true, drug_name: "Nebuliser", quantity: 1 },
        ],
      }),
    updateDischargeSummary: (_id: string, body: Record<string, unknown>) => {
      state.updates.push(body);
      return Promise.resolve({});
    },
  },
}));

const { DischargeSummaryTab } = await import("./discharge-summary");

const quietClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

/** Opens the summary for editing and presses Save without changes. */
async function editAndSave() {
  render(<DischargeSummaryTab admissionId="a1" canCreate patientId="p1" />, {
    queryClient: quietClient(),
  });
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
}

describe("the discharge summary", () => {
  beforeEach(() => {
    state.signed = true;
    state.updates = [];
    state.confirms = [];
  });

  it("lists a buy-outside medicine as such, as the patient will read it", async () => {
    render(<DischargeSummaryTab admissionId="a1" canCreate patientId="p1" />, {
      queryClient: quietClient(),
    });
    expect(await screen.findByText(/Amoxicillin × 15 — TDS/)).toBeInTheDocument();
    expect(screen.getByText(/Nebuliser × 1 — Buy from outside the hospital/)).toBeInTheDocument();
    expect(screen.getByText("Signed")).toBeInTheDocument();
  });

  it("saves a signed summary only after warning that the signature comes off", async () => {
    await editAndSave();
    expect(state.confirms.map((c) => c.title)).toEqual(["Remove the signature?"]);
    expect(state.updates).toEqual([]);
    state.confirms[0]?.onConfirm();
    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]?.medications_on_discharge).toHaveLength(2);
  });

  it("saves an unsigned draft straight away", async () => {
    state.signed = false;
    await editAndSave();
    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.confirms).toEqual([]);
  });
});
