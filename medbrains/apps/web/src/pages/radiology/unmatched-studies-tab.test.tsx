import type { UnmatchedStudy } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { UnmatchedStudiesTab } from "./unmatched-studies-tab";

const service = vi.hoisted(() => ({
  listUnmatchedStudies: vi.fn(),
  dismissUnmatchedStudy: vi.fn(),
  linkUnmatchedStudy: vi.fn(),
  listRadiologyOrders: vi.fn(),
}));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));

const WALK_IN: UnmatchedStudy = {
  id: "u1",
  orthanc_id: "o1",
  study_instance_uid: "1.2.3",
  accession_number: null,
  dicom_patient_id: "WALK-01",
  dicom_patient_name: "Rao Meena",
  dicom_birth_date: "1980-03-09",
  dicom_sex: "F",
  modality: "DX",
  study_date: "2026-10-26",
  study_description: "Chest PA",
  instance_count: 1,
  series_count: 1,
  status: "open",
  linked_order_id: null,
  resolution_note: null,
  resolved_by: null,
  resolved_at: null,
  created_at: "2026-10-26T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  service.listUnmatchedStudies.mockResolvedValue([WALK_IN]);
  service.dismissUnmatchedStudy.mockResolvedValue({ ...WALK_IN, status: "dismissed" });
});

describe("UnmatchedStudiesTab", () => {
  it("lists what the images say, open studies first", async () => {
    render(<UnmatchedStudiesTab />);
    expect(await screen.findByText("Rao Meena · WALK-01 · 1980-03-09 · F")).toBeInTheDocument();
    expect(service.listUnmatchedStudies).toHaveBeenCalledWith("open");
    expect(screen.getByRole("button", { name: "File under order" })).toBeInTheDocument();
  });

  it("dismisses a stray study only with a reason", async () => {
    render(<UnmatchedStudiesTab />);
    await userEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
    const confirm = screen.getAllByRole("button", { name: "Dismiss" }).at(-1);
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Reason/), "QA phantom");
    if (confirm) await userEvent.click(confirm);
    await waitFor(() =>
      expect(service.dismissUnmatchedStudy).toHaveBeenCalledWith("u1", "QA phantom"),
    );
  });

  it("shows the note a resolved study was filed with", async () => {
    service.listUnmatchedStudies.mockImplementation(async (status: string) =>
      status === "linked"
        ? [{ ...WALK_IN, status: "linked", resolution_note: "Confirmed DOB with patient" }]
        : [],
    );
    render(<UnmatchedStudiesTab />);
    await userEvent.click(screen.getByText("Filed"));
    expect(await screen.findByText("Confirmed DOB with patient")).toBeInTheDocument();
  });
});
