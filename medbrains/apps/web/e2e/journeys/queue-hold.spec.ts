/**
 * Hold (RFCs/modules/RFC-MODULE-token-queues.md, P2b, scenario 31).
 *
 * A patient waiting for the doctor is sent for an ECG. The desk puts them on
 * hold: they keep their place, Call next passes over them, and the board
 * still shows their number. Back from the ECG, they are called before anyone
 * who arrived after them.
 */
import { api } from "../helpers/api";
import { TokenConsole } from "./pages/token-console";
import { WaitingRoomDisplay } from "./pages/waiting-room-display";
import { test } from "./support/world";

test("a patient sent for an ECG keeps their place on hold", async ({ hospital }) => {
  test.setTimeout(120_000);
  const dept = await hospital.department("Hold OPD");
  // Starting data: three patients waiting, in arrival order.
  const numbers: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const token = await api<{ number: string }>(hospital.admin, "POST", "/api/tokens/issue", {
      module: "opd",
      scope: "department",
      scope_id: dept.id,
    });
    numbers.push(token.number);
  }
  const [first = "", second = "", third = ""] = numbers;

  const desk = new TokenConsole(await hospital.as("receptionist"));
  await desk.open(dept.name);
  const board = new WaitingRoomDisplay(await hospital.as("receptionist"));
  await board.open(dept.id);

  // The first patient goes for an ECG.
  await desk.act(first, "hold");
  await desk.expectStatus(first, "On hold");
  await board.expectStatus(first, "On hold");

  await desk.callNext();
  await board.expectStatus(second, "Called");
  await board.expectStatus(first, "On hold");

  // Back from the ECG: ahead of the third patient, who came later.
  await desk.act(first, "back");
  await board.expectStatus(first, "Waiting");
  await desk.callNext();
  await board.expectStatus(first, "Called");
  await board.expectStatus(third, "Waiting");
});
