/**
 * In-memory `SecretStore` for tests + dev. NEVER ship in production —
 * loses data on app restart and exposes plaintext to memory dumps.
 */

import type {
  SecretStore,
  SecretStoreReadOptions,
  SecretStoreWriteOptions,
} from "./types.js";

export class InMemorySecretStore implements SecretStore {
  private store = new Map<string, string>();

  async getItem(key: string, _opts?: SecretStoreReadOptions): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(
    key: string,
    value: string,
    _opts?: SecretStoreWriteOptions,
  ): Promise<void> {
    this.store.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  size(): number {
    return this.store.size;
  }
}
