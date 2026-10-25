import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

/**
 * The As of date is only worth anything if it reaches the server: the
 * founder picked 15 Jan 2026 and the KPI tiles went on showing today.
 */

const batch = vi.fn(async (_ids: string[], _asOf?: string) => [
  { widget_id: "w1", data: { value: 84, as_of: "2026-01-15" }, fetched_at: "" },
]);

vi.mock("@medbrains/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@medbrains/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getMyDashboard: async () => ({
        dashboard: { name: "My Dashboard", description: null, layout_config: {} },
        widgets: [
          {
            id: "w1",
            widget_type: "stat_card",
            title: "Today's OPD",
            config: {},
            data_source: { type: "module_query", module: "management", query: "kpi" },
            width: 3,
            height: 2,
          },
        ],
      }),
      batchWidgetData: (ids: string[], asOf?: string) => batch(ids, asOf),
    },
  };
});
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));
vi.mock("@/components/dashboard/AwaitingRoleNotice", () => ({ AwaitingRoleNotice: () => null }));
vi.mock("@/components/GettingStartedWidget", () => ({ GettingStartedWidget: () => null }));
vi.mock("@/components/dashboard/WidgetPicker", () => ({ WidgetPicker: () => null }));

const { DashboardPage } = await import("./dashboard");

describe("the dashboard's As of date", () => {
  beforeEach(() => batch.mockClear());

  it("re-reads the tiles for the day picked", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(batch).toHaveBeenCalledWith(["w1"], undefined));

    const input = await screen.findByLabelText("As of");
    fireEvent.change(input, { target: { value: "15 Jan 2026" } });
    fireEvent.blur(input);

    await waitFor(() => expect(batch).toHaveBeenLastCalledWith(["w1"], "2026-01-15"));
    expect(await screen.findByText(/^On .*2026$/)).toBeInTheDocument();
  });
});
