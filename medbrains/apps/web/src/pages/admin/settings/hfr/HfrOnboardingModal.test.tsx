import type { FacilityHfr, HfrOnboardingDraft } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { HfrOnboardingModal } from "./HfrOnboardingModal";

const service = vi.hoisted(() => ({
  getHfrOnboarding: vi.fn(),
  getHfrMaster: vi.fn(),
  searchHfrFacilities: vi.fn(),
  linkFacilityHfr: vi.fn(),
  signInHpr: vi.fn(),
  saveHfrBasic: vi.fn(),
  saveHfrAdditional: vi.fn(),
  saveHfrDetailed: vi.fn(),
  submitHfrFacility: vi.fn(),
}));
vi.mock("@/services/abdmRegistry.service", () => ({ abdmRegistryService: service }));

const campus: FacilityHfr = {
  id: "fac-1",
  code: "MAIN",
  name: "Sahyadri Hospital",
  facility_type: "main_hospital",
  bed_count: 40,
  is_active: true,
  hfr_facility_id: null,
  hfr_status: "not_registered",
  hfr_bed_count: null,
  hfr_ipd: false,
  hfr_checked_at: null,
  dhis_eligible: false,
};

const fresh: HfrOnboardingDraft = {
  registry_configured: true,
  tracking_id: null,
  hfr_status: "not_registered",
  hfr_facility_id: null,
  basic: null,
  additional: null,
  detailed: null,
  submitted_at: null,
  hpr_sessions: [],
};

/** Render the modal for `campus`. */
function open() {
  render(<HfrOnboardingModal facility={campus} hfrListKey={["hfr"]} onClose={() => {}} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  service.getHfrMaster.mockResolvedValue([{ code: "P", name: "Private" }]);
});

describe("HfrOnboardingModal (#5716)", () => {
  it("starts with the HFR search, and offers register-new only after a search ran", async () => {
    service.getHfrOnboarding.mockResolvedValue(fresh);
    service.searchHfrFacilities.mockResolvedValue({ facilities: [], total: 0 });
    open();
    expect(await screen.findByRole("button", { name: "Search HFR" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /register this campus/ })).toBeNull();
    await userEvent.type(screen.getByLabelText("HFR facility ID"), "IN2710000123");
    await userEvent.click(screen.getByRole("button", { name: "Search HFR" }));
    expect(
      await screen.findByText("HFR lists no facility that matches this search."),
    ).toBeVisible();
    expect(service.searchHfrFacilities).toHaveBeenCalledWith(
      expect.objectContaining({ facilityId: "IN2710000123" }),
    );
    expect(screen.getByRole("button", { name: /register this campus/ })).toBeEnabled();
  });

  it("refuses a malformed facility ID on the screen, sending nothing (HFR-001)", async () => {
    service.getHfrOnboarding.mockResolvedValue(fresh);
    open();
    await userEvent.type(await screen.findByLabelText("HFR facility ID"), "XX12");
    await userEvent.click(screen.getByRole("button", { name: "Search HFR" }));
    expect(await screen.findByText(/HFR-001/)).toBeVisible();
    expect(service.searchHfrFacilities).not.toHaveBeenCalled();
  });

  it("shows a failed search as a failure, never as 'no facility found'", async () => {
    service.getHfrOnboarding.mockResolvedValue(fresh);
    service.searchHfrFacilities.mockRejectedValue(new Error("ABDM registry unavailable"));
    open();
    await userEvent.type(await screen.findByLabelText("HFR facility ID"), "IN2710000123");
    await userEvent.click(screen.getByRole("button", { name: "Search HFR" }));
    expect(await screen.findByText("HFR search did not answer")).toBeVisible();
    expect(screen.queryByText(/lists no facility/)).toBeNull();
    expect(screen.queryByRole("button", { name: /register this campus/ })).toBeNull();
  });

  it("says the draft failed to load instead of showing an empty form", async () => {
    service.getHfrOnboarding.mockRejectedValue(new Error("boom"));
    open();
    expect(await screen.findByText("Could not load this campus's HFR record")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Search HFR" })).toBeNull();
  });

  it("resumes a campus with a tracking ID at basic information, behind the HPR sign-in", async () => {
    service.getHfrOnboarding.mockResolvedValue({ ...fresh, tracking_id: "80266" });
    open();
    expect(await screen.findByText("Tracking ID 80266")).toBeVisible();
    expect(screen.getByText("Facility manager: sign in to HPR")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in to HPR to save" })).toBeDisabled();
  });

  it("keeps the HPR password off the page once signed in", async () => {
    service.getHfrOnboarding.mockResolvedValue({ ...fresh, tracking_id: "80266" });
    service.signInHpr.mockResolvedValue({
      role: "manager",
      hpr_id: "manager@hpr.abdm",
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    });
    open();
    await userEvent.type(await screen.findByLabelText("HPR ID"), "manager@hpr.abdm");
    await userEvent.type(screen.getByLabelText("HPR password"), "secret-pass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in to HPR" }));
    await waitFor(() => expect(screen.getByText(/signed in to HPR as/)).toBeVisible());
    expect(service.signInHpr).toHaveBeenCalledWith({
      role: "manager",
      hpr_id: "manager@hpr.abdm",
      password: "secret-pass",
    });
    expect(screen.queryByDisplayValue("secret-pass")).toBeNull();
    expect(screen.getByRole("button", { name: "Save basic information" })).toBeEnabled();
  });

  it("asks for ABDM keys instead of offering a flow that cannot run", async () => {
    service.getHfrOnboarding.mockResolvedValue({ ...fresh, registry_configured: false });
    open();
    expect(await screen.findByText("ABDM keys are not configured")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Search HFR" })).toBeNull();
  });
});
