import type { DashboardWidget, WidgetType } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { DashboardWidgetCard } from "./DashboardWidgetCard";

/**
 * The distinction these tests defend: a tile whose query FAILED must not
 * render the words a tile with NOTHING IN IT renders.
 *
 * Three tiles shipped querying columns that do not exist — Doctor Dashboard
 * "My Appointments", Receptionist "Upcoming Appointments", Pharmacist "NDPS
 * Register". Every one of them drew "No data", which is exactly what a doctor
 * with a genuinely clear morning sees. The failure was legible as a fact
 * about the ward.
 */

function widget(widget_type: WidgetType, config: Record<string, unknown> = {}): DashboardWidget {
  return {
    id: "w1",
    dashboard_id: "d1",
    widget_type,
    title: "My Appointments",
    subtitle: null,
    icon: null,
    color: null,
    config,
    data_source: { type: "module_query", module: "opd", query: "my_appointments" },
    data_filters: {},
    variants: [],
    position_x: 0,
    position_y: 0,
    width: 4,
    height: 2,
    min_width: 2,
    min_height: 1,
    refresh_interval: null,
    is_visible: true,
    permission_code: null,
    sort_order: 0,
    created_at: "2026-09-06T00:00:00Z",
    updated_at: "2026-09-06T00:00:00Z",
  } as DashboardWidget;
}

// The shape the server sends when a widget's query could not be resolved.
const FAILED = { error: "unavailable" };

describe("DashboardWidgetCard — a failure is not an emptiness", () => {
  it.each<WidgetType>(["data_table", "list", "chart", "stat_card"] as WidgetType[])(
    "%s says it could not load, and does not say it is empty",
    (type) => {
      render(
        <DashboardWidgetCard
          widget={widget(type, { columns: ["patient_name"] })}
          data={FAILED}
          loading={false}
        />,
      );

      expect(screen.getByText("Couldn't load")).toBeInTheDocument();
      // The words an empty result uses must be absent, or the two states are
      // indistinguishable to the person reading the screen.
      expect(screen.queryByText("Nothing to show")).not.toBeInTheDocument();
      expect(screen.queryByText("No data")).not.toBeInTheDocument();
    },
  );

  it("an empty result still reads as empty, not as a failure", () => {
    render(
      <DashboardWidgetCard
        widget={widget("data_table" as WidgetType, { columns: ["patient_name"] })}
        data={{ items: [] }}
        loading={false}
      />,
    );

    expect(screen.getByText("Nothing to show")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load")).not.toBeInTheDocument();
  });

  it("a tile still in flight is not called broken", () => {
    render(
      <DashboardWidgetCard
        widget={widget("data_table" as WidgetType)}
        data={undefined}
        loading={true}
      />,
    );

    expect(screen.queryByText("Couldn't load")).not.toBeInTheDocument();
  });

  it("renders rows when the data arrives", () => {
    render(
      <DashboardWidgetCard
        widget={widget("data_table" as WidgetType, { columns: ["patient_name"] })}
        data={{ items: [{ id: "a1", patient_name: "Smoke Patient" }] }}
        loading={false}
      />,
    );

    expect(screen.getByText("Smoke Patient")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load")).not.toBeInTheDocument();
  });
});
