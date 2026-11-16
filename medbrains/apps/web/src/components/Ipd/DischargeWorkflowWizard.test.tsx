import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { DischargeWorkflowWizard } from "./DischargeWorkflowWizard";

const ipd = vi.hoisted(() => ({
  getIpdDischargeWorkflow: vi.fn(),
  updateIpdDischargeStep: vi.fn(),
}));
vi.mock("@/services/ipd.service", () => ({ ipdService: ipd }));

vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: () => true,
}));

const REFUSAL =
  "No pharmacy order was made for the take-home medicines, so this step is not marked. " +
  "Insufficient stock for Paracetamol. Notified 2 of the staff who can raise pharmacy orders (administrators included).";

describe("Discharge workflow: take-home medicines", () => {
  beforeEach(() => {
    ipd.getIpdDischargeWorkflow.mockReset().mockResolvedValue(null);
    ipd.updateIpdDischargeStep.mockReset();
  });

  // #5953: the patient must not go home with "meds dispensed" ticked and no
  // pharmacy order. A refused step shows why, on its own card, and stays open.
  it("keeps a refused rx_dispensed step open and says why on its card", async () => {
    ipd.updateIpdDischargeStep.mockRejectedValue(new Error(REFUSAL));
    render(<DischargeWorkflowWizard admissionId="adm-1" />);

    const label = await screen.findByText("Take-home meds dispensed");
    const card = label.closest(".mantine-Card-root") as HTMLElement;
    await userEvent.click(within(card).getByRole("button", { name: "Mark complete" }));

    const alert = await within(card).findByTestId("discharge-step-error-rx_dispensed");
    expect(alert).toHaveTextContent("No pharmacy order was made");
    expect(alert).toHaveTextContent("Insufficient stock for Paracetamol");
    expect(ipd.updateIpdDischargeStep).toHaveBeenCalledWith("adm-1", { step: "rx_dispensed" });
    expect(screen.getAllByRole("button", { name: "Mark complete" })).toHaveLength(7);
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });
});
