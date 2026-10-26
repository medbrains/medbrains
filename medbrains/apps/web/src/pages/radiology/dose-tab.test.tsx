import type { CumulativeDoseResult, RadiationDoseRecord } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { DoseTab } from "./dose-tab";

const service = vi.hoisted(() => ({
  cumulativeDose: vi.fn(),
  recordRadiationDose: vi.fn(),
  markRadiationDoseEnteredInError: vi.fn(),
}));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const CT: RadiationDoseRecord = {
  id: "d1",
  tenant_id: "t",
  order_id: "o1",
  patient_id: "p1",
  modality_code: "CT",
  body_part: null,
  dose_value: null,
  dose_unit: "mGy",
  dlp: "812.4000",
  ctdi_vol: "14.9000",
  dap: null,
  fluoroscopy_time_seconds: null,
  exposure_count: null,
  kvp: null,
  mas: null,
  source: "rdsr",
  dicom_study_id: "s1",
  recorded_by: null,
  recorded_at: "2026-10-20T10:00:00Z",
  created_at: "2026-10-20T10:00:00Z",
};

const HIGH: CumulativeDoseResult = {
  study_count: 9,
  cumulative_dlp: 7000,
  estimated_effective_msv: 105,
  review_threshold_msv: 100,
  over_threshold: true,
  near_threshold: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  held.clear();
  held.add("radiology.orders.view");
  service.cumulativeDose.mockResolvedValue(HIGH);
  service.recordRadiationDose.mockResolvedValue(CT);
  service.markRadiationDoseEnteredInError.mockResolvedValue(CT);
});

describe("DoseTab", () => {
  it("shows a scanner-read dose with its units and the cumulative warning", async () => {
    render(<DoseTab orderId="o1" patientId="p1" records={[CT]} />);
    expect(screen.getByText("14.9 mGy CTDIvol · 812.4 mGy·cm DLP")).toBeInTheDocument();
    expect(screen.getByText("Scanner dose report")).toBeInTheDocument();
    expect(
      await screen.findByText(/Cumulative radiation ≈ 105 mSv over 9 CT studies/),
    ).toBeInTheDocument();
    // Without radiology.dose.record: no form, no correction.
    expect(screen.queryByRole("form", { name: "Record radiation dose" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entered in error" })).not.toBeInTheDocument();
  });

  it("refuses an empty dose and records a CT dose", async () => {
    held.add("radiology.dose.record");
    render(<DoseTab orderId="o1" patientId="p1" records={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Record dose" }));
    expect(await screen.findByText("Enter at least one dose figure")).toBeInTheDocument();
    expect(service.recordRadiationDose).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("CTDIvol (mGy)"), "14.9");
    await userEvent.type(screen.getByLabelText("DLP (mGy·cm)"), "812.4");
    await userEvent.click(screen.getByRole("button", { name: "Record dose" }));
    await waitFor(() =>
      expect(service.recordRadiationDose).toHaveBeenCalledWith("o1", {
        ctdi_vol: 14.9,
        dlp: 812.4,
      }),
    );
  });

  it("marks a wrong figure as entered in error only with a reason", async () => {
    held.add("radiology.dose.record");
    render(<DoseTab orderId="o1" patientId="p1" records={[CT]} />);
    await userEvent.click(screen.getByRole("button", { name: "Entered in error" }));
    const confirm = screen.getByRole("button", { name: "Mark entered in error" });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason/), "Wrong patient's scan");
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(service.markRadiationDoseEnteredInError).toHaveBeenCalledWith(
        "d1",
        "Wrong patient's scan",
      ),
    );
  });
});
