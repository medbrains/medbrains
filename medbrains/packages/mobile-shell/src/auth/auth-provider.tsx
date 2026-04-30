/**
 * `AuthProvider` — wires the secret store into the auth zustand
 * store and runs hydration on mount. Hosts wrap their navigator in
 * this; downstream code reads `useAuthStore()` directly.
 */

import { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import type { SecretStore } from "../secret-store/index.js";
import { useAuthStore } from "./auth-store.js";

const SecretStoreContext = createContext<SecretStore | null>(null);

export interface AuthProviderProps {
  secretStore: SecretStore;
  children: ReactNode;
}

export function AuthProvider({ secretStore, children }: AuthProviderProps): ReactNode {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate(secretStore);
  }, [hydrate, secretStore]);

  return (
    <SecretStoreContext.Provider value={secretStore}>
      {children}
    </SecretStoreContext.Provider>
  );
}

export function useSecretStore(): SecretStore {
  const ctx = useContext(SecretStoreContext);
  if (!ctx) {
    throw new Error("useSecretStore called outside AuthProvider");
  }
  return ctx;
}
