import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { VitalsRecorder } from "./VitalsRecorder";

vi.mock("@/services/clinicalSupport.service", () => ({
  clinicalSupportService: { listClinicalDisplaySettings: vi.fn().mockResolvedValue([]) },
}));

describe("the vitals recorder is usable without sight of the screen", () => {
  it("names every number field by its vital and unit, and describes its normal range", () => {
    render(<VitalsRecorder ageYears={40} />);
    for (const name of [/pulse/i, /spo2|oxygen/i, /respiratory/i, /temperature/i, /weight/i]) {
      expect(screen.getByRole("textbox", { name })).toHaveAccessibleName();
    }
    expect(screen.getByRole("textbox", { name: /pulse/i })).toHaveAccessibleName(/bpm/);
    expect(screen.getByRole("textbox", { name: /pulse/i })).toHaveAccessibleDescription(/60–100/);
  });

  it("announces a reading's status as it is typed", async () => {
    render(<VitalsRecorder ageYears={40} />);
    await userEvent.type(screen.getByRole("textbox", { name: /pulse/i }), "130");
    const statuses = screen.getAllByRole("status");
    expect(statuses.some((s) => /pulse.*critical high/i.test(s.textContent ?? ""))).toBe(true);
  });

  it("has no WCAG 2.2 A or AA violations axe can find in the DOM", async () => {
    const { container } = render(<VitalsRecorder ageYears={40} />);
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      // jsdom has no layout, so contrast is checked by the e2e theme sweep instead.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

/** The status text announced for the pulse once `value` is typed. */
async function pulseStatusAt(ageYears: number | null, value: string): Promise<string> {
  render(<VitalsRecorder ageYears={ageYears} />);
  await userEvent.type(screen.getByRole("textbox", { name: /pulse/i }), value);
  const pulse = screen.getAllByRole("status").find((s) => /pulse/i.test(s.textContent ?? ""));
  return pulse?.textContent ?? "";
}

describe("pulse is graded for the patient's age (HQSC PEWS charts)", () => {
  it("a newborn's pulse of 140 is normal, not critical high", async () => {
    expect(await pulseStatusAt(0, "140")).toMatch(/pulse: normal/i);
  });

  it("a 5-year-old's pulse of 135 is high, not critical", async () => {
    expect(await pulseStatusAt(5, "135")).toMatch(/pulse: high/i);
  });

  it("an adult's pulse of 140 is still critical high", async () => {
    expect(await pulseStatusAt(40, "140")).toMatch(/pulse: critical high/i);
  });

  it("with no age on record the pulse is not graded and says the age is needed", async () => {
    const text = await pulseStatusAt(null, "140");
    expect(text).toMatch(/age needed/i);
    expect(text).not.toMatch(/critical|normal/i);
  });
});
