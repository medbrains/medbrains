import { by, device, element, expect as detoxExpect } from "detox";

import { awaitScreen, COLD_START_TIMEOUT, signIn, tapId } from "./helpers";
import { type Identity, provisionIdentity, retireIdentity } from "./identities";

/**
 * A dose cannot be given without a scan.
 *
 * The 5-rights check has been enforced server-side since the eMAR shipped, and
 * the phone posted `barcode_verified: false` and recorded the administration
 * anyway — so the wrong-patient guard existed on every surface except the one
 * carried to the bed.
 *
 * These specs deliberately never scan. A simulator has no barcode to show a
 * camera, and the assertion worth having is the negative one: if a future
 * change puts "Give now" back within reach of an unverified screen, this fails.
 */
describe("bedside medication administration", () => {
  let identity: Identity;

  beforeAll(async () => {
    identity = await provisionIdentity("nurse");
    await device.clearKeychain();
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { camera: "YES", notifications: "YES" },
    });
    await signIn(identity.username, identity.password);
    await awaitScreen("module-home-nurse", COLD_START_TIMEOUT);
  });

  afterAll(async () => {
    await retireIdentity(identity);
  });

  it("never offers the administration from the module home", async () => {
    await detoxExpect(element(by.id("bcma-give-now"))).not.toBeVisible();
  });

  it("reaches a bed through the shift list", async () => {
    await tapId("module-action-mar");
    await awaitScreen("screen-admissions");
  });
});
