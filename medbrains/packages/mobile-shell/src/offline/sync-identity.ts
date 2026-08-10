/**
 * This device's peer-to-peer sync identity.
 *
 * A paired device can already sync on the hospital LAN. Syncing from
 * anywhere else — a camp on cellular, or directly with another
 * volunteer's phone — needs a node key an administrator has bound to
 * this device. The device mints that key here and shows the public
 * half; a person reads it and binds it in Admin → Paired devices.
 *
 * # Minted once, kept forever
 *
 * The node id an administrator bound is the one peers expect. If this
 * device ever minted a second key it would look correctly paired and
 * silently stop being admitted, so the secret is written once and
 * every later launch derives the same node id from it.
 *
 * That makes the write ordering matter more than it looks: the key is
 * stored *before* it is returned, so a crash between minting and
 * showing costs a screen refresh rather than an identity.
 */

import { SECRET_KEYS, type SecretStore } from "../secret-store/index.js";
import { loadEdgeRnBindings } from "./edge-rn-loader.js";

export interface SyncIdentity {
  nodeId: string;
  /** True when this call created the key rather than recovering it. */
  minted: boolean;
}

/**
 * The node id for this device, minting one on first use.
 *
 * The secret never leaves secure storage — callers get the public
 * half only, so there is no path by which a screen or a log can end
 * up holding it.
 */
export async function ensureSyncIdentity(store: SecretStore): Promise<SyncIdentity> {
  const bindings = await loadEdgeRnBindings();

  const existing = await store.getItem(SECRET_KEYS.syncNodeKey);
  if (existing) {
    // Derived rather than stored alongside: a node id that disagrees
    // with the key this device dials with is indistinguishable, from
    // the admin screen, from a device that simply never connects.
    return { nodeId: bindings.nodeIdForSecret(existing), minted: false };
  }

  const identity = bindings.generateNodeIdentity();
  await store.setItem(SECRET_KEYS.syncNodeKey, identity.secretHex, {
    // The key is useless to another device and must survive a reboot
    // without a person present — a ward tablet powers back on into a
    // locked screen and should still be syncing.
    keychainAccessible: "whenUnlockedThisDeviceOnly",
  });
  return { nodeId: identity.nodeId, minted: true };
}

/**
 * The node id if this device already has one, without minting.
 *
 * For screens that report status. Minting is a decision — it happens
 * when someone is setting the device up, not when a status card
 * renders.
 */
export async function peekSyncIdentity(store: SecretStore): Promise<string | null> {
  const existing = await store.getItem(SECRET_KEYS.syncNodeKey);
  if (!existing) {
    return null;
  }
  const bindings = await loadEdgeRnBindings();
  return bindings.nodeIdForSecret(existing);
}

/**
 * Discard this device's sync identity.
 *
 * For unpairing and factory-reset paths. The bound key on the server
 * is revoked separately by an administrator; dropping it here only
 * stops this device presenting it, which is the half we control.
 */
export async function forgetSyncIdentity(store: SecretStore): Promise<void> {
  await store.deleteItem(SECRET_KEYS.syncNodeKey);
}
