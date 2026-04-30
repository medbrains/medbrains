/**
 * Adapter contract over OS secure storage.
 *
 * iOS: Keychain via `expo-secure-store` with
 *   `WHEN_UNLOCKED_THIS_DEVICE_ONLY` + `BIOMETRIC_CURRENT_SET`
 *   when the caller passes `requireAuthentication: true`.
 * Android: Keystore via `expo-secure-store` with
 *   `setUserAuthenticationRequired(true)` when biometric-required.
 *
 * Hosts MUST route every JWT / device-cert / refresh-token / paired
 * edge cert read+write through this — no plaintext in AsyncStorage.
 */

export interface SecretStoreReadOptions {
  requireAuthentication?: boolean;
  authPrompt?: string;
}

export interface SecretStoreWriteOptions extends SecretStoreReadOptions {
  /**
   * iOS keychain accessibility constant; hosts can override per-key
   * for accessibility paths (e.g. patient app may relax for ABHA).
   */
  keychainAccessible?:
    | "whenUnlocked"
    | "whenUnlockedThisDeviceOnly"
    | "afterFirstUnlock";
}

export interface SecretStore {
  getItem(key: string, opts?: SecretStoreReadOptions): Promise<string | null>;
  setItem(key: string, value: string, opts?: SecretStoreWriteOptions): Promise<void>;
  deleteItem(key: string): Promise<void>;
  isAvailable(): Promise<boolean>;
}

export const SECRET_KEYS = {
  jwt: "medbrains.jwt",
  refreshToken: "medbrains.refresh",
  deviceCert: "medbrains.device_cert",
  deviceCertKey: "medbrains.device_cert_key",
  edgeCertFingerprint: "medbrains.edge_fingerprint",
  abhaToken: "medbrains.abha_token",
  pairingId: "medbrains.pairing_id",
} as const;

export type SecretKey = (typeof SECRET_KEYS)[keyof typeof SECRET_KEYS];
