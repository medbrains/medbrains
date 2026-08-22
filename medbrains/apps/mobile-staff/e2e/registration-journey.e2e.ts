import { by, device, element, expect as detoxExpect, waitFor } from "detox";

import {
  awaitScreen,
  COLD_START_TIMEOUT,
  assertScreen,
  frame,
  signIn,
  tapAtFormEnd,
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
    // The screen, not an element on it: the header alone would be satisfied by
    // a half-rendered form.
    await assertScreen("screen-register-patient", [
      "register-patient-form",
      "field-first_name",
      "field-last_name",
    ]);
    await frame("01-registration-form");

    // Phone before the names, so the last field typed into has a return key.
    // A phone-pad keyboard has none, and `tapReturnKey` on it silently does
    // nothing — leaving the keyboard up, the form shrunk around it, and the
    // submit permanently below the fold.
    await element(by.id("field-phone")).typeText("9876500000");
    await element(by.id("field-first_name")).typeText(firstName);
    await element(by.id("field-last_name")).typeText(lastName);
    await frame("02-details-entered");
    await tapAtFormEnd("register-patient-submit", "register-patient-form", {
      dismissKeyboardFrom: "field-last_name",
    });

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
    await assertScreen("screen-start-visit", ["start-visit-form"]);
    await frame("06-opd-registration");

    // The first department the server offered. A spec cannot know the ids in
    // advance, and which department a walk-in is sent to is not what this
    // journey is about — that a token comes back is.
    await tapId("start-visit-department-0");
    await frame("07-department-chosen");

    await tapAtFormEnd("start-visit-submit", "start-visit-form");

    // The token is the point of the whole journey: it is what the patient is
    // handed and what the waiting-room board shows. Asserting the screen
    // rendered would have let this pass without one, which it did.
    await waitFor(element(by.id("start-visit-token")))
      .toBeVisible()
      .withTimeout(20_000);
    await frame("08-token-issued");
  });
});
