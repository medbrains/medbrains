/**
 * Board and voice (RFCs/modules/RFC-MODULE-token-queues.md, P3).
 *
 * The administrator sets a queue to speak English and Tamil, twice. A TV
 * nobody has touched says its voice is off until someone presses a key; after
 * that, a call is spoken in both languages, twice, one character at a time.
 */
import { api } from "../helpers/api";
import { QueueAdmin } from "./pages/queue-admin";
import { TokenConsole } from "./pages/token-console";
import { WaitingRoomDisplay } from "./pages/waiting-room-display";
import { expect, test } from "./support/world";

test("a board speaks the queue's languages, and says when its voice is off", async ({
  hospital,
}) => {
  test.setTimeout(150_000);
  const dept = await hospital.department("Voice OPD");
  const name = `Voice ${dept.name}`;
  const queue = await api<{ id: string }>(hospital.admin, "POST", "/api/queues", {
    name,
    module: "opd",
    scope: "department",
    scope_id: dept.id,
    prefix: "V",
    start_at: 1,
    pad_width: 3,
    reset_rule: "daily",
    max_tokens_per_period: null,
    lifecycle: "permanent",
    valid_from: null,
    valid_until: null,
    status: "active",
  });

  const admin = new QueueAdmin(await hospital.asAdmin());
  await admin.open();
  await admin.find(name);
  await admin.setBoardAndVoice(queue.id, { initials: true, languages: ["en", "ta"], repeat: "Twice" });

  const boardPage = await hospital.as("receptionist");
  const board = new WaitingRoomDisplay(boardPage);
  await board.listen();
  await board.open(dept.id);
  // Nobody has touched this screen: the browser will not speak yet, and says so.
  await expect(boardPage.getByTestId("board-voice-blocked")).toBeVisible();
  await boardPage.keyboard.press("Space");
  await expect(boardPage.getByTestId("board-voice-blocked")).toHaveCount(0);

  const token = await api<{ number: string }>(hospital.admin, "POST", "/api/tokens/issue", {
    module: "opd",
    scope: "department",
    scope_id: dept.id,
  });
  const desk = new TokenConsole(await hospital.as("receptionist"));
  await desk.open(dept.name);
  await desk.callNext();
  await board.expectStatus(token.number, "Called");

  await expect.poll(async () => (await board.spoken()).length, { timeout: 15_000 }).toBe(4);
  const spoken = await board.spoken();
  expect(spoken.map((u) => u.lang)).toEqual(["en-IN", "ta-IN", "en-IN", "ta-IN"]);
  expect(spoken[0]?.text).toContain("V 0 0 1");
  expect(spoken[1]?.text).toContain("டோக்கன்");
});
