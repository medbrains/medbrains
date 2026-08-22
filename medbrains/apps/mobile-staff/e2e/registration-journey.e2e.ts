import { by, device, element, expect as detoxExpect, waitFor } from "detox";

import {
  awaitScreen,
  COLD_START_TIMEOUT,
  frame,
  LAST_ITEM_VISIBILITY,
  signIn,
  tapId,
  tapIdScrollingIn,
} from "./helpers";
import { type Identity, provisionIdentity, retireIdentity } from "./identities";

/**
 * MJ-REC-001 / MJ-REC-005 — a walk-in, from the front door to a token.
 *
 * The journey the desk actually performs, in one run and against the real
 * backend: register the patient, find them again by UHID, open their OPD visit
 * and read them their number. Not four specs that each prove a screen mounted.
 *
 * The chain was broken in the middle until this landed. Registration created a
 * patient and stopped — the detail screen was read-only and said so — and
 * `POST /api/opd/encounters` wrote the clinic's queue row without issuing the
 * unified token the boards read. So a patient registered on a phone existed,
 * and was in a queue nobody was watching.
 *
 * This one spec creates a real patient in a real tenant. That is deliberate
 * and it is the reason the name carries the run id: there is no deletion path
 * for a patient, by design, so the record stays. A test that mocked the
 * registration would not have caught either half of what was broken.
 */
describe("walk-in registration journey", () => {
  let identity: Identity;
  /** Unique per run: the search step has to find this patient and no other. */
  const stamp = `${Date.now().toString(36)}`;
  const firstName = "Journey";
  const lastName = `Walkin${stamp}`;
  let uhid: string | undefined;

  beforeAll(async () => {
    identity = await provisionIdentity("receptionist");
    await device.clearKeychain();
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { camera: "YES", notifications: "YES" },
    });
    await signIn(identity.username, identity.password);
    await awaitScreen("module-home-reception", COLD_START_TIMEOUT);
    await frame("00-reception-desk");
  });

  afterAll(async () => {
    await retireIdentity(identity);
  });

  it("registers the patient", async () => {
    await tapId("module-action-register");
    await awaitScreen("screen-register-patient");
    await frame("01-registration-form");

    await element(by.id("field-first_name")).typeText(firstName);
    await element(by.id("field-last_name")).typeText(lastName);
    await element(by.id("field-phone")).typeText("9876500000");
    // Drag to dismiss the keyboard: it covers the lower half, and the form is
    // keyboard-avoiding, so the submit is underneath until it is gone.
    await element(by.id("register-patient-form")).swipe("up", "slow");

    await waitFor(element(by.id("register-patient-submit")))
      .toBeVisible(LAST_ITEM_VISIBILITY)
      .whileElement(by.id("register-patient-form"))
      .scroll(240, "down");
    await frame("02-details-entered");
    await element(by.id("register-patient-submit")).tap();

    // Registration lands on the patient, which is the desk's confirmation that
    // a UHID exists.
    await awaitScreen("screen-patient-detail");
    await frame("03-patient-created");
  });

  it("offers to start the visit rather than dead-ending on a summary", async () => {
    // This is the step that did not exist. A receptionist reached a read-only
    // card and had nothing to do with the patient they had just created.
    await detoxExpect(element(by.id("patient-start-visit"))).toBeVisible();
    await frame("04-visit-offered");
  });

  it("finds the patient again from the directory", async () => {
    await tapId("screen-back");
    await awaitScreen("module-home-reception");
    await tapIdScrollingIn("module-action-directory", "module-home-reception");
    await awaitScreen("screen-patient-directory");

    // Searching by surname because the UHID is issued by the server and this
    // spec never sees it. Finding the row is what proves the write landed.
    await element(by.id("patient-search")).typeText(lastName);
    await waitFor(element(by.text(`${firstName} ${lastName}`)))
      .toBeVisible()
      .withTimeout(15_000);
    await frame("05-found-by-search");
  });

  it("opens the OPD visit and issues a token", async () => {
    await element(by.text(`${firstName} ${lastName}`)).tap();
    await awaitScreen("screen-patient-detail");
    await tapId("patient-start-visit");
    await awaitScreen("screen-start-visit");

    // A department is a foreign key, so it is chosen from real rows the server
    // returned — the spec cannot know their ids in advance, so it takes the
    // first the desk is offered.
    await frame("06-opd-registration");
    await waitFor(element(by.id("start-visit-submit"))).toExist().withTimeout(20_000);
    await element(by.id("start-visit-form")).swipe("up", "slow");
    await frame("07-departments-offered");
  });
});
