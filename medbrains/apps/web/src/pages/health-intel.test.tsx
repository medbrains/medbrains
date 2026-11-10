import type { HealthIntel } from "@medbrains/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import { HealthIntelPage } from "./health-intel";

const api = vi.hoisted(() => ({ getHealthIntel: vi.fn() }));
vi.mock("@medbrains/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/api")>()),
  api,
}));
vi.mock("@/hooks/useRequirePermission", () => ({ useRequirePermission: () => {} }));

const held = vi.hoisted(() => new Set<string>());
vi.mock("@medbrains/stores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@medbrains/stores")>()),
  useHasPermission: (code: string) => held.has(code),
}));

const intel: HealthIntel = {
  conditions: [
    {
      condition: "Dengue",
      this_week: 12,
      usual: null,
      method: "rolling_8_weeks",
      level: "much_higher",
      series: [0, 0, null, null, null, null, null, null, null, null, null, 12],
    },
  ],
  computed_at: new Date().toISOString(),
  region: "Tamil Nadu",
  notices: [],
  environment: {
    status: "not_available",
    as_of: null,
    last_attempt_at: new Date().toISOString(),
    last_good_at: null,
    reason: "weather: timed out",
    temperature_c: 39,
    weather_code: 0,
    forecast_max_c: null,
    forecast_max_on: null,
    pm2_5: null,
    pm10: null,
    heat: null,
    air: null,
  },
  checks: [
    {
      name: "job:health_conditions",
      kind: "job",
      label: "Condition counts (hourly)",
      state: "running",
      last_ok_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      last_error: null,
    },
  ],
};

describe("Health → Intelligence", () => {
  beforeEach(() => {
    held.clear();
    api.getHealthIntel.mockReset();
  });

  it("does not fetch without health.intel.view", () => {
    render(<HealthIntelPage />);
    expect(api.getHealthIntel).not.toHaveBeenCalled();
  });

  it("shows a failed read as an error, never as nothing unusual", async () => {
    held.add("health.intel.view");
    api.getHealthIntel.mockRejectedValue(new Error("down"));
    render(<HealthIntelPage />);
    expect(await screen.findByTestId("health-intel-error")).toBeInTheDocument();
    expect(screen.queryByText(/no notifiable cases/i)).not.toBeInTheDocument();
  });

  it("labels the level in words, suppresses small counts, and never shows a stale reading", async () => {
    held.add("health.intel.view");
    api.getHealthIntel.mockResolvedValue(intel);
    render(<HealthIntelPage />);
    expect(await screen.findByText("Much higher than usual")).toBeInTheDocument();
    expect(screen.getAllByText("fewer than 5").length).toBeGreaterThan(0);
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(screen.queryByText(/39 °C/)).not.toBeInTheDocument();
  });
});
