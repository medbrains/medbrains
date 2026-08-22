/**
 * Auth state for mobile shells. Zustand-backed; reads/writes through
 * the configured `SecretStore` so JWTs never touch AsyncStorage.
 */

import { create } from "zustand";
import type { SecretStore } from "../secret-store/index.js";
import { SECRET_KEYS } from "../secret-store/index.js";
import type { TenantIdentity } from "../types.js";

export interface AuthState {
  identity: TenantIdentity | null;
  hydrating: boolean;
  biometricRequired: boolean;
  hydrate: (store: SecretStore) => Promise<void>;
  signIn: (store: SecretStore, identity: TenantIdentity, refreshToken?: string) => Promise<void>;
  /**
   * Sign in from a bare token, for surfaces that are paired rather than
   * logged in.
   *
   * A display has no username to type: it is approved by an administrator and
   * handed a JWT. The claims already carry the tenant, the role, the
   * permissions and the departments -- the same fields `hydrate` reads back on
   * every launch -- so there is nothing to fetch and nothing for the caller to
   * assemble by hand. Returns false when the token is unreadable, rather than
   * seating an identity with empty permissions that would silently render an
   * empty display.
   */
  signInWithJwt: (store: SecretStore, jwt: string, refreshToken?: string) => Promise<boolean>;
  signOut: (store: SecretStore) => Promise<void>;
  setBiometricRequired: (required: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  identity: null,
  hydrating: true,
  biometricRequired: false,

  hydrate: async (store) => {
    set({ hydrating: true });
    const jwt = await store.getItem(SECRET_KEYS.jwt, {
      requireAuthentication: false,
    });
    if (!jwt) {
      set({ identity: null, hydrating: false });
      return;
    }
    const identity = decodeJwtIdentity(jwt);
    set({ identity, hydrating: false });
  },

  signIn: async (store, identity, refreshToken) => {
    await store.setItem(SECRET_KEYS.jwt, identity.jwt, {
      keychainAccessible: "whenUnlockedThisDeviceOnly",
    });
    if (refreshToken) {
      await store.setItem(SECRET_KEYS.refreshToken, refreshToken, {
        keychainAccessible: "whenUnlockedThisDeviceOnly",
      });
    }
    set({ identity });
  },

  signInWithJwt: async (store, jwt, refreshToken) => {
    const identity = decodeJwtIdentity(jwt);
    if (!identity) return false;
    await store.setItem(SECRET_KEYS.jwt, jwt, {
      keychainAccessible: "whenUnlockedThisDeviceOnly",
    });
    if (refreshToken) {
      await store.setItem(SECRET_KEYS.refreshToken, refreshToken, {
        keychainAccessible: "whenUnlockedThisDeviceOnly",
      });
    }
    set({ identity });
    return true;
  },

  signOut: async (store) => {
    await store.deleteItem(SECRET_KEYS.jwt);
    await store.deleteItem(SECRET_KEYS.refreshToken);
    set({ identity: null });
  },

  setBiometricRequired: (required) => set({ biometricRequired: required }),
}));

function decodeJwtIdentity(jwt: string): TenantIdentity | null {
  const parts = jwt.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    return {
      tenantId: String(payload.tenant_id ?? ""),
      userId: String(payload.sub ?? ""),
      jwt,
      role: payload.role == null ? null : String(payload.role),
      permissions: Array.isArray(payload.permissions) ? (payload.permissions as string[]) : [],
      departmentIds: Array.isArray(payload.department_ids)
        ? (payload.department_ids as string[])
        : [],
    };
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(b64);
  }
  return decodeBase64(b64);
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64(input: string): string {
  const stripped = input.replace(/=+$/u, "");
  let bits = 0;
  let bitCount = 0;
  let out = "";
  for (const ch of stripped) {
    const v = BASE64_ALPHABET.indexOf(ch);
    if (v < 0) {
      continue;
    }
    bits = (bits << 6) | v;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      out += String.fromCharCode((bits >> bitCount) & 0xff);
    }
  }
  return out;
}
