import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { VitalsRecorder } from "./VitalsRecorder";

vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: { listClinicalDisplaySettings: vi.fn().mockResolvedValue([]) },
}));

describe("the vitals recorder is usable without sight of the screen", () => {
  it("names every number field by its vital and unit, and describes its normal range", () => {
    render(<VitalsRecorder />);
    for (const name of [/pulse/i, /spo2|oxygen/i, /respiratory/i, /temperature/i, /weight/i]) {
      expect(screen.getByRole("textbox", { name })).toHaveAccessibleName();
    }
    expect(screen.getByRole("textbox", { name: /pulse/i })).toHaveAccessibleName(/bpm/);
    expect(screen.getByRole("textbox", { name: /pulse/i })).toHaveAccessibleDescription(/60–100/);
  });

  it("announces a reading's status as it is typed", async () => {
    render(<VitalsRecorder />);
    await userEvent.type(screen.getByRole("textbox", { name: /pulse/i }), "130");
    const statuses = screen.getAllByRole("status");
    expect(statuses.some((s) => /pulse.*critical high/i.test(s.textContent ?? ""))).toBe(true);
  });

  it("has no WCAG 2.2 A or AA violations axe can find in the DOM", async () => {
    const { container } = render(<VitalsRecorder />);
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      // jsdom has no layout, so contrast is checked by the e2e theme sweep instead.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  it("keeps an impossible reading as typed, says why, and refuses to save it", async () => {
    const onSubmit = vi.fn();
    render(<VitalsRecorder onSubmit={onSubmit} />);
    const spo2 = screen.getByTestId("vital-spo2");
    await userEvent.type(spo2, "150");
    await userEvent.type(screen.getByTestId("vital-pulse"), "-5");
    await userEvent.tab();
    expect(spo2).toHaveValue("150");
    expect(screen.getByTestId("vital-pulse")).toHaveValue("-5");
    expect(screen.getByText("vitals.spo2 must be between 50 and 100 %")).toBeInTheDocument();
    expect(screen.getByText("vitals.pulse must be between 20 and 250 bpm")).toBeInTheDocument();
    // Not graded: 150 must never read as a normal, or any, saturation.
    expect(screen.queryByText(/vitals\.spo2: /)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "vitals.recordVitals" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("tells an embedding form when a reading may not be saved", async () => {
    const onChange = vi.fn();
    render(<VitalsRecorder onChange={onChange} showActions={false} />);
    await userEvent.type(screen.getByTestId("vital-respiratory_rate"), "18");
    expect(onChange).toHaveBeenLastCalledWith({ respiratory_rate: 18 }, true);
    await userEvent.type(screen.getByTestId("vital-respiratory_rate"), "0");
    expect(onChange).toHaveBeenLastCalledWith({ respiratory_rate: 180 }, false);
  });
});
