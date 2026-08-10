/**
 * Reading and minting this device's sync identity from a screen.
 *
 * Split from [`SyncSetupScreen`] so the screen stays a pure render of
 * whatever state it is handed, and so a host that wants to show the
 * node id somewhere else — a settings row, a diagnostics panel — does
 * not have to reimplement the load.
 */

import { useCallback, useEffect, useState } from "react";
import { useSecretStore } from "../auth/auth-provider.js";
import { ensureSyncIdentity, peekSyncIdentity } from "../offline/sync-identity.js";

export type SyncIdentityState =
  | { status: "loading" }
  | { status: "absent" }
  | { status: "present"; nodeId: string }
  | { status: "failed"; reason: string };

export interface UseSyncIdentity {
  state: SyncIdentityState;
  /** Mints the key. Only ever called from an explicit action. */
  mint: () => Promise<void>;
  minting: boolean;
}

export function useSyncIdentity(): UseSyncIdentity {
  const secretStore = useSecretStore();
  const [state, setState] = useState<SyncIdentityState>({ status: "loading" });
  const [minting, setMinting] = useState(false);

  // Mount-only read of platform secure storage — an external system,
  // and the one case an effect is for. Reading never mints, so an
  // unmount mid-read leaves nothing behind to reconcile.
  useEffect(() => {
    let active = true;
    void peekSyncIdentity(secretStore)
      .then((nodeId) => {
        if (!active) return;
        setState(nodeId ? { status: "present", nodeId } : { status: "absent" });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setState({ status: "failed", reason: describe(cause) });
      });
    return () => {
      active = false;
    };
  }, [secretStore]);

  const mint = useCallback(async () => {
    setMinting(true);
    try {
      const identity = await ensureSyncIdentity(secretStore);
      setState({ status: "present", nodeId: identity.nodeId });
    } catch (cause) {
      setState({ status: "failed", reason: describe(cause) });
    } finally {
      setMinting(false);
    }
  }, [secretStore]);

  return { state, mint, minting };
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
