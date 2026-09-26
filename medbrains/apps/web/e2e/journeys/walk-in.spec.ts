/**
 * A walk-in, end to end, as the hospital runs it — each person on their own
 * screen, logged in as themselves:
 *
 *   front desk registers the patient → the desk reads out the token →
 *   the doctor calls them from the OPD screen → the waiting-room display shows
 *   the number called (never the name) → the patient's phone gets the SMS with
 *   the same number and the room → the doctor sees them and completes the
 *   visit → the number leaves the display.
 *
 * Starting data only through the API: the department, and the hospital's
 * choice to send token-call SMS. Every step the journey is about is a click.
 */
import { OpdWorklist } from "./pages/opd-worklist";
import { Phone } from "./pages/phone";
import { RegistrationDesk } from "./pages/registration-desk";
import { WaitingRoomDisplay } from "./pages/waiting-room-display";
import { expect, freshPerson, test } from "./support/world";

test("a walk-in is registered, called, told by SMS, and seen", async ({ hospital }) => {
  // Four people, five screens, a pipeline and an outbox round trip.
  test.setTimeout(180_000);
  const dept = await hospital.department("Walk-in OPD");
  await hospital.setting("notifications", "token_call_sms", true);
  const doctorOnDuty = await hospital.doctor();
  const patient = {
    ...freshPerson(),
    sex: "Female" as const,
    department: dept.name,
    // The desk names the consulting doctor — that is what lets them open the
    // patient's visit, as in a real hospital.
    consultant: doctorOnDuty.fullName,
  };
  const fullName = `${patient.firstName} ${patient.lastName}`;

  // Front desk.
  const desk = await hospital.as("receptionist");
  const registration = new RegistrationDesk(desk);
  await registration.open();
  await registration.register(patient);
  const toast = desk.getByText(/UHID: .* · token .*/);
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const [, uhid, token] = (await toast.innerText()).match(/UHID: (\S+) · token (\S+)/) ?? [];
  expect(uhid, "the desk reads out a UHID").toBeTruthy();
  expect(token, "and the number the board will call").toBeTruthy();

  // The waiting room.
  const display = new WaitingRoomDisplay(await hospital.as("receptionist"));
  await display.open(dept.id);
  await expect(display.token(token, "Waiting")).toBeVisible({ timeout: 15_000 });
  await display.expectNoName(patient.lastName);

  // The doctor.
  const doctor = new OpdWorklist(await hospital.as("doctor"));
  await doctor.open(dept.name);
  await doctor.act(fullName, "Call patient");
  await expect(display.token(token, "Called")).toBeVisible({ timeout: 15_000 });
  await display.expectNoName(patient.lastName);

  // The patient's phone.
  const phone = new Phone(await hospital.asAdmin());
  await phone.openFor(uhid);
  await phone.received(
    "SMS",
    "sms.token_called",
    new RegExp(`Token ${token} has been called\\. Please come to ${dept.name}\\.`),
  );

  // The consultation.
  await doctor.act(fullName, "Start consultation");
  await doctor.act(fullName, "Complete visit");
  await expect(display.token(token, "Called")).toHaveCount(0, { timeout: 15_000 });
  await expect(display.token(token, "In progress")).toHaveCount(0);
});
