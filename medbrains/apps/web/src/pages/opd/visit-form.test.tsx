import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

const department = (id: string, name: string) => ({
  id,
  name,
  code: "GEN",
  department_type: "clinical",
  is_active: true,
});
const listDepartments = vi.fn();
const createEncounter = vi.fn();
vi.mock("@/services/opd.service", () => ({
  opdService: {
    listDepartments: () => listDepartments(),
    getLastOpdVisit: () => Promise.resolve(null),
    createEncounter: (req: unknown) => createEncounter(req),
  },
}));
vi.mock("@/services/camp.service", () => ({
  campService: { listCamps: () => Promise.resolve([]) },
}));
vi.mock("@/services/ipd.service", () => ({
  ipdService: { listAdmissions: () => Promise.resolve({ admissions: [] }) },
}));
vi.mock("@/components", () => ({
  DoctorSearchSelect: () => null,
  PatientSearchSelect: () => null,
  useClinicalEmit: () => vi.fn(),
}));
vi.mock("@/components/payments/collect/use-collect-at-checkin", () => ({
  useCollectAtCheckIn: () => vi.fn(),
}));

const { OpdVisitForm } = await import("./visit-form");

/** Renders the form for a chosen patient. */
const renderForm = () =>
  render(<OpdVisitForm initialPatientId="p-1" onCancel={vi.fn()} onCreated={vi.fn()} />);

describe("OpdVisitForm department", () => {
  it("shows the picker while the departments load", () => {
    listDepartments.mockReturnValue(new Promise(() => {}));
    renderForm();
    expect(screen.getByRole("combobox", { name: /^Department/ })).toBeInTheDocument();
  });

  it("hides the picker in a one-department hospital and books into that department", async () => {
    listDepartments.mockResolvedValue([department("d-gen", "General")]);
    createEncounter.mockReturnValue(new Promise(() => {}));
    renderForm();
    await waitFor(() =>
      expect(screen.queryByRole("combobox", { name: /^Department/ })).not.toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Create Visit" }));
    await waitFor(() => expect(createEncounter).toHaveBeenCalled());
    expect(createEncounter.mock.calls[0][0]).toMatchObject({ department_id: "d-gen" });
  });

  it("keeps the required picker when there are several departments", async () => {
    listDepartments.mockResolvedValue([department("d-1", "General"), department("d-2", "Ortho")]);
    createEncounter.mockClear();
    renderForm();
    await waitFor(() => expect(listDepartments).toHaveBeenCalled());
    const picker = await screen.findByRole("combobox", { name: /^Department/ });
    expect(picker).toBeRequired();
    await userEvent.click(screen.getByRole("button", { name: "Create Visit" }));
    // The required picker blocks the submit until a department is chosen.
    expect(createEncounter).not.toHaveBeenCalled();
  });

  it("says the departments failed to load rather than offering an empty picker", async () => {
    listDepartments.mockRejectedValue(new Error("Request failed: 500"));
    renderForm();
    expect(
      await screen.findByText(
        "Departments could not be loaded. Reload the page to try again.",
        undefined,
        {
          timeout: 10_000,
        },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Department/ })).toBeInTheDocument();
  });
});
