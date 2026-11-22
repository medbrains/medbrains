/**
 * The hospital's day on a staging box, one test per phase of
 * scripts/staging_update_e2e.sh: setup (Registration + OPD only, plain UHIDs,
 * staff), baseline (desk registers a patient, which queues the OPD visit,
 * prints the card, finds them by UHID; the doctor sees the visit; the admin
 * checks version and bricks), oldtab (a tab stays open across the update, and
 * another across the rollback, where it must reload once) and
 * verify (the same day again against the baseline patient). Passwords are
 * generated here and written only to the run directory.
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
import { loginAsRole } from "../helpers";
import { type AuthContext, api } from "../helpers/api";
import { cookieHeaderFromResponse } from "../helpers/e2e-identities";
import { ownClientHeaders } from "../helpers/worker-tenant";
import { OpdWorklist } from "../journeys/pages/opd-worklist";
import { RegistrationDesk } from "../journeys/pages/registration-desk";

const RUN = process.env.STAGING_RUN ?? "";
const LABEL = process.env.STAGING_LABEL ?? "run";
const KEEP_ON = new Set(["registration", "opd"]);
type Role = "receptionist" | "doctor" | "admin";
type Creds = Record<Role, { username: string; password: string }>;
type Patient = { uhid: string; name: string; department: string };
type Brick = { code: string; status: string };

/** Reads a JSON file from the run directory. */
const readRun = <T>(name: string): T => JSON.parse(readFileSync(`${RUN}/${name}`, "utf8")) as T;

/** Writes a JSON file to the run directory, owner-only (it may hold passwords). */
const writeRun = (name: string, value: unknown) =>
  writeFileSync(`${RUN}/${name}`, JSON.stringify(value, null, 2), { mode: 0o600 });

/** A password the server's rule accepts and no earlier run used. */
const newPassword = () => `Stg-${randomBytes(9).toString("base64url")}-9a!`;

/** A pronounceable random name, so this run's patients never read as duplicates of each other. */
const word = () =>
  Array.from(randomBytes(3), (b) => "bdfghjklmnprstvy"[b % 16] + "aeiou"[b % 5]).join("").replace(/^./, (c) => c.toUpperCase());

/** Signs in through the API and returns a context for `api()`. */
async function signIn(request: APIRequestContext, username: string, password: string): Promise<AuthContext> {
  const resp = await request.post(`${process.env.E2E_BACKEND_URL}/api/auth/login`, {
    headers: ownClientHeaders(),
    data: { username, password },
  });
  expect(resp.status(), `sign-in as ${username}`).toBe(200);
  const { csrf_token: csrfToken = "", user } = await resp.json();
  return { csrfToken, cookieHeader: cookieHeaderFromResponse(resp), request, userId: user?.id ?? "", tenantId: user?.tenant_id ?? "" };
}

/** A browser signed in as one of the run's staff; printing is stood in for. */
async function pageAs(browser: Browser, role: Role): Promise<Page> {
  const { username, password } = readRun<Creds>("secrets/creds.json")[role];
  const page = await (await browser.newContext()).newPage();
  await page.context().addInitScript(() => Object.assign(window, { print: () => {}, close: () => {} }));
  await loginAsRole(page, username, password);
  return page;
}

/** Saves a full-page screenshot into the run directory. */
async function shot(page: Page, name: string): Promise<void> {
  // ponytail: a fixed settle for fade-ins; the OPD queue polls, so the network never goes idle.
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: `${RUN}/shots/${LABEL}-${name}.png`, fullPage: true });
}

/** Searches the patient list by UHID, as the desk does, and returns the patient's row. */
async function findByUhid(page: Page, uhid: string) {
  await page.goto("/patients");
  await page.getByRole("textbox", { name: "Search patients by name, phone, UHID or Aadhaar" }).fill(uhid);
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: uhid, exact: true }) }).first();
  await expect(row, `UHID ${uhid} found`).toBeVisible({ timeout: 15_000 });
  return row;
}

/** The desk: registers a walk-in (queues the visit), then finds the target patient by UHID and prints the card. */
async function deskFlow(page: Page, known: Patient | null): Promise<Patient> {
  const person = { firstName: word(), lastName: word(), phone: `9${Date.now() % 1e9}`.padEnd(10, "7"), ageYears: 34 };
  const department = known?.department ?? readRun<{ department: string }>("dept.json").department;
  const desk = new RegistrationDesk(page);
  await desk.open();
  await desk.register({ ...person, sex: "Female", department });
  const toast = page.getByText(/UHID: \S+/).first();
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const uhid = (await toast.innerText()).match(/UHID: (\S+?)(?: ·|$)/)?.[1] ?? "";
  const made = { uhid, name: `${person.firstName} ${person.lastName}`, department };
  const target = known ?? made;
  const row = await findByUhid(page, target.uhid);
  await expect(row, "the same patient").toContainText(target.name);
  const popup = page.waitForEvent("popup");
  await row.getByRole("button", { name: new RegExp(`^Print (ID )?card for ${target.uhid}$`) }).click();
  const card = await popup;
  await expect(card.locator(".uhid")).toHaveText(target.uhid);
  await card.screenshot({ path: `${RUN}/shots/${LABEL}-card.png` });
  await shot(page, "desk");
  return made;
}

/** The admin: server version (when the server reports it), the bricks unchanged, the system health screen. */
async function adminFlow(page: Page, request: APIRequestContext): Promise<void> {
  const { username, password } = readRun<Creds>("secrets/creds.json").admin;
  const ctx = await signIn(request, username, password);
  const health = await api<{ server_version?: string }>(ctx, "GET", "/api/setup/health");
  const want = process.env.STAGING_EXPECT_VERSION;
  if (health.server_version && want) expect(health.server_version, "server version").toBe(want);
  writeRun(`health-${LABEL}.json`, health);
  const on = (await api<Brick[]>(ctx, "GET", "/api/setup/modules")).filter((m) => m.status === "enabled");
  expect(on.map((m) => m.code).sort(), "bricks on").toEqual(readRun<{ on: string[] }>("bricks.json").on);
  await page.goto("/admin/settings#system-health");
  // A web build with the version row shows the server's beside its own on System health.
  if (health.server_version && process.env.STAGING_WEB_SHOWS_VERSION) await expect(page.getByText(`Server v${health.server_version}`)).toBeVisible({ timeout: 20_000 });
  await shot(page, "admin");
}

test("setup", async ({ request }) => {
  const initial = readFileSync(`${RUN}/secrets/admin-initial`, "utf8").trim();
  const adminPassword = newPassword();
  await api(await signIn(request, "admin", initial), "POST", "/api/auth/change-password", {
    current_password: initial,
    new_password: adminPassword,
    email: "it-admin@staging.example.org",
  });
  const root = await signIn(request, "admin", adminPassword);
  // Switch the rest off until nothing more goes; "available" bricks still count as needing theirs.
  const refused: Record<string, string> = {};
  let bricks: Brick[] = [];
  for (let pass = 0; pass < 5; pass += 1) {
    bricks = await api(root, "GET", "/api/setup/modules");
    const left = bricks.filter((m) => m.status !== "disabled" && !KEEP_ON.has(m.code));
    if (left.length === 0) break;
    for (const m of left) {
      await api(root, "PUT", `/api/setup/modules/${m.code}`, { status: "disabled" }).catch((e: Error) => {
        refused[m.code] = e.message.split("\n")[1] ?? e.message;
      });
    }
  }
  writeRun("bricks.json", { on: bricks.filter((m) => m.status === "enabled").map((m) => m.code).sort(), refused });
  // The hospital's numbering: UHID 1, 2, 3 (no prefix, no padding).
  await api(root, "PUT", "/api/setup/sequences/UHID", { prefix: "", pad_width: 0 });
  const suffix = randomBytes(3).toString("hex");
  const department = `Staging OPD ${suffix}`;
  const dept = await api<{ id: string }>(root, "POST", "/api/setup/departments", {
    code: `S${suffix.toUpperCase()}`,
    name: department,
    department_type: "clinical",
  });
  const doctor = { specialization: department, medical_registration_number: `STG-${suffix}`, qualification: "MD" };
  const creds = {} as Creds;
  for (const [key, role, extra] of [
    ["receptionist", "receptionist", {}],
    ["doctor", "doctor", doctor],
    ["admin", "hospital_admin", {}],
  ] as const) {
    const username = `stg_${key.slice(0, 6)}_${suffix}`;
    const password = newPassword();
    const email = `${username}@staging.example.org`;
    const user = { username, email, password, full_name: `Staging ${key}`, role, department_ids: [dept.id] };
    await api(root, "POST", "/api/setup/users", { ...user, ...extra });
    creds[key] = { username, password };
  }
  writeRun("secrets/creds.json", creds);
  writeRun("dept.json", { department });
});

for (const phase of ["baseline", "verify"]) {
  test(phase, async ({ browser, request }) => {
    const known = phase === "verify" ? readRun<Patient>("baseline.json") : null;
    const made = await deskFlow(await pageAs(browser, "receptionist"), known);
    if (!known) writeRun("baseline.json", made);
    const doctor = await pageAs(browser, "doctor");
    const queue = new OpdWorklist(doctor);
    await queue.open(made.department);
    await queue.row((known ?? made).uhid);
    await shot(doctor, "doctor");
    await adminFlow(await pageAs(browser, "admin"), request);
  });
}

test("oldtab", async ({ browser }) => {
  const { uhid } = readRun<Patient>("baseline.json");
  const page = await pageAs(browser, "receptionist");
  await findByUhid(page, uhid);
  let reloads = 0;
  page.on("load", () => {
    reloads += 1;
  });
  execSync(process.env.STAGING_UPDATE_CMD ?? "false", { stdio: "inherit" });
  // Move on inside the app, as a click would: a lazy screen the tab has not loaded yet.
  await page.evaluate(() => {
    window.history.pushState({}, "", "/patients/register");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByText("Patient registration"), "the old tab still works").toBeVisible({ timeout: 30_000 });
  writeRun(`oldtab-${LABEL}.json`, { reloads });
  // After a rollback the tab's own chunks are gone: it must reload itself, exactly once.
  const exact = process.env.STAGING_EXPECT_RELOADS;
  if (exact) expect(reloads, "reloads onto the served build").toBe(Number(exact));
  else expect(reloads, "at most one reload").toBeLessThanOrEqual(1);
  await shot(page, "oldtab");
  await findByUhid(page, uhid);
});
