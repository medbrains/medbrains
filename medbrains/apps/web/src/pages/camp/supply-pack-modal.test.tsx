import type { CampSupplyItem } from "@medbrains/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { SupplyPackModal } from "./supply-pack-modal";

const service = vi.hoisted(() => ({ updateCampSupplyItem: vi.fn() }));
vi.mock("@/services/camp.service", () => ({ campService: service }));

const packedMedicine = {
  id: "row-1",
  category: "medicine",
  item_name: "Paracetamol 500 mg",
  unit: "tab",
  planned_qty: 100,
  packed_qty: 100,
  shortage_notes: null,
  batch_no: null,
  expiry_date: null,
} as unknown as CampSupplyItem;

describe("SupplyPackModal", () => {
  it("will not save a packed medicine without its batch and expiry", async () => {
    render(<SupplyPackModal campId="camp-1" item={packedMedicine} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("A packed medicine needs its batch number")).toBeInTheDocument();
    expect(service.updateCampSupplyItem).not.toHaveBeenCalled();
  });

  it("saves the batch and expiry the pharmacist entered", async () => {
    service.updateCampSupplyItem.mockResolvedValue(packedMedicine);
    const onClose = vi.fn();
    render(<SupplyPackModal campId="camp-1" item={packedMedicine} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("Batch number"), "PCM-2201");
    await userEvent.type(screen.getByLabelText("Expiry date"), "2027-01-31");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(service.updateCampSupplyItem).toHaveBeenCalledWith("row-1", {
      planned_qty: 100,
      packed_qty: 100,
      shortage_notes: "",
      batch_no: "PCM-2201",
      expiry_date: "2027-01-31",
    });
  });
});
