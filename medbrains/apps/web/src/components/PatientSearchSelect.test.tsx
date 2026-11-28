import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";

/**
 * Which lookup the picker calls is the whole decision here.
 *
 * `patients.list` is relationship-scoped: it answers with the patients this
 * user already has something to do with. A desk selecting a returning patient
 * registered by the morning shift got an empty list and registered them again.
 * With `patients.find` the picker asks the hospital instead — and a caller
 * without that code must NOT be silently sent to the wide endpoint, which
 * would 403 and read on screen as "no such patient".
 */
const held = new Set<string>();
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
  useHasAnyPermission: (codes: string[]) => codes.some((c) => held.has(c)),
  useFieldAccess: () => "edit",
}));

const findPatients = vi.fn(async () => []);
const listPatients = vi.fn(async () => ({ patients: [], total: 0, page: 1, per_page: 15 }));
vi.mock("@/services/lookups.service", () => ({
  lookupsService: {
    findPatients: (...args: unknown[]) => findPatients(...(args as [])),
    listPatients: (...args: unknown[]) => listPatients(...(args as [])),
  },
}));

vi.mock("@/services/patients.service", () => ({
  patientsService: {
    getSearchSettings: async () => ({
      default_by: "all",
      opd_number_enabled: true,
      patient_list_columns: "full",
    }),
  },
}));

const { PatientSearchSelect } = await import("./PatientSearchSelect");

/** Render the picker for a caller holding `codes`, with a remembered field. */
function renderPicker(codes: string[], withSearchBy: boolean, remembered?: string) {
  held.clear();
  for (const c of codes) held.add(c);
  findPatients.mockClear();
  listPatients.mockClear();
  localStorage.clear();
  if (remembered) localStorage.setItem("patient-search-by:anon", remembered);
  render(<PatientSearchSelect value="" onChange={() => {}} withSearchBy={withSearchBy} />);
}

/** Render the plain picker for a caller holding `codes`; returns the search box. */
function setup(codes: string[]) {
  renderPicker(codes, false);
  return screen.getByPlaceholderText(/search by name, phone, uhid or aadhaar/i);
}

describe("PatientSearchSelect", () => {
  it("asks the hospital when the caller holds patients.find", async () => {
    const input = setup(["patients.find"]);
    await userEvent.type(input, "ACM");
    await waitFor(() => expect(findPatients).toHaveBeenCalledWith("ACM", "all"));
    expect(listPatients).not.toHaveBeenCalled();
  });

  it("stays on the scoped list without that code", async () => {
    const input = setup(["patients.list"]);
    await userEvent.type(input, "ACM");
    await waitFor(() => expect(listPatients).toHaveBeenCalled());
    expect(findPatients).not.toHaveBeenCalled();
  });

  it("holds the hospital-wide lookup to three characters", async () => {
    const input = setup(["patients.find"]);
    await userEvent.type(input, "AC");
    await waitFor(() => expect(findPatients).not.toHaveBeenCalled());
  });

  it("looks up one or two bare digits under All as an exact UHID or OPD number", async () => {
    const input = setup(["patients.find"]);
    await userEvent.type(input, "1");
    await waitFor(() => expect(findPatients).toHaveBeenCalledWith("1", "all"));
  });

  it("offers Search by and searches a UHID from one character", async () => {
    renderPicker(["patients.find"], true, "uhid");
    expect(screen.getByTestId("patient-search-by")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("UHID"), "A");
    await waitFor(() => expect(findPatients).toHaveBeenCalledWith("A", "uhid"));
  });

  it("searches an OPD number from one character once the hospital keeps one", async () => {
    renderPicker(["patients.find"], true, "opd_number");
    await userEvent.type(await screen.findByPlaceholderText("OPD number"), "7");
    await waitFor(() => expect(findPatients).toHaveBeenCalledWith("7", "opd_number"));
  });

  it("ignores a remembered field when the picker has no selector", async () => {
    renderPicker(["patients.find"], false, "uhid");
    await userEvent.type(screen.getByPlaceholderText(/search by name/i), "A");
    await waitFor(() => expect(screen.getByDisplayValue("A")).toBeInTheDocument());
    expect(findPatients).not.toHaveBeenCalled();
  });

  it("asks nothing at all when the caller may not search patients", async () => {
    const input = setup([]);
    await userEvent.type(input, "ACM");
    await waitFor(() => expect(screen.getByDisplayValue("ACM")).toBeInTheDocument());
    expect(findPatients).not.toHaveBeenCalled();
    expect(listPatients).not.toHaveBeenCalled();
  });

  it("shows a failed lookup as a fault, never as 'no patient found'", async () => {
    const { ApiError } = await import("@medbrains/api");
    const input = setup(["patients.find"]);
    findPatients.mockRejectedValueOnce(new ApiError("forbidden", 403));
    await userEvent.type(input, "ACM");
    expect(await screen.findByText(/don.t have access/i)).toBeInTheDocument();
    expect(screen.queryByText(/no patient in the hospital/i)).not.toBeInTheDocument();
  });

  it("says the caller lacks access instead of answering every search with nothing", async () => {
    const input = setup([]);
    await userEvent.type(input, "ACM");
    expect(await screen.findByText(/ask an administrator for patients\.find/i)).toBeInTheDocument();
  });

  it("still offers registering a new patient when the name partly matches someone", async () => {
    // A fuzzy hit on "Ravi" is not the Ravi at the desk; registering must stay
    // one click away, not appear only when nobody at all matches.
    findPatients.mockResolvedValueOnce([
      { id: "p-1", uhid: "UH-1", first_name: "Ravichandran", last_name: "S" },
    ] as never);
    const input = setup(["patients.find", "patients.create"]);
    await userEvent.type(input, "Ravi");
    await waitFor(() => expect(screen.getByText(/Ravichandran/)).toBeInTheDocument());
    expect(screen.getByText("Register new patient")).toBeInTheDocument();
  });
});
