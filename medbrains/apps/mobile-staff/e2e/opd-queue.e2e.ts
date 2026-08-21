import { by, device, element, expect as detoxExpect } from "detox";

import { awaitScreen, COLD_START_TIMEOUT, signIn, tapId } from "./helpers";
import { type Identity, provisionIdentity, retireIdentity } from "./identities";

/**
 * The doctor and the waiting room work one queue.
 *
 * Check-in used to write three parallel queues that advanced independently: the
 * doctor called the next patient in `opd_queues` while the board read a table
 * nothing advanced.
 */
describe("OPD queue", () => {
  let identity: Identity;

  beforeAll(async () => {
    identity = await provisionIdentity("doctor");
    await device.clearKeychain();
    await device.launchApp({
      delete: true,
      newInstance: true,
      permissions: { camera: "YES", notifications: "YES" },
    });
    await signIn(identity.username, identity.password);
    await awaitScreen("module-home-doctor", COLD_START_TIMEOUT);
  });

  afterAll(async () => {
    await retireIdentity(identity);
  });

  it("opens the doctor's queue", async () => {
    await tapId("module-action-queue");
    await awaitScreen("screen-doctor-queue");
  });

  it("never offers a transition the queue is not in", async () => {
    // The three buttons are one act on one queue and take one permission. A
    // screen offering "Mark complete" on a patient who has not been called is a
    // control promising what the server would refuse.
    await detoxExpect(element(by.id("queue-mark-complete"))).not.toBeVisible();
  });
});
