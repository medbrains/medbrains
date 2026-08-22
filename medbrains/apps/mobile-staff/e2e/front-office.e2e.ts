import { by, device, element, expect as detoxExpect } from "detox";

import { awaitScreen, COLD_START_TIMEOUT, signIn, tapId, tapIdScrollingIn } from "./helpers";
import { type Identity, provisionIdentity, retireIdentity } from "./identities";

/**
 * Reception: registration, the visitor desk and the enquiry log.
 *
 * The last two were menu entries with a permission on them and no screen
 * behind them — the module home advertised "Issue, check-in, revoke" and the
 * tap went nowhere, while the backend had had registrations, passes, check-in,
 * check-out and revocation since the front-office module shipped.
 *
 * The registration spec stops at the form rather than submitting one. Creating
 * a patient from a test run leaves a real record in a real tenant that no
 * `afterAll` can withdraw — there is no deletion path for a patient, by
 * design. What is worth pinning here is that the desk can reach the form and
 * that the form refuses to submit empty, which is the guard, not the row.
 */
describe("reception desk", () => {
  let identity: Identity;

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
  });

  afterAll(async () => {
    await retireIdentity(identity);
  });

  it("reaches patient registration", async () => {
    await tapId("module-action-register");
    await awaitScreen("screen-register-patient");
  });

  it("will not register an empty patient", async () => {
    // The submit is disabled until the form is valid. A registration desk that
    // accepts a blank identity issues a UHID to nobody, and every record made
    // against it afterwards belongs to nobody.
    await detoxExpect(element(by.id("register-patient-submit"))).not.toBeVisible();
  });

  it("opens the visitor desk from the module home", async () => {
    // Back through the app's own control rather than relaunching. A relaunch
    // costs a cold start per test and, more to the point, tests a path nobody
    // walks: a receptionist finishes a registration and goes back.
    await tapId("screen-back");
    await awaitScreen("module-home-reception");
    await tapIdScrollingIn("module-action-passes", "module-home-reception");
    await awaitScreen("screen-visitor-desk");
  });

  it("offers registering a visitor rather than a dead menu entry", async () => {
    await tapId("visitor-desk-register");
    await awaitScreen("visitor-register-form");
    await detoxExpect(element(by.id("visitor-name"))).toBeVisible();
  });

  it("opens the enquiry desk, which was a dead menu entry", async () => {
    // The previous test left the register form open, and that button is now
    // "Cancel". Closing it explicitly rather than assuming the state, because
    // a spec that depends on where the last one stopped fails for reasons that
    // have nothing to do with what it is checking.
    await tapId("visitor-desk-register");
    await tapId("screen-back");
    await awaitScreen("module-home-reception");
    await tapIdScrollingIn("module-action-enquiry", "module-home-reception");
    await awaitScreen("screen-enquiry-desk");
  });
});
