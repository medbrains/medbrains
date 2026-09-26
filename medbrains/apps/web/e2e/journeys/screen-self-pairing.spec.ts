/**
 * A waiting-room TV pairs itself (RFCs/modules/RFC-MODULE-token-queues.md,
 * P3b-2, scenario 39).
 *
 * A TV with nobody signed in opens /screen and shows a code. An administrator
 * approves it for one department's OPD board; the TV opens that board by
 * itself, number only. Revoked, it goes back to showing a code rather than a
 * dead board.
 */
import { routeApiDirect } from "../helpers";
import { api } from "../helpers/api";
import { DevicesAdmin } from "./pages/devices-admin";
import { WaitingRoomDisplay } from "./pages/waiting-room-display";
import { expect, test } from "./support/world";

test("a TV shows a code, is approved, and opens its own board", async ({ hospital, browser }) => {
  test.setTimeout(150_000);
  const dept = await hospital.department("Self-paired OPD");

  // A TV nobody has signed in on: no cookies, nothing stored.
  const tvContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const tv = await tvContext.newPage();
  await routeApiDirect(tv);
  await tv.goto("/screen");
  const shown = tv.getByTestId("screen-pairing-code");
  await expect(shown).toBeVisible({ timeout: 20_000 });
  const code = (await shown.innerText()).trim();

  const admin = new DevicesAdmin(await hospital.asAdmin());
  await admin.open();
  await admin.approveScreen(code, dept.name);

  // The TV opens its own board — nobody touched it.
  await expect(tv.getByText(`OPD · ${dept.name}`).first()).toBeVisible({ timeout: 20_000 });
  const token = await api<{ number: string }>(hospital.admin, "POST", "/api/tokens/issue", {
    module: "opd",
    scope: "department",
    scope_id: dept.id,
    patient_name: "Kavya Iyer",
  });
  const board = new WaitingRoomDisplay(tv);
  await board.expectStatus(token.number, "Waiting");
  await board.expectNoName("Kavya Iyer");

  // Revoked: the screen asks to be paired again.
  const devices = await api<{ id: string; label: string; revoked_at: string | null }[]>(
    hospital.admin,
    "GET",
    "/api/admin/paired-devices",
  );
  const paired = devices.find((d) => d.label === "Waiting-room screen" && !d.revoked_at);
  expect(paired, "the TV is listed as paired").toBeTruthy();
  await api(hospital.admin, "DELETE", `/api/admin/paired-devices/${paired?.id}`, {
    reason: "Screen moved",
  });
  await tv.reload();
  await expect(tv.getByTestId("screen-pairing-code")).toBeVisible({ timeout: 20_000 });
  await tvContext.close();
});
