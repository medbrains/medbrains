import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";

/**
 * No free text at OTC or POS (owner, 2026-11-09): a medicine the search does
 * not find is added to the catalogue first, by someone allowed to. The
 * "Add to catalogue" action is offered only to a holder of
 * `pharmacy.stock.manage`, the permission POST /pharmacy/catalog requires;
 * everyone else is told who can add it, and nobody can type the line instead.
 */
const held = new Set<string>();
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
  useFieldAccess: () => "edit",
}));

const listPharmacyCatalog = vi.fn(async () => []);
vi.mock("@/services/lookups.service", () => ({
  lookupsService: {
    listPharmacyCatalog: (...args: unknown[]) => listPharmacyCatalog(...(args as [])),
  },
}));

const { DrugSearchSelect } = await import("./DrugSearchSelect");

/** Searches for a medicine the catalogue does not hold, holding `codes`. */
async function searchForMissing(codes: string[]) {
  held.clear();
  for (const c of codes) held.add(c);
  render(<DrugSearchSelect value="" onChange={() => {}} />);
  await userEvent.type(screen.getByPlaceholderText(/search by drug name/i), "Zincovit");
  expect(await screen.findByText("Not in the catalogue")).toBeInTheDocument();
}

describe("DrugSearchSelect, nothing found", () => {
  it("offers Add to catalogue, with the name typed, to a catalogue manager", async () => {
    await searchForMissing(["pharmacy.stock.manage"]);
    await userEvent.click(await screen.findByText("Add to catalogue"));
    expect(await screen.findByText("Add to the catalogue")).toBeInTheDocument();
    expect(await screen.findByLabelText(/drug name/i)).toHaveValue("Zincovit");
    expect(screen.queryByText("Ask a pharmacist to add it.")).not.toBeInTheDocument();
    // The schedule has no default: it is stated, not assumed OTC.
    await userEvent.click(screen.getByText("Add & select"));
    expect(await screen.findByText("Choose the drug schedule")).toBeInTheDocument();
  });

  it("tells a counter user without the permission to ask a pharmacist", async () => {
    await searchForMissing(["pharmacy.pos.create"]);
    expect(screen.getByText("Ask a pharmacist to add it.")).toBeInTheDocument();
    expect(screen.queryByText("Add to catalogue")).not.toBeInTheDocument();
  });
});
