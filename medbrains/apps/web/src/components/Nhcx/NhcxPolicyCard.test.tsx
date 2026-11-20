import { P } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { NhcxPolicyCard } from "./NhcxPolicyCard";

/**
 * The registry's policies for a patient, with who processes each: a TPA
 * policy names the TPA as where messages go. An outage reads as unknown,
 * never as "no policies", and without the permission nothing is fetched.
 */
const held = vi.hoisted(() => ({ permissions: new Set<string>() }));
const mocks = vi.hoisted(() => ({ list: vi.fn(), lookup: vi.fn() }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => held.permissions.has(code),
}));
vi.mock("@medbrains/api", () => ({
  api: { listNhcxPatientPolicies: mocks.list, lookupNhcxPatientPolicies: mocks.lookup },
}));

const TPA_POLICY = {
  id: "1",
  identifier_type: "AbhaNumber",
  payer_id: "1518@hcx",
  payer_name: "State Health Agency",
  processing_id: "1000000109@hcx",
  processor_name: "Medi TPA",
  member_id: "MD5SLS4X5",
  product_id: "PMJAY/HP/S/G",
  product_name: "PMJAY Himachal Pradesh",
  fetched_at: "2026-11-15T09:00:00Z",
};

describe("NhcxPolicyCard", () => {
  beforeEach(() => {
    held.permissions = new Set([P.INSURANCE.NHCX.LOOKUP_POLICIES]);
    mocks.list.mockReset().mockResolvedValue({ patient_id: "pt", policies: [], note: null });
    mocks.lookup
      .mockReset()
      .mockResolvedValue({ patient_id: "pt", policies: [TPA_POLICY], note: null });
  });

  it("looks the patient up and shows the TPA that processes the policy", async () => {
    render(<NhcxPolicyCard patientId="pt" />);
    await userEvent.click(await screen.findByRole("button", { name: "Find policies by ABHA" }));
    expect(mocks.lookup).toHaveBeenCalledWith("pt");
    expect(await screen.findByText("1000000109@hcx")).toBeVisible();
    expect(screen.getByText("TPA")).toBeVisible();
    expect(screen.getByText("PMJAY Himachal Pradesh")).toBeVisible();
  });

  it("says the policies are unknown when the list cannot load", async () => {
    mocks.list.mockRejectedValue(new Error("down"));
    render(<NhcxPolicyCard patientId="pt" />);
    expect(await screen.findByText("Could not load the patient's NHCX policies")).toBeVisible();
  });

  it("fetches nothing without the permission", () => {
    held.permissions = new Set();
    render(<NhcxPolicyCard patientId="pt" />);
    expect(screen.queryByRole("button", { name: "Find policies by ABHA" })).toBeNull();
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
