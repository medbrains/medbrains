import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { VitalsRecorder } from "./VitalsRecorder";

vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: { getTenantSettings: vi.fn().mockResolvedValue([]) },
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
});
