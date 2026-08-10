/**
 * The device-sync setup step, as a module every app can register.
 *
 * Defined here rather than per app because every surface that syncs
 * needs the identical step — a camp phone, a ward tablet, a vendor
 * device. Copying it into each registry is how three of them end up
 * with three different versions of the same setup flow.
 *
 * It is a module rather than a settings row because it is a step
 * someone is walked through: an administrator on a laptop asks the
 * person holding the device to read a key out. It has to be findable
 * while that conversation is happening.
 *
 * No permission gate. Minting a key admits nothing on its own — the
 * key is inert until an administrator binds it — so showing your own
 * device's key needs no more right than holding the device.
 */

import type { AppSurfaceCode } from "../app-surfaces.js";
import type { Module } from "../types.js";
import { SyncSetupScreen } from "./sync-setup-screen.js";

export function createDeviceSyncModule(appCodes?: ReadonlyArray<AppSurfaceCode>): Module {
  return {
    id: "device-sync",
    displayName: "Device sync",
    icon: () => null,
    requiredPermissions: [],
    navigator: SyncSetupScreen,
    appCodes,
    tags: ["device", "sync", "pairing", "offline", "camp"],
  };
}
