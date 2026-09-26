/**
 * Counters (RFCs/modules/RFC-MODULE-token-queues.md, P2, scenario 11).
 *
 * A pharmacy runs windows. Once the administrator lists them, the desk is
 * offered exactly those windows, cannot call without naming one, and the
 * waiting-room board tells the patient which window to go to.
 */
import { api } from "../helpers/api";
import { QueueAdmin } from "./pages/queue-admin";
import { TokenConsole } from "./pages/token-console";
import { WaitingRoomDisplay } from "./pages/waiting-room-display";
import { expect, test } from "./support/world";

test("the desk calls to the queue's own windows, and the board names the window", async ({
  hospital,
}) => {
  test.setTimeout(120_000);
  const dept = await hospital.department("Pharmacy windows");
  const suffix = dept.name.split(" ").at(-1) ?? "";
  const windows = [`Window A ${suffix}`, `Window B ${suffix}`];
  const queue = await api<{ id: string }>(hospital.admin, "POST", "/api/queues", {
    name: `Counters ${dept.name}`,
    module: "opd",
    scope: "department",
    scope_id: dept.id,
    prefix: "W",
    start_at: 1,
    pad_width: 3,
    reset_rule: "daily",
    max_tokens_per_period: null,
    lifecycle: "permanent",
    valid_from: null,
    valid_until: null,
    status: "active",
  });

  // The administrator creates the two windows for this queue.
  const admin = new QueueAdmin(await hospital.asAdmin());
  await admin.open();
  await admin.createCounters(queue.id, windows);

  // Starting data: a patient waiting (no screen issues a bare token).
  const token = await api<{ number: string }>(hospital.admin, "POST", "/api/tokens/issue", {
    module: "opd",
    scope: "department",
    scope_id: dept.id,
  });

  const deskPage = await hospital.as("receptionist");
  const desk = new TokenConsole(deskPage);
  await desk.open(dept.name);
  expect(await desk.counterChoices(), "only this queue's windows").toEqual(windows);

  // Calling without naming a window is refused, in words.
  await desk.callNext();
  await expect(deskPage.getByText(/Choose your counter/)).toBeVisible();

  await desk.chooseCounter(windows[1] ?? "");
  await desk.callNext();

  const board = new WaitingRoomDisplay(await hospital.as("receptionist"));
  await board.open(dept.id);
  await board.expectStatus(token.number, "Called");
  await board.expectCounter(token.number, windows[1] ?? "");
});
