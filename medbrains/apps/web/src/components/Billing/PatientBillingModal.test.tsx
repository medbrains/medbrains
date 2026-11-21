import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";
const invoice = (id: string) => ({
  id,
  invoice_number: `INV-${id}`,
  status: "issued",
  total_amount: "200",
  paid_amount: "0",
});

vi.mock("@/services/billing.service", () => ({
  billingService: {
    listInvoices: () => Promise.resolve({ invoices: [invoice("a"), invoice("b")], total: 2 }),
    createInvoice: vi.fn(),
  },
}));

const { PatientBillingModal } = await import("./PatientBillingModal");

describe("PatientBillingModal cache", () => {
  it("does not share a cache entry with the patient record's invoice list", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    // What the patient record leaves behind: a plain array of invoice rows.
    const recordRows = [invoice("x")];
    queryClient.setQueryData(["patient-invoices", PATIENT_ID], recordRows);

    render(<PatientBillingModal patientId={PATIENT_ID} opened onClose={vi.fn()} />, {
      queryClient,
    });

    expect(await screen.findByText("2 invoices for this patient")).toBeInTheDocument();
    // The record's rows are still the record's: the modal wrote its own entry.
    expect(queryClient.getQueryData(["patient-invoices", PATIENT_ID])).toBe(recordRows);

    // Money moving elsewhere still refreshes the modal's list through the prefix.
    const modalEntry = () =>
      queryClient
        .getQueryCache()
        .findAll({ queryKey: ["patient-invoices", PATIENT_ID] })
        .find((q) => q.queryKey.length > 2);
    expect(modalEntry()).toBeDefined();
    await queryClient.invalidateQueries({ queryKey: ["patient-invoices", PATIENT_ID] });
    expect(modalEntry()?.state.dataUpdateCount).toBe(2);
  });
});
