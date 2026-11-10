import { P } from "@medbrains/types";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";

const state = vi.hoisted(() => ({
  permissions: new Set<string>(),
  dispenses: [] as Record<string, unknown>[],
  context: { no_known_allergies: null as boolean | null, drug_allergies: [] as unknown[] },
}));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasPermission: (code: string) => state.permissions.has(code),
  useFieldAccess: () => "edit",
}));
vi.mock("@/hooks/usePatientName", () => ({ usePatientName: () => ({ data: undefined }) }));
vi.mock("@/components", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  PrescriptionViews: () => null,
  useClinicalEmit: () => () => {},
}));
// The dispense screen is tested on its own; here it sends one line.
vi.mock("@/components/Pharmacy/DispenseModal", () => ({
  DispenseModal: ({
    onDispense,
    allergyStatusUnknown,
  }: {
    onDispense: (p: unknown) => void;
    allergyStatusUnknown: boolean;
  }) => (
    <Button
      data-allergy-unknown={String(allergyStatusUnknown)}
      onClick={() => onDispense({ items: [{ order_item_id: "i1", quantity: 1 }] })}
    >
      Send dispense
    </Button>
  ),
}));
// Panels around the order that fetch their own data and are tested elsewhere.
const none = () => null;
vi.mock("@/components/Patient/PatientFlowNavigator", () => ({ PatientFlowNavigator: none }));
vi.mock("@/components/Patient/PatientJourneyActions", () => ({ PatientJourneyActions: none }));
vi.mock("@/components/Pharmacy/PharmacyDispensingView", () => ({ PharmacyDispensingView: none }));
vi.mock("@/components/Pharmacy/RepeatPanel", () => ({ RepeatPanel: none }));
vi.mock("./arrange-delivery-drawer", () => ({ ArrangeDeliveryButton: none }));
vi.mock("./near-expiry-hints", () => ({ NearExpiryHints: none }));
vi.mock("./order-safety-record", () => ({ OrderSafetyRecord: none }));

vi.mock("@/services/pharmacy.service", () => ({
  pharmacyService: {
    getPharmacyOrder: () =>
      Promise.resolve({
        order: {
          id: "order-0001-abcd",
          status: "ordered",
          dispensing_type: "opd",
          patient_id: "p1",
          prescription_id: null,
          dispensed_at: null,
        },
        items: [],
      }),
    getPharmacyDispenseContext: () =>
      Promise.resolve({ patient_id: "p1", uhid: "UH-1", full_name: "Kavya", ...state.context }),
    dispenseOrder: (_id: string, payload: Record<string, unknown>) => {
      state.dispenses.push(payload);
      return payload.unpaid_override_reason
        ? Promise.resolve({ patient_id: "p1", dispensing_type: "opd" })
        : Promise.reject(new Error("Provide a reason to dispense unpaid: bill open"));
    },
    listPharmacyCatalog: () => Promise.resolve([]),
  },
}));

const { PharmacyOrderDetail } = await import("./order-detail");

const quietClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: () => {} }),
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

/** Opens the dispense screen on an order awaiting dispense. */
async function openDispense() {
  render(
    <PharmacyOrderDetail
      orderId="order-0001-abcd"
      canEditItems={false}
      canDispense
      canViewReturns={false}
      canViewPatientRecord={false}
    />,
    { queryClient: quietClient() },
  );
  await userEvent.click(await screen.findByRole("button", { name: "Dispense" }));
  return screen.findByRole("button", { name: "Send dispense" });
}

describe("dispensing an order with an open bill", () => {
  beforeEach(() => {
    state.permissions = new Set();
    state.dispenses = [];
    state.context = { no_known_allergies: null, drug_allergies: [] };
  });

  it("asks why, then sends the same dispense with the reason", async () => {
    state.permissions.add(P.PHARMACY.DISPENSING_UNPAID_OVERRIDE);
    await userEvent.click(await openDispense());
    expect(await screen.findByText("Dispense unpaid?")).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText(/Why dispense before payment/),
      "Scheme beneficiary",
    );
    await userEvent.click(screen.getByRole("button", { name: "Dispense unpaid" }));
    await waitFor(() => expect(state.dispenses).toHaveLength(2));
    expect(state.dispenses[1]).toEqual({
      items: [{ order_item_id: "i1", quantity: 1 }],
      unpaid_override_reason: "Scheme beneficiary",
    });
  });

  it("offers no unpaid dispense without the override permission", async () => {
    await userEvent.click(await openDispense());
    await waitFor(() => expect(state.dispenses).toHaveLength(1));
    expect(screen.queryByText("Dispense unpaid?")).toBeNull();
  });

  it("tells the dispense screen when nobody has recorded the patient's allergies", async () => {
    expect(await openDispense()).toHaveAttribute("data-allergy-unknown", "true");
  });

  it("does not treat a recorded 'no known allergies' as unknown", async () => {
    state.context = { no_known_allergies: true, drug_allergies: [] };
    const send = await openDispense();
    await waitFor(() => expect(send).toHaveAttribute("data-allergy-unknown", "false"));
  });
});
