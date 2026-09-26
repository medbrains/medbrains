/**
 * Moving a waiting patient to another department
 * (RFCs/modules/RFC-MODULE-token-queues.md, P2, scenario 33).
 *
 * The desk registered a walk-in to General Medicine; they need Orthopaedics.
 * The desk moves them from the console: the patient gets Ortho's number and
 * keeps their place by arrival — after the Ortho patient who came before them,
 * ahead of the one who came later.
 */
import { api } from "../helpers/api";
import { RegistrationDesk } from "./pages/registration-desk";
import { TokenConsole } from "./pages/token-console";
import { WaitingRoomDisplay } from "./pages/waiting-room-display";
import { expect, freshPerson, test } from "./support/world";

test("a walk-in in the wrong department is moved and keeps their place", async ({ hospital }) => {
  test.setTimeout(150_000);
  const general = await hospital.department("General");
  const ortho = await hospital.department("Ortho");
  const issueOrtho = () =>
    api<{ number: string }>(hospital.admin, "POST", "/api/tokens/issue", {
      module: "opd",
      scope: "department",
      scope_id: ortho.id,
    });

  // Starting data: an Ortho patient who arrived first.
  const earlier = await issueOrtho();

  const deskPage = await hospital.as("receptionist");
  const registration = new RegistrationDesk(deskPage);
  await registration.open();
  await registration.register({ ...freshPerson(), sex: "Male", department: general.name });
  const toast = deskPage.getByText(/UHID: .* · token .*/);
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const [, , token = ""] = (await toast.innerText()).match(/UHID: (\S+) · token (\S+)/) ?? [];

  // Starting data: an Ortho patient who arrived after them.
  const later = await issueOrtho();

  const desk = new TokenConsole(deskPage);
  await desk.open(general.name);
  const moved = await desk.transfer(token, ortho.name);
  expect(moved, "the desk is told the new number").not.toBe("");

  const board = new WaitingRoomDisplay(await hospital.as("receptionist"));
  await board.open(ortho.id);
  await board.expectStatus(moved, "Waiting");

  // Ortho calls in arrival order.
  await desk.open(ortho.name);
  await desk.callNext();
  await board.expectStatus(earlier.number, "Called");
  await desk.callNext();
  await board.expectStatus(moved, "Called");
  await board.expectStatus(later.number, "Waiting");
});
