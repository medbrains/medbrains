/**
 * `expo-secure-store` adapter implementing `SecretStore`.
 *
 * The expo-secure-store dependency is declared peer; we lazy-import
 * it so this package can be typechecked even when the host hasn't
 * installed Expo. Hosts (i.e. apps generated from the templates)
 * always have it.
 */

import type {
  SecretStore,
  SecretStoreReadOptions,
  SecretStoreWriteOptions,
} from "./types.js";

interface ExpoSecureStoreOptions {
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
  keychainAccessible?: number;
}

interface ExpoSecureStoreModule {
  getItemAsync(
    key: string,
    options?: ExpoSecureStoreOptions,
  ): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: ExpoSecureStoreOptions,
  ): Promise<void>;
  deleteItemAsync(key: string, options?: ExpoSecureStoreOptions): Promise<void>;
  isAvailableAsync(): Promise<boolean>;
  WHEN_UNLOCKED?: number;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: number;
  AFTER_FIRST_UNLOCK?: number;
}

let cached: ExpoSecureStoreModule | null = null;

async function loadExpoSecureStore(): Promise<ExpoSecureStoreModule> {
  if (cached) {
    return cached;
  }
  const mod = (await import("expo-secure-store")) as ExpoSecureStoreModule;
  cached = mod;
  return mod;
}

function mapAccessible(
  store: ExpoSecureStoreModule,
  level: SecretStoreWriteOptions["keychainAccessible"],
): number | undefined {
  switch (level) {
    case "whenUnlocked":
      return store.WHEN_UNLOCKED;
    case "whenUnlockedThisDeviceOnly":
    case undefined:
      return store.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
    case "afterFirstUnlock":
      return store.AFTER_FIRST_UNLOCK;
    default:
      return store.WHEN_UNLOCKED_THIS_DEVICE_ONLY;
  }
}

export class ExpoSecureStoreAdapter implements SecretStore {
  async getItem(
    key: string,
    opts?: SecretStoreReadOptions,
  ): Promise<string | null> {
    const store = await loadExpoSecureStore();
    return store.getItemAsync(key, {
      requireAuthentication: opts?.requireAuthentication,
      authenticationPrompt: opts?.authPrompt,
    });
  }

  async setItem(
    key: string,
    value: string,
    opts?: SecretStoreWriteOptions,
  ): Promise<void> {
    const store = await loadExpoSecureStore();
    await store.setItemAsync(key, value, {
      requireAuthentication: opts?.requireAuthentication,
      authenticationPrompt: opts?.authPrompt,
      keychainAccessible: mapAccessible(store, opts?.keychainAccessible),
    });
  }

  async deleteItem(key: string): Promise<void> {
    const store = await loadExpoSecureStore();
    await store.deleteItemAsync(key);
  }

  async isAvailable(): Promise<boolean> {
    const store = await loadExpoSecureStore();
    return store.isAvailableAsync();
  }
}
