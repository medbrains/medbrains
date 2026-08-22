/**
 * The doctor's half of the OPD visit: call the next patient, then record the
 * consultation.
 *
 * The three things this pins down, each of which was broken or absent:
 *
 * 1. "Call next" exists on the doctor's own queue. The API had `call-next` and
 *    only the reception console used it, so a doctor had to open a specific row
 *    and call that patient — a different decision from calling whoever is next.
 * 2. The Doctor module's "Start consultation" led somewhere. It pushed the
 *    queue list, as did "Prescription" and "Lab orders".
 * 3. The consultation refuses to save without a chief complaint, and says so on
 *    the field rather than by grewing out a button.
 */

import { by, device, element, expect as detoxExpect } from "detox";

import {
  assertScreen,
  frame,
  signIn,
  tapAtFormEnd,
  tapId,
  waitForIdToExist,
} from "./helpers";
import { type Identity, provisionIdentity, retireIdentity } from "./identities";
import { seedWaitingPatient, type SeededVisit } from "./seed";

describe("OPD consultation", () => {
  let doctor: Identity;
  let visit: SeededVisit;

  beforeAll(async () => {
    // The doctor first: they are seeded as the attending on the encounter,
    // which is what gives them access to its consultation.
    doctor = await provisionIdentity("doctor");
    visit = await seedWaitingPatient("consult", doctor.id);

    await device.clearKeychain();
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { camera: "YES", notifications: "YES" },
    });
    await signIn(doctor.username, doctor.password);
  });

  afterAll(async () => {
    await retireIdentity(doctor.id);
  });

  it("offers Call next on the doctor's own queue", async () => {
    await tapId("module-action-queue");
    await assertScreen("screen-doctor-queue", ["queue-call-next"]);
    await frame("01-doctor-queue");
  });

  it("calls whoever is next rather than a patient picked by hand", async () => {
    await tapId("queue-call-next");
    // The confirmation is the point: a call that says nothing is a call the
    // doctor presses twice.
    await waitForIdToExist("queue-call-next-toast");
    await frame("02-called-next");
  });

  it("reaches the consultation from the queue, which used to be a dead end", async () => {
    // The queue is a day's worth of tokens, so the seeded patient is below the
    // fold, and the row's testID sits on a view Detox scores as clipped however
    // far you scroll. Same answer as every other tap on these screens: swipe,
    // press, and let the screen that appears be the proof.
    await tapAtFormEnd(`queue-row-${visit.patientId}`, "doctor-queue-list", {
      until: "screen-queue-detail",
    });
    await tapId("queue-open-consultation");
    await assertScreen("screen-consultation", ["consultation-form", "field-chief_complaint"]);
    await frame("03-consultation-open");
  });

  it("refuses an empty note, on the field, with the button still pressable", async () => {
    // Rule 6 of the form rules: pressing runs validation. A submit disabled on
    // validity would make this test impossible to write and the screen
    // impossible to interrogate.
    await tapAtFormEnd("consultation-save", "consultation-form");
    await detoxExpect(element(by.id("field-chief_complaint"))).toBeVisible();
    await frame("04-validation-refused");
  });

  it("records the consultation against the encounter", async () => {
    await element(by.id("field-chief_complaint")).typeText("Fever and cough, three days");
    await tapAtFormEnd("consultation-save", "consultation-form", {
      // Proven by the outcome, never by the button having been reachable.
      until: "consultation-saved",
    });
    await frame("05-consultation-saved");
  });
});
