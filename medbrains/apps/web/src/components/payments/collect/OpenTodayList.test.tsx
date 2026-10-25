import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { OpenTodayList } from "./OpenTodayList";

const service = vi.hoisted(() => ({ listCounterOpenToday: vi.fn() }));
vi.mock("@/services/billing.service", () => ({ billingService: service }));
vi.mock("./use-dues", () => ({ useCanCollect: () => true }));

describe("OpenTodayList", () => {
  it("lists today's patients with open bills and opens the one picked", async () => {
    service.listCounterOpenToday.mockResolvedValue([
      {
        patient_id: "p-1",
        patient_name: "Aarav Sharma",
        uhid: "DMO-000001",
        bill_count: 2,
        balance: "1300.00",
        last_charged_at: "2026-10-25T09:30:00Z",
      },
    ]);
    const onPick = vi.fn();
    render(<OpenTodayList onPick={onPick} />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open bills for Aarav Sharma" }),
    );
    expect(onPick).toHaveBeenCalledWith("p-1");
    expect(screen.getByText("DMO-000001")).toBeInTheDocument();
  });

  it("says when nothing is waiting rather than showing a blank page", async () => {
    service.listCounterOpenToday.mockResolvedValue([]);
    render(<OpenTodayList onPick={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/No bills are waiting today/)).toBeInTheDocument());
  });
});
