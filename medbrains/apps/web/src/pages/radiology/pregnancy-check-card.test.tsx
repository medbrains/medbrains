import type { RadiologyOrder } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { PregnancyCheckCard } from "./pregnancy-check-card";

const service = vi.hoisted(() => ({ recordPregnancyCheck: vi.fn() }));
vi.mock("@/services/radiology.service", () => ({ radiologyService: service }));

const held = vi.hoisted(() => new Set<string>(["radiology.orders.pregnancy_check"]));
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const ORDER = { id: "o1", pregnancy_status: null } as unknown as RadiologyOrder;

beforeEach(() => {
  vi.clearAllMocks();
  held.clear();
  held.add("radiology.orders.pregnancy_check");
  service.recordPregnancyCheck.mockResolvedValue(ORDER);
});

describe("PregnancyCheckCard", () => {
  it("records 'not pregnant' with how it was established", async () => {
    render(<PregnancyCheckCard order={ORDER} />);
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    await waitFor(() =>
      expect(service.recordPregnancyCheck).toHaveBeenCalledWith("o1", {
        status: "not_pregnant",
        method: "asked",
      }),
    );
  });

  it("needs a reason when she may be pregnant", async () => {
    render(<PregnancyCheckCard order={ORDER} />);
    await userEvent.click(screen.getByText("Cannot be ruled out"));
    await userEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(await screen.findByText(/Say why the exam goes ahead/)).toBeInTheDocument();
    expect(service.recordPregnancyCheck).not.toHaveBeenCalled();
  });

  it("shows the recorded answer, and tells someone who cannot record it", () => {
    const { unmount } = render(
      <PregnancyCheckCard
        order={
          {
            ...ORDER,
            pregnancy_status: "pregnant",
            pregnancy_check_method: "urine_test",
            pregnancy_justification: "Trauma; CT cannot wait",
          } as RadiologyOrder
        }
      />,
    );
    expect(screen.getByText("Going ahead because: Trauma; CT cannot wait")).toBeInTheDocument();
    unmount();
    held.clear();
    render(<PregnancyCheckCard order={ORDER} />);
    expect(screen.getByText("Pregnancy check needed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Record" })).not.toBeInTheDocument();
  });
});
