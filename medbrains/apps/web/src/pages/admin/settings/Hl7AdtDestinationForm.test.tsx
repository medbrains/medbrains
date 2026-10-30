import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { Hl7AdtDestinationForm } from "./Hl7AdtDestinationForm";

describe("Hl7AdtDestinationForm", () => {
  it("takes a host, not a URL, and saves with the default triggers", async () => {
    const onSubmit = vi.fn();
    render(<Hl7AdtDestinationForm busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Name"), "Radiology PACS");
    await userEvent.type(screen.getByLabelText(/^Host/), "http://10.0.4.20");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/no http:\/\/ or port/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/^Host/));
    await userEvent.type(screen.getByLabelText(/^Host/), "10.0.4.20");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      name: "Radiology PACS",
      host: "10.0.4.20",
      port: 2575,
      events: ["A01", "A02", "A03", "A08"],
    });
  });
});
