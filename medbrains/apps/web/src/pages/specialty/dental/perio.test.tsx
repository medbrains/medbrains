import { usePermissionStore } from "@medbrains/stores";
import { type DentalExam, P, type PerioChart } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { PerioTab } from "./PerioTab";
import { isMultiRooted } from "./PerioToothForm";

const list = vi.fn();
const record = vi.fn();
vi.mock("@/services/specialty.service", () => ({
  specialtyService: {
    listPatientPerioCharts: (id: string) => list(id),
    recordPerioChart: (id: string, body: unknown) => record(id, body),
  },
}));

const exam = { id: "e1", patient_id: "p1", status: "open" } as DentalExam;
const chart = (id: string, changes: PerioChart["changes_since_previous"]): PerioChart => ({
  id,
  exam_id: "e1",
  recorded_by_name: "Dr Rao",
  created_at: "2026-10-01T10:00:00Z",
  notes: null,
  teeth: [],
  summary: {
    teeth_present: 28,
    sites_probed: 168,
    bleeding_percent: 18.5,
    sites_4mm_or_more: 12,
    sites_6mm_or_more: 3,
    mean_probing_mm: 2.9,
    mean_attachment_level_mm: 3.4,
  },
  changes_since_previous: changes,
});

beforeEach(() => {
  list.mockReset();
  record.mockReset();
  usePermissionStore
    .getState()
    .setPermissions("doctor", [P.SPECIALTY.DENTAL.PERIO_LIST, P.SPECIALTY.DENTAL.PERIO_RECORD]);
});

describe("periodontal chart", () => {
  it("knows which teeth have a furcation", () => {
    for (const t of ["16", "26", "36", "47", "14", "24", "54", "85"])
      expect(isMultiRooted(t)).toBe(true);
    for (const t of ["11", "13", "15", "34", "44", "51", "53"])
      expect(isMultiRooted(t)).toBe(false);
  });

  it("shows the latest chart against the previous one, deeper sites flagged", async () => {
    list.mockResolvedValue([
      chart("c2", [{ tooth: "36", site: "B", before_mm: 3, after_mm: 6 }]),
      chart("c1", []),
    ]);
    render(<PerioTab exam={exam} />);
    expect(await screen.findByText(/latest chart/i)).toBeInTheDocument();
    expect(screen.getByText(/previous chart/i)).toBeInTheDocument();
    expect(screen.getByText("Deeper by 3 mm")).toBeInTheDocument();
  });

  it("records a tooth's sites and saves the chart", async () => {
    list.mockResolvedValue([]);
    record.mockResolvedValue("c3");
    render(<PerioTab exam={exam} />);
    await userEvent.click(await screen.findByRole("button", { name: /tooth 16/i }));
    await userEvent.type(screen.getByLabelText(/probing, buccal \(mm\)/i), "5");
    await userEvent.click(screen.getByLabelText(/bleeding, buccal/i));
    await userEvent.click(screen.getByRole("button", { name: /add to chart/i }));
    await userEvent.click(screen.getByRole("button", { name: /save chart/i }));
    const [, body] = record.mock.calls[0] as [
      string,
      { teeth: { tooth: string; probing: (number | null)[]; bleeding: boolean[] }[] },
    ];
    expect(body.teeth[0].tooth).toBe("16");
    expect(body.teeth[0].probing[1]).toBe(5);
    expect(body.teeth[0].bleeding[1]).toBe(true);
  });

  it("offers no recording to someone who may only read charts", async () => {
    usePermissionStore.getState().setPermissions("doctor", [P.SPECIALTY.DENTAL.PERIO_LIST]);
    list.mockResolvedValue([]);
    render(<PerioTab exam={exam} />);
    expect(await screen.findByText(/no periodontal chart/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save chart/i })).not.toBeInTheDocument();
  });
});
