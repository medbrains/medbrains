import { by, device, element, expect as detoxExpect } from "detox";

import { awaitScreen, COLD_START_TIMEOUT, expectOneOf, signIn, tapId } from "./helpers";
import { type Identity, provisionIdentity, retireIdentity } from "./identities";

/**
 * The ward call board.
 *
 * A bedside tablet could raise a nurse call from the day the module shipped and
 * the only way to read one back was per-admission — which means already knowing
 * who is calling. Nobody was looking. This is the loop closing.
 *
 * Every matcher here is an id. The copy on these screens is clinical wording
 * that gets revised, and a suite anchored to sentences fails on the revision
 * rather than on the behaviour.
 */
describe("ward call board", () => {
  let identity: Identity;

  beforeAll(async () => {
    // Provisioned per run through the real API, never a static credential.
    identity = await provisionIdentity("nurse");
    await device.clearKeychain();
    // Permissions are pre-granted, not tapped through. A fresh install re-asks
    // for notifications, and the system alert sits over the app where Detox
    // cannot see past it — every matcher then times out and the suite reports
    // several broken screens when the truth is one dialog.
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { camera: "YES", notifications: "YES" },
    });
    await signIn(identity.username, identity.password);
    await awaitScreen("module-home-nurse", COLD_START_TIMEOUT);
  });

  afterAll(async () => {
    // Deactivated, not deleted: there is no real deletion path, and a test
    // account that outlives its test is an account somebody logs into.
    await retireIdentity(identity);
  });

  it("offers the board from the nurse module", async () => {
    await detoxExpect(element(by.id("module-action-calls"))).toBeVisible();
  });

  it("opens the board", async () => {
    await tapId("module-action-calls");
    await awaitScreen("screen-nurse-calls");
  });

  it("says which of the two things is true, never neither", async () => {
    // Rows, or an answered ward. The reason this is shaped as "exactly one" is
    // the third case: a board that renders an outage as emptiness tells a nurse
    // the ward is quiet.
    await expectOneOf(["nurse-calls-list", "nurse-calls-empty"]);
  });
});
