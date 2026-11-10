/**
 * MedBrains Flow floor view against a mocked API: every overlay renders, the
 * drawer explains a red zone, and the screen passes axe. Screenshots land in
 * FLOW_SHOTS_DIR when set (the PR's pictures). The real-server journey is
 * `e2e/journeys/flow.spec.ts`.
 */
import { expect, type Page, test } from "@playwright/test";
import { expectScreenAccessible } from "../journeys/support/a11y";
import { installMockApi, seedMockSession } from "./mockApi";

const FLOOR = "00000000-0000-4000-8000-0000000000f1";
const now = new Date();
const iso = (minutesFromNow: number) => new Date(now.getTime() + minutesFromNow * 60_000).toISOString();

interface ZoneSeed {
  id: string;
  name: string;
  row: number;
  col: number;
  people: number | null;
  waiting: number | null;
  wait: number | null;
  staff: number | null;
  comfort: number | null;
  capacity: number | null;
  served?: number;
  counters?: { label: string; waiting: number }[];
}

const SEEDS: ZoneSeed[] = [
  { id: "z-opd", name: "OPD hall A", row: 1, col: 1, people: 142, waiting: 48, wait: 31, staff: 4, comfort: 120, capacity: 180, served: 9 },
  { id: "z-reg", name: "Registration", row: 1, col: 2, people: 38, waiting: 9, wait: 6, staff: 3, comfort: 60, capacity: 90, served: 14 },
  { id: "z-lift", name: "Lift lobby", row: 1, col: 3, people: 12, waiting: 0, wait: 0, staff: 0, comfort: 30, capacity: 40, served: 0 },
  {
    id: "z-bill", name: "Billing", row: 2, col: 1, people: 58, waiting: 22, wait: 22, staff: 2, comfort: 45, capacity: 60, served: 6,
    counters: [{ label: "Counter 1", waiting: 14 }, { label: "Counter 2", waiting: 8 }],
  },
  { id: "z-pharm", name: "Pharmacy", row: 2, col: 2, people: 31, waiting: 11, wait: 12, staff: 3, comfort: 50, capacity: 70, served: 8 },
  { id: "z-lab", name: "Lab sample collection", row: 2, col: 3, people: 40, waiting: 18, wait: 27, staff: 1, comfort: 35, capacity: 50, served: 0 },
  { id: "z-ward", name: "Ward 4 visitors", row: 3, col: 1, people: null, waiting: null, wait: null, staff: null, comfort: 8, capacity: 12 },
];

const zones = SEEDS.map((s) => ({
  location_id: s.id,
  name: s.name,
  code: s.id.toUpperCase(),
  grid_row: s.row,
  grid_col: s.col,
  capacity: s.capacity,
  comfort_limit: s.comfort,
  attendant_factor: 1.8,
  goal_wait_minutes: s.id === "z-bill" ? 15 : null,
  minute: iso(0),
  people_est: s.people,
  patients: s.waiting,
  waiting: s.waiting,
  checked_in: 0,
  visitors: s.people === null ? null : 0,
  staff: s.staff,
  wait_minutes: s.wait,
  served_30m: s.served ?? null,
  open_counters: s.waiting === null ? null : 2,
  counters: s.counters ?? [],
  unknown_sources: s.people === null ? ["visitors"] : [],
}));

const LIVE = {
  floor_id: FLOOR,
  floor_name: "Ground floor",
  as_of: iso(0),
  stale: false,
  zones,
  alerts: [
    { id: "a1", location_id: "z-bill", level: "comfort", people_est: 58, limit_value: 45, raised_at: iso(-6), acked_at: null, resolved_at: null },
    { id: "a2", location_id: "z-lab", level: "comfort", people_est: 40, limit_value: 35, raised_at: iso(-3), acked_at: null, resolved_at: null },
  ],
  recommendations: [
    {
      id: "r1", location_id: "z-bill", action: "open_counter", counters_open: 2, counters_suggested: 3, waiting: 22,
      wait_before_minutes: 22, wait_after_minutes: 14.7, target_minutes: 15, decision: null, decided_at: null,
      snoozed_until: null, created_at: iso(-4),
    },
  ],
  goals: [{ location_id: "z-bill", goal_wait_minutes: 15, minutes_met: 182, minutes_measured: 240 }],
};

const HISTORY = [-120, -90, -60, -30].flatMap((m, i) =>
  SEEDS.filter((s) => s.people !== null).map((s) => ({
    location_id: s.id,
    at: iso(m),
    people_est: Math.round((s.people ?? 0) * (0.4 + i * 0.15)),
    waiting: Math.round((s.waiting ?? 0) * (0.4 + i * 0.15)),
    wait_minutes: Math.round((s.wait ?? 0) * (0.4 + i * 0.15)),
  })),
);

const FORECAST = {
  start: iso(0),
  step_minutes: 15,
  hours: 1,
  basis: "Estimate: the usual crowd at this time on the same weekday over the last 4 weeks.",
  points: [0, 15, 30, 45].flatMap((m) =>
    SEEDS.map((s) => ({ location_id: s.id, at: iso(m), people_est: s.people === null ? null : s.people + m / 3 })),
  ),
};

const SETUP = {
  zones: SEEDS.map((z) => ({
    location_id: z.id,
    name: z.name,
    code: z.id.toUpperCase(),
    configured: true,
    capacity: z.capacity,
    comfort_limit: z.comfort,
    attendant_factor: 1.8,
    goal_wait_minutes: z.id === "z-bill" ? 15 : null,
    grid_row: z.row,
    grid_col: z.col,
    sources:
      z.id === "z-bill"
        ? [
            { id: "s1", zone_location_id: z.id, kind: "department", department_id: "d-bill", department_name: "Billing", token_module: null, counter_label: null },
            { id: "s2", zone_location_id: z.id, kind: "token_queue", department_id: null, department_name: null, token_module: "billing", counter_label: "Counter 3" },
          ]
        : [],
  })),
  departments: [{ id: "d-bill", name: "Billing" }, { id: "d-opd", name: "General Medicine" }],
  token_modules: ["registration", "opd", "lab", "radiology", "pharmacy", "billing"],
};

async function installFlowMocks(page: Page) {
  await installMockApi(page);
  // The shell's shift widget hides on a 404 (no employee record, as for super_admin).
  await page.route("**/api/hr/my-shift", (route) => route.fulfill({ status: 404, body: "{}" }));
  await page.route(
    (url) => url.pathname.startsWith("/api/flow/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body =
        path === "/api/flow/config/floors"
          ? [{ id: FLOOR, name: "Ground floor", building_name: "Main block", zone_count: zones.length }]
          : path.startsWith("/api/flow/config/floors/")
            ? SETUP
            : path === "/api/flow/floors"
          ? [{ id: FLOOR, name: "Ground floor", building_name: "Main block", zone_count: zones.length }]
          : path.endsWith("/live")
            ? LIVE
            : path.endsWith("/history")
              ? HISTORY
              : path.endsWith("/forecast")
                ? FORECAST
                : path.startsWith("/api/flow/zones/")
                  ? {
                      zone: zones.find((z) => z.location_id === "z-bill"),
                      series: HISTORY.filter((p) => p.location_id === "z-bill"),
                      booked_next_hour: 41,
                      reasons: [
                        "About 58 people, over the comfort limit of 45.",
                        "Wait about 22 min against a target of 15 min: 22 waiting for 2 open counter(s).",
                        "41 more patients are booked in the next hour.",
                      ],
                      alerts: [LIVE.alerts[0]],
                      recommendations: LIVE.recommendations,
                    }
                  : { status: "ok" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    },
  );
}

async function shot(page: Page, name: string, fullPage = true) {
  const dir = process.env.FLOW_SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}


test("the Flow floor view draws every overlay and explains a red zone", async ({ page }) => {
  await installFlowMocks(page);
  await seedMockSession(page);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/flow");
  const billing = page.getByRole("row").filter({ hasText: "Billing" });
  await expect(billing).toContainText("Crowded");
  await expect(page.getByRole("img", { name: /Ground floor/ })).toBeVisible();
  await expect(page.getByTestId("flow-recommendation")).toContainText("Est. wait 22 → 15 min");
  await expectScreenAccessible(page, "flow");
  await shot(page, "flow-crowd");

  const overlay = page.getByTestId("flow-overlay");
  for (const [label, expected, file] of [
    ["Wait", "~22 min wait", "flow-wait"],
    ["Staff load", "2 staff on duty", "flow-staff"],
    ["Bottleneck", "22 waiting", "flow-bottleneck"],
  ] as const) {
    await overlay.getByText(label, { exact: true }).click();
    await expect(billing).toContainText(expected);
    await shot(page, file);
  }
  await expect(page.getByRole("row").filter({ hasText: "Ward 4 visitors" })).toContainText("Unknown");

  await page.getByRole("button", { name: "Inspect Billing" }).click();
  const drawer = page.getByRole("dialog", { name: "Billing" });
  await expect(drawer).toContainText("over the comfort limit of 45");
  await expectScreenAccessible(page, "flow-drawer");
  await shot(page, "flow-drawer", false);

  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Setup" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Billing" })).toContainText("Counter 3");
  await expectScreenAccessible(page, "flow-setup");
  await shot(page, "flow-setup");
  await page.getByRole("button", { name: "Set up Billing" }).click();
  await expect(page.getByRole("dialog", { name: "Set up Billing" })).toContainText("What feeds this zone");
  await expectScreenAccessible(page, "flow-setup-zone");
  await shot(page, "flow-setup-zone", false);
});
