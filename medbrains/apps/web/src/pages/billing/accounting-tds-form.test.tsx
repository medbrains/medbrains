import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { GstTdsTab } from "./accounting-tabs";

const billing = vi.hoisted(() => ({
  listGstrSummaries: vi.fn(() => Promise.resolve([])),
  listTdsDeductions: vi.fn(() => Promise.resolve([])),
  createTdsDeduction: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => code === "billing.tds.manage",
}));
vi.mock("@/services/billing.service", () => ({ billingService: billing }));

afterEach(() => vi.clearAllMocks());

describe("Record TDS", () => {
  it("reports a deduction in the year and quarter its date falls in, whatever the date", async () => {
    render(<GstTdsTab canTds />);
    await userEvent.click(await screen.findByText("TDS Management"));
    await userEvent.click(await screen.findByRole("button", { name: /Record TDS/ }));

    const reported = (await screen.findByLabelText(/Reported in/)) as HTMLInputElement;
    expect(reported.readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText(/Deducted Date/), { target: { value: "2027-01-10" } });
    expect(reported.value).toBe("2026-27 Q4");

    await userEvent.type(screen.getByLabelText(/Deductee Name/), "Dr Visiting");
    await userEvent.type(screen.getByLabelText(/^PAN/), "abcde1234f");
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() => expect(billing.createTdsDeduction).toHaveBeenCalled());
    expect(billing.createTdsDeduction.mock.calls[0]?.[0]).toMatchObject({
      deducted_date: "2027-01-10",
      financial_year: "2026-27",
      quarter: "Q4",
      deductee_pan: "ABCDE1234F",
    });
  });
});
