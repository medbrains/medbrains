import userEvent from "@testing-library/user-event";
import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import type { AiWidget } from "../transport/types";
import { formatValue, statusTone } from "./format";
import { WidgetView } from "./WidgetView";

const table: AiWidget = {
  kind: "table",
  title: "Payments by mode",
  columns: [
    { key: "mode", label: "Mode" },
    { key: "amount", label: "Amount" },
  ],
  rows: [
    { mode: "card", amount: "2250.00" },
    { mode: "upi", amount: "868.00" },
  ],
  total_rows: 2,
};

describe("rich answers", () => {
  it("shows tiles with the record's own numbers, grouped never rounded", () => {
    render(
      <WidgetView
        widget={{
          kind: "kpis",
          title: "Today",
          tiles: [{ label: "Total billed", value: "6647.28" }],
        }}
      />,
    );
    expect(screen.getByText("6,647.28")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open full screen" })).toBeNull();
  });

  it("opens a compacted table full screen and returns focus on close", async () => {
    render(<WidgetView widget={table} />);
    const expand = screen.getByRole("button", { name: "Open full screen" });
    await userEvent.click(expand);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(expand).toHaveFocus());
  });

  it("formats and tones values without inventing any", () => {
    expect(formatValue(1234567)).toBe("12,34,567");
    expect(formatValue("998118.20", true)).toBe("₹9,98,118.20");
    expect(formatValue("232", false)).toBe("232");
    expect(formatValue("Ward 3B")).toBe("Ward 3B");
    expect(statusTone("pending")).toBe("warning");
    expect(statusTone("cleared")).toBe("success");
    expect(statusTone("something else")).toBe("neutral");
  });

  it("offers the patients behind an aggregate row only to users who may list patients", () => {
    const aggregate: AiWidget = {
      kind: "table",
      title: "Allergies",
      columns: [
        { key: "allergen", label: "Allergen" },
        { key: "patients", label: "Patients" },
      ],
      rows: [{ allergen: "penicillin", patients: 14 }],
      total_rows: 1,
      drill: { metric: "allergies", key: "allergen", from: "2026-09-26", to: "2026-10-25" },
    };
    usePermissionStore.getState().setPermissions("nurse", []);
    const { unmount } = render(<WidgetView widget={aggregate} />);
    expect(screen.queryByRole("button", { name: "View patients" })).toBeNull();
    unmount();
    usePermissionStore.getState().setPermissions("doctor", [P.PATIENTS.LIST]);
    render(<WidgetView widget={aggregate} />);
    expect(screen.getByRole("button", { name: "View patients" })).toBeInTheDocument();
  });
});
