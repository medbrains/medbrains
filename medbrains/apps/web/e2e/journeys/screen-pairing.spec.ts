/**
 * Pairing a waiting-room screen (RFCs/modules/RFC-MODULE-token-queues.md,
 * P3b, scenario 38).
 *
 * A TV shows a code; the administrator approves it on Admin → Paired devices
 * for one department's OPD board. The screen then knows its board without
 * anyone touching it, reads it without patient names, and can do nothing else.
 */
import { request as http } from "@playwright/test";
import { BACKEND_URL as BACKEND } from "../helpers";
import { api } from "../helpers/api";
import { DevicesAdmin } from "./pages/devices-admin";
import { expect, test } from "./support/world";

test("an administrator pairs a TV to one department's board", async ({ hospital }) => {
  test.setTimeout(120_000);
  // The TV has no session of its own. A new context inherits the project's
  // storage state — the administrator's cookie, which the server reads before
  // a bearer token — so it is emptied explicitly.
  const request = await http.newContext({ storageState: { cookies: [], origins: [] } });
  const dept = await hospital.department("Paired OPD");

  // The TV asks for a code (its own screen for this is the next slice).
  const code = await (
    await request.post(`${BACKEND}/api/device-pairing/device-code`, {
      data: { app_variant: "tv", label: `Hall TV ${dept.name}` },
    })
  ).json();

  const admin = new DevicesAdmin(await hospital.asAdmin());
  await admin.open();
  await admin.approveScreen(code.user_code, dept.name);

  const token = await (
    await request.post(`${BACKEND}/api/device-pairing/device-token`, {
      data: { device_code: code.device_code },
    })
  ).json();
  expect(token.status).toBe("approved");
  const asScreen = { headers: { Authorization: `Bearer ${token.jwt}` } };

  // The administrator can see which board each screen shows.
  await admin.page.reload();
  await expect(
    admin.page.getByRole("row", { name: new RegExp(`Hall TV ${dept.name}`) }),
  ).toContainText(`OPD board · ${dept.name}`);

  const board = await (await request.get(`${BACKEND}/api/device/board`, asScreen)).json();
  expect(board).toMatchObject({ module: "opd", department_id: dept.id });

  await api(hospital.admin, "POST", "/api/tokens/issue", {
    module: "opd",
    scope: "department",
    scope_id: dept.id,
    patient_name: "Meena Raj",
  });
  const tokens = await (
    await request.get(
      `${BACKEND}/api/tokens/board?module=opd&scope=department&scope_id=${dept.id}`,
      asScreen,
    )
  ).json();
  expect(tokens[0].patient_name, "no names to a public screen").toBeNull();
  expect((await request.get(`${BACKEND}/api/patients`, asScreen)).status()).toBe(403);
});
