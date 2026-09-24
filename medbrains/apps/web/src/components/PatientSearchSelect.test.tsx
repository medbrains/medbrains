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

const { PatientSearchSelect } = await import("./PatientSearchSelect");

function setup(codes: string[]) {
  held.clear();
  for (const c of codes) held.add(c);
  findPatients.mockClear();
  listPatients.mockClear();
  render(<PatientSearchSelect value="" onChange={() => {}} />);
  return screen.getByPlaceholderText(/search by name, uhid, or phone/i);
}

describe("PatientSearchSelect", () => {
  it("asks the hospital when the caller holds patients.find", async () => {
    const input = setup(["patients.find"]);
    await userEvent.type(input, "ACM");
    await waitFor(() => expect(findPatients).toHaveBeenCalledWith("ACM"));
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

  it("asks nothing at all when the caller may not search patients", async () => {
    const input = setup([]);
    await userEvent.type(input, "ACM");
    await waitFor(() => expect(screen.getByDisplayValue("ACM")).toBeInTheDocument());
    expect(findPatients).not.toHaveBeenCalled();
    expect(listPatients).not.toHaveBeenCalled();
  });
});
