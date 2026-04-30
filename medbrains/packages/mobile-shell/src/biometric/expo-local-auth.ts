/**
 * Lazy wrapper over `expo-local-authentication`. Hosts always have
 * the dep installed (templates list it); we lazy-import so this
 * package can be typechecked without it.
 */

import type {
  BiometricCapability,
  BiometricUnlockOptions,
  BiometricUnlockResult,
} from "./types.js";

interface ExpoLocalAuthModule {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync(): Promise<number[]>;
  authenticateAsync(options?: {
    promptMessage?: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
  }): Promise<{ success: boolean; error?: string; warning?: string }>;
  AuthenticationType?: {
    FINGERPRINT: number;
    FACIAL_RECOGNITION: number;
    IRIS: number;
  };
}

let cached: ExpoLocalAuthModule | null = null;

async function loadExpoLocalAuth(): Promise<ExpoLocalAuthModule> {
  if (cached) {
    return cached;
  }
  const mod = (await import("expo-local-authentication")) as ExpoLocalAuthModule;
  cached = mod;
  return mod;
}

export async function probeBiometricCapability(): Promise<BiometricCapability> {
  const auth = await loadExpoLocalAuth();
  const [hasHardware, isEnrolled, supported] = await Promise.all([
    auth.hasHardwareAsync(),
    auth.isEnrolledAsync(),
    auth.supportedAuthenticationTypesAsync(),
  ]);
  const types = auth.AuthenticationType;
  let kind: BiometricCapability["kind"] = "passcode";
  if (types) {
    if (supported.includes(types.FACIAL_RECOGNITION)) {
      kind = "face";
    } else if (supported.includes(types.FINGERPRINT)) {
      kind = "fingerprint";
    } else if (supported.includes(types.IRIS)) {
      kind = "iris";
    }
  }
  return {
    available: hasHardware,
    enrolled: isEnrolled,
    kind: hasHardware ? kind : null,
  };
}

export async function requestBiometricUnlock(
  opts: BiometricUnlockOptions,
): Promise<BiometricUnlockResult> {
  const auth = await loadExpoLocalAuth();
  const result = await auth.authenticateAsync({
    promptMessage: opts.promptMessage,
    cancelLabel: opts.cancelLabel ?? "Cancel",
    disableDeviceFallback: opts.fallbackToPasscode === false,
  });
  if (result.success) {
    return { ok: true };
  }
  const reason = mapErrorToReason(result.error);
  return { ok: false, reason };
}

type FailureReason = Extract<BiometricUnlockResult, { ok: false }>["reason"];

function mapErrorToReason(error: string | undefined): FailureReason {
  if (!error) {
    return "unknown";
  }
  if (error.includes("user_cancel") || error.includes("UserCancel")) {
    return "user_cancel";
  }
  if (error.includes("lockout") || error.includes("Lockout")) {
    return "lockout";
  }
  if (error.includes("not_enrolled") || error.includes("NotEnrolled")) {
    return "not_enrolled";
  }
  return "unknown";
}
