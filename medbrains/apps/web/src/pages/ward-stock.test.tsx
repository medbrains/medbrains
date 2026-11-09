import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { WardStockPage } from "./ward-stock";

const denied = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => !denied.has(code),
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => undefined }));
vi.mock("@/components/DepartmentSelect", () => ({
  DepartmentSelect: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange("ward-1")}>
      Pick ward
    </button>
  ),
}));
vi.mock("@/components/DrugSearchSelect", () => ({ DrugSearchSelect: () => null }));
vi.mock("@/components/PatientSearchSelect", () => ({
  PatientSearchSelect: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange("patient-1")}>
      Pick patient
    </button>
  ),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui")>()),
  toast,
}));

const service = vi.hoisted(() => ({
  listWardStock: vi.fn(),
  getLocationStockDashboard: vi.fn(),
  consumeWardStock: vi.fn(),
  replenishWard: vi.fn(),
  setWardPar: vi.fn(),
}));
vi.mock("@/services/pharmacy.service", () => ({ pharmacyService: service }));

beforeEach(() => {
  denied.clear();
  for (const fn of [...Object.values(service), ...Object.values(toast)]) fn.mockReset();
  service.getLocationStockDashboard.mockResolvedValue([]);
  service.listWardStock.mockResolvedValue([
    {
      catalog_item_id: "iv-set",
      drug_name: "IV set",
      par_qty: 20,
      min_qty: 5,
      on_hand: 12,
      gap: 8,
    },
  ]);
});

/** Open the consume dialog for the IV set and return it. */
async function openConsume() {
  const user = userEvent.setup();
  render(<WardStockPage />);
  await user.click(screen.getByRole("button", { name: "Pick ward" }));
  await user.click(await screen.findByRole("button", { name: "Consume" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("ward stock used on a patient", () => {
  it("sends the patient, and says when the charge went to the billing desk", async () => {
    service.consumeWardStock.mockResolvedValue({
      consumption_id: "c-1",
      remaining: 11,
      charge: "queued",
    });
    const { user, dialog } = await openConsume();
    await user.click(within(dialog).getByRole("button", { name: "Pick patient" }));
    await user.click(within(dialog).getByRole("button", { name: "Consume" }));
    await waitFor(() =>
      expect(service.consumeWardStock).toHaveBeenCalledWith({
        department_id: "ward-1",
        catalog_item_id: "iv-set",
        quantity: 1,
        patient_id: "patient-1",
      }),
    );
    expect(toast.warning).toHaveBeenCalledWith(
      "The charge could not post; the billing desk has it.",
      expect.anything(),
    );
  });

  it("records ward use with no patient and no charge", async () => {
    service.consumeWardStock.mockResolvedValue({
      consumption_id: "c-2",
      remaining: 11,
      charge: "ward_use",
    });
    const { user, dialog } = await openConsume();
    await user.click(within(dialog).getByRole("button", { name: "Consume" }));
    await waitFor(() =>
      expect(service.consumeWardStock).toHaveBeenCalledWith(
        expect.objectContaining({ patient_id: undefined }),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Recorded as ward use.", expect.anything());
  });
});

describe("the stock dashboard on ward stock", () => {
  it("shows the stock dashboard loading, not as no stock anywhere", async () => {
    service.getLocationStockDashboard.mockReturnValue(new Promise(() => {}));
    render(<WardStockPage />);
    expect(await screen.findByText("Stock by location")).toBeInTheDocument();
    expect(screen.queryByText("No pharmacy locations with stock yet.")).not.toBeInTheDocument();
  });

  it("hides, and never asks for, the stock dashboard the role may not read", async () => {
    denied.add("pharmacy.analytics.view");
    render(<WardStockPage />);
    expect(screen.queryByText("Stock by location")).not.toBeInTheDocument();
    expect(screen.queryByText("No pharmacy locations with stock yet.")).not.toBeInTheDocument();
    expect(service.getLocationStockDashboard).not.toHaveBeenCalled();
  });
});
