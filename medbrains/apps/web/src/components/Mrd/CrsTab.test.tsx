import type { CrsEvent } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { CrsTab, daysLeft, recordedIn } from "./CrsTab";

const service = vi.hoisted(() => ({
  listCrsEvents: vi.fn(),
  getCrsForm: vi.fn(),
  recordCrsRegistration: vi.fn(),
}));
vi.mock("@/services/mrd.service", () => ({ mrdService: service }));

const death: CrsEvent = {
  id: "e1",
  event_type: "death",
  patient_id: "p1",
  uhid: "UH-9",
  patient_name: "Ravi Kumar",
  event_date: "2026-09-01",
  baby_sex: null,
  due_on: "2026-09-22",
  status: "pending",
  crs_registration_number: null,
  registered_on: null,
  from_maternity: false,
  in_birth_register: false,
  mccd_form: "form_4",
  in_death_register: true,
};

describe("daysLeft", () => {
  it("counts whole days to the due date, negative once past", () => {
    const today = new Date(2026, 9, 26);
    expect(daysLeft("2026-10-30", today)).toBe(4);
    expect(daysLeft("2026-10-20", today)).toBe(-6);
  });
});

describe("recordedIn", () => {
  it("names the books the event is in", () => {
    expect(recordedIn(death)).toBe("MCCD Form 4 · Death register");
  });
});

describe("CrsTab", () => {
  it("shows the duty, what is overdue, and lays out the report on request", async () => {
    service.listCrsEvents.mockResolvedValue([death]);
    service.getCrsForm.mockResolvedValue({
      event_id: "e1",
      form: "Form 2 — Death report",
      due_on: "2026-09-22",
      fields: [
        { label: "Date of death", value: "01/09/2026" },
        { label: "Religion", value: null },
      ],
    });
    render(<CrsTab canManage />);
    expect(screen.getByText("The hospital reports every birth and death")).toBeInTheDocument();
    expect(await screen.findByText(/days overdue/)).toBeInTheDocument();
    expect(service.getCrsForm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "CRS report" }));
    expect(await screen.findByText("01/09/2026")).toBeInTheDocument();
    expect(screen.getByText("1 field to fill on the portal")).toBeInTheDocument();
  });

  it("will not record a registration without its number", async () => {
    service.listCrsEvents.mockResolvedValue([death]);
    render(<CrsTab canManage />);
    await userEvent.click(await screen.findByRole("button", { name: "Record registration" }));
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Give the registration number CRS issued")).toBeInTheDocument();
    expect(service.recordCrsRegistration).not.toHaveBeenCalled();
  });

  it("offers no recording without the permission", async () => {
    service.listCrsEvents.mockResolvedValue([death]);
    render(<CrsTab canManage={false} />);
    await screen.findByText("Ravi Kumar");
    expect(screen.queryByRole("button", { name: "Record registration" })).toBeNull();
  });
});
