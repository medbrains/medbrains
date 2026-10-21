import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

/**
 * One order's result values, as the patient's Lab Orders tab and the OPD
 * investigations tab both show them.
 */
const value = (over: Record<string, unknown>) => ({
  id: "r1",
  tenant_id: "t",
  order_id: "o1",
  parameter_name: "Haemoglobin",
  value: "9.1",
  unit: "g/dL",
  normal_range: "12-16",
  flag: "low",
  notes: null,
  previous_value: null,
  delta_percent: null,
  is_delta_flagged: false,
  is_auto_validated: false,
  entered_by: null,
  updated_at: "2026-10-20T09:00:00Z",
  created_at: "2026-10-20T09:00:00Z",
  ...over,
});

let detail: () => Promise<unknown> = async () => ({});

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return { ...actual, api: { ...actual.api, getLabOrder: () => detail() } };
});
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));

const { LabOrderResults } = await import("./LabOrderResults");

const silent = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

describe("lab order results", () => {
  beforeEach(() => {
    detail = async () => ({
      order: { id: "o1", status: "completed" },
      results: [
        value({}),
        value({ id: "r2", parameter_name: "WBC", value: "7.0", flag: "normal" }),
        value({ id: "r3", parameter_name: "Platelets", value: "620", flag: "high" }),
      ],
      test: null,
    });
  });

  it("renders every value with unit, range and a worded flag", async () => {
    render(<LabOrderResults orderId="o1" />, { queryClient: silent() });

    expect(await screen.findByText("9.1 g/dL")).toBeInTheDocument();
    expect(screen.getAllByText("12-16")).toHaveLength(3);
    // Never colour alone: each flag reads as text.
    expect(screen.getByText("Low (L)")).toBeInTheDocument();
    expect(screen.getByText("High (H)")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("marks unverified values as provisional", async () => {
    render(<LabOrderResults orderId="o1" />, { queryClient: silent() });
    expect(await screen.findByText(/not yet verified/i)).toBeInTheDocument();
  });

  it("says the read failed rather than that there are no values", async () => {
    detail = async () => {
      throw new Error("404");
    };
    render(<LabOrderResults orderId="o1" />, { queryClient: silent() });
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/no result values/i)).not.toBeInTheDocument();
  });
});
