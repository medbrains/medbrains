/**
 * MedBrains Flow (#4901), through the screen: a front-office supervisor opens
 * the floor map, watches billing go red as tokens pile up, accepts the
 * recommendation to open another counter, and reads the floor through each
 * overlay. Starting data (the floor, its zones and their limits, the tokens)
 * is made through the API; every step the journey is about is on the screen.
 *
 * The server must run the Flow aggregator quickly for this to finish in
 * time: start it with FLOW_TICK_SECS=5. The aggregation arithmetic, outages,
 * the licence gate, 403s and PHI are proven in the server's `flow_test` and
 * `flow_access_test`.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { api } from "../helpers/api";
import { expectScreenAccessible } from "./support/a11y";
import { expect, test } from "./support/world";

const COMPOSE_DIR = fileURLToPath(new URL("../../../../", import.meta.url));
const tag = () => crypto.randomUUID().slice(0, 6).toUpperCase();

/** One value from the server's own database; never empty. */
function db(sql: string): string {
  const url = process.env.E2E_DATABASE_URL;
  const out = url
    ? execFileSync("psql", [url, "-tAc", sql], { encoding: "utf8" })
    : execFileSync(
        "docker",
        ["compose", "exec", "-T", "postgres", "psql", "-U", "medbrains", "-d", "medbrains", "-tAc", sql],
        { cwd: COMPOSE_DIR, encoding: "utf8" },
      );
  const value = out.trim();
  if (value === "") throw new Error(`no row for: ${sql} — is E2E_DATABASE_URL the server's database?`);
  return value;
}

const uuid = (v: string) => {
  if (!/^[0-9a-f-]{36}$/.test(v)) throw new Error(`not an id: ${v}`);
  return v;
};

test("a supervisor sees billing go red, accepts opening a counter, and reads every overlay", async ({
  hospital,
}) => {
  test.setTimeout(240_000);
  const t = tag();
  const admin = hospital.admin;
  await api(admin, "PUT", "/api/setup/modules/flow", { status: "enabled" });
  const floor = await api<{ id: string }>(admin, "POST", "/api/setup/locations", {
    level: "floor",
    code: `FL${t}`,
    name: `Ground floor ${t}`,
  });
  const zone = async (code: string, name: string) =>
    api<{ id: string }>(admin, "POST", "/api/setup/locations", {
      parent_id: floor.id,
      level: "zone",
      code: `${code}${t}`,
      name,
    });
  const billingName = `Billing hall ${t}`;
  const billingZone = await zone("ZB", billingName);
  const lobby = await zone("ZL", `Lobby ${t}`);
  const billing = await hospital.department("Billing");
  // Facilities' limits: crowded past 6, unsafe past 20; the team's goal 15 min.
  await api(admin, "PUT", `/api/flow/config/zones/${billingZone.id}`, {
    capacity: 20,
    comfort_limit: 6,
    attendant_factor: 1.8,
    goal_wait_minutes: 15,
    grid_row: 1,
    grid_col: 1,
  });
  await api(admin, "PUT", `/api/flow/config/zones/${billingZone.id}/sources`, {
    sources: [{ kind: "department", department_id: billing.id }],
  });
  await api(admin, "PUT", `/api/flow/config/zones/${lobby.id}`, {
    capacity: null,
    comfort_limit: null,
    attendant_factor: 1.8,
    goal_wait_minutes: null,
    grid_row: 1,
    grid_col: 2,
  });

  const supervisor = await hospital.newStaff("front_office_staff", `Desk lead ${t}`);
  const page = supervisor.page;
  await page.goto("/flow");
  await page.getByRole("textbox", { name: "Floor" }).click();
  await page.getByRole("option", { name: `Ground floor ${t}` }).click();
  const row = page.getByRole("row").filter({ hasText: billingName });
  await expect(row).toBeVisible();

  // The crowd arrives at billing (starting data: tokens issued at the desk).
  for (let i = 0; i < 8; i += 1) {
    await api(admin, "POST", "/api/tokens/issue", {
      module: "billing",
      scope: "department",
      scope_id: billing.id,
      patient_name: `Flow Journey ${t}`,
    });
  }
  // 8 waiting x 1.8 = 14 estimated people: past comfort 6, inside capacity 20.
  await expect(async () => {
    await page.reload();
    await page.getByRole("textbox", { name: "Floor" }).click();
    await page.getByRole("option", { name: `Ground floor ${t}` }).click();
    await expect(row).toContainText("Crowded", { timeout: 3_000 });
  }).toPass({ timeout: 120_000, intervals: [5_000] });
  await expect(row).toContainText("14 est.");
  await expect(page.getByText(`${billingName} is over its comfort limit`)).toBeVisible();
  await expectScreenAccessible(page, "flow");

  // The nudge, with its numbers: 8 x 3 min at one counter = 24; two = 12.
  const nudge = page.getByTestId("flow-recommendation").filter({ hasText: billingName });
  await expect(nudge).toContainText("open another counter");
  await expect(nudge).toContainText("Est. wait 24 → 12 min");
  await nudge.getByRole("button", { name: "Accept" }).click();
  await expect(nudge).toHaveCount(0);

  const zoneId = uuid(billingZone.id);
  expect(
    db(
      `SELECT decision || '|' || decided_by FROM flow_recommendations WHERE location_id = '${zoneId}' AND decision IS NOT NULL ORDER BY decided_at DESC LIMIT 1`,
    ),
  ).toBe(`accepted|${uuid(supervisor.id)}`);
  expect(
    db(`SELECT level || '|' || people_est FROM flow_alerts WHERE location_id = '${zoneId}' AND resolved_at IS NULL`),
  ).toBe("comfort|14");

  // One lens at a time: the same zone read through each overlay.
  const overlay = page.getByTestId("flow-overlay");
  await overlay.getByText("Wait", { exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "Wait" })).toBeVisible();
  await expect(row).toContainText("~24 min wait");
  await expect(row).toContainText("Over limit");
  await overlay.getByText("Bottleneck", { exact: true }).click();
  await expect(row).toContainText("Queue not moving");
  await overlay.getByText("Staff load", { exact: true }).click();
  await expect(row).toContainText("No staff on duty");
  await overlay.getByText("Crowd", { exact: true }).click();
  await expect(row).toContainText("Crowded");

  // Why is it red: the drawer, opened from the table (the map's keyboard twin).
  await page.getByRole("button", { name: `Inspect ${billingName}` }).click();
  const drawer = page.getByRole("dialog", { name: billingName });
  await expect(drawer).toContainText("About 14 people, over the comfort limit of 6.");
  await expect(drawer).toContainText("No token has been called here in the last 30 minutes.");
  await expectScreenAccessible(page, "flow-drawer");
});
