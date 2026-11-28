import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { VitalsRecorder } from "./VitalsRecorder";

vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: { listClinicalDisplaySettings: vi.fn().mockResolvedValue([]) },
}));

describe("a baby's weight is kept to the gram", () => {
  it("records 1.234 kg as 1.234, not rounded to 1.2", async () => {
    const onChange = vi.fn();
    render(<VitalsRecorder onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox", { name: /weight/i }), "1.234");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ weight_kg: 1.234 }));
  });
});
