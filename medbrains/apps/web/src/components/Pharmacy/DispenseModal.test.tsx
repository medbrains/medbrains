import { MantineProvider } from "@mantine/core";
import type { PharmacyCatalog, PharmacyOrderItem } from "@medbrains/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DispenseModal } from "./DispenseModal";

const catalog = vi.hoisted(() => ({ rows: [] as Partial<PharmacyCatalog>[], pending: false }));
const held = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => held.permissions.has(code),
  useHasAllPermissions: (codes: string[]) => codes.every((c) => held.permissions.has(c)),
}));
vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: {
    listPharmacyCatalog: () =>
      catalog.pending ? new Promise(() => {}) : Promise.resolve(catalog.rows),
  },
}));
vi.mock("@/services/pharmacy.service", () => ({
  pharmacyService: {
    listDispenseWitnesses: () => Promise.resolve([{ id: "w1", full_name: "Asha Witness" }]),
    validatePharmacyOrder: () => Promise.resolve({ findings: [] }),
    selectFefoBatch: () => Promise.resolve({ batches: [] }),
  },
}));

const line = (id: string, catalogId: string, name: string): PharmacyOrderItem =>
  ({
    id,
    catalog_item_id: catalogId,
    drug_name: name,
    quantity: 10,
    quantity_dispensed: 0,
    removed_at: null,
  }) as unknown as PharmacyOrderItem;

const drug = (id: string, schedule: string | null, controlled: boolean) => ({
  id,
  drug_schedule: schedule,
  is_controlled: controlled,
});

function renderModal(items: PharmacyOrderItem[], allergyStatusUnknown = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <DispenseModal
          opened
          orderId="o1"
          onClose={() => {}}
          items={items}
          isDispensing={false}
          allergyStatusUnknown={allergyStatusUnknown}
          onDispense={() => {}}
        />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

const dispenseButton = () => screen.getByRole("button", { name: "Dispense" });

describe("the dispense modal", () => {
  beforeEach(() => {
    catalog.rows = [];
    catalog.pending = false;
    held.permissions = new Set();
  });

  it("asks no witness for Schedule H1, which is scheduled but not controlled", async () => {
    catalog.rows = [drug("c1", "H1", false)];
    renderModal([line("i1", "c1", "Cefixime")]);
    await waitFor(() => expect(dispenseButton()).toBeEnabled());
    expect(screen.queryByText(/Witness \(second pharmacist/)).toBeNull();
  });

  it("shows controlled status as unknown, and waits, until the drugs are read", async () => {
    catalog.pending = true;
    renderModal([line("i1", "c1", "Tramadol")]);
    expect(await screen.findByText("Controlled: unknown")).toBeInTheDocument();
    expect(dispenseButton()).toBeDisabled();
  });

  it("needs a witness and the retained duplicate's reference for Schedule X", async () => {
    catalog.rows = [drug("c1", "X", true)];
    renderModal([line("i1", "c1", "Morphine")]);
    const reference = await screen.findByLabelText(/Retained duplicate prescription/);
    expect(dispenseButton()).toBeDisabled();
    // Shorter than the server's six characters: still asked for.
    fireEvent.change(reference, { target: { value: "SX1" } });
    expect(screen.getByText(/at least 6 characters/)).toBeInTheDocument();
    fireEvent.change(reference, { target: { value: "SX-2026-0042" } });
    expect(screen.queryByText(/at least 6 characters/)).toBeNull();
    // Still no witness: the dual lock is not lifted by the reference.
    expect(dispenseButton()).toBeDisabled();
  });

  it("lets only a named holder skip the witness, on a reason, and never for Schedule X", async () => {
    catalog.rows = [drug("c1", "NDPS", true)];
    held.permissions = new Set(["pharmacy.ndps.witness_override"]);
    renderModal([line("i1", "c1", "Codeine")]);
    const reason = await screen.findByLabelText(/Reason there is no witness/);
    expect(dispenseButton()).toBeDisabled();
    fireEvent.change(reason, { target: { value: "Night shift, sole pharmacist on duty" } });
    await waitFor(() => expect(dispenseButton()).toBeEnabled());
  });

  it("asks the pharmacist to acknowledge an unknown allergy status", async () => {
    catalog.rows = [drug("c1", null, false)];
    renderModal([line("i1", "c1", "Paracetamol")], true);
    const asked = await screen.findByLabelText(/I asked the patient about drug allergies/);
    expect(dispenseButton()).toBeDisabled();
    fireEvent.click(asked);
    await waitFor(() => expect(dispenseButton()).toBeEnabled());
  });
});
