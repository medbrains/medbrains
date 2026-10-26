import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { OverrideModal } from "./override-modal";

const service = vi.hoisted(() => ({ upsertNotifiableOverride: vi.fn() }));
vi.mock("@/services/ckb.service", () => ({ ckbService: service }));

describe("OverrideModal", () => {
  it("adds a state-notified disease the national list does not carry", async () => {
    service.upsertNotifiableOverride.mockResolvedValue({ id: "o1" });
    const onSaved = vi.fn();
    render(<OverrideModal existing={null} onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText(/ICD-10 code/), "A75.3");
    await userEvent.type(screen.getByLabelText("Disease"), "Scrub typhus");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(service.upsertNotifiableOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        icd10_code: "A75.3",
        disease_name: "Scrub typhus",
        is_notifiable: true,
        report_timeframe: "24h",
      }),
    );
  });

  it("refuses something that is not an ICD-10 code", async () => {
    render(<OverrideModal existing={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/ICD-10 code/), "scrub");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("An ICD-10 code looks like A75.3")).toBeInTheDocument();
  });
});
