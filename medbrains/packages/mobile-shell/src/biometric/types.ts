/**
 * Biometric capability + unlock types.
 *
 * Maps `expo-local-authentication`'s capability bits onto a smaller
 * surface the rest of the shell uses. The shell is intentionally
 * agnostic about *which* biometric the device offers — login flow
 * just asks "can you unlock?" and "did the user unlock?".
 */

export type BiometricKind = "face" | "fingerprint" | "iris" | "passcode" | null;

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  kind: BiometricKind;
}

export type BiometricUnlockResult =
  | { ok: true }
  | { ok: false; reason: "user_cancel" | "lockout" | "not_enrolled" | "unknown" };

export interface BiometricUnlockOptions {
  promptMessage: string;
  cancelLabel?: string;
  fallbackToPasscode?: boolean;
}
