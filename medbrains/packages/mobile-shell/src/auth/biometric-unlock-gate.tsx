/**
 * `BiometricUnlockGate` — wraps the navigator and forces a biometric
 * unlock whenever the app returns to foreground (and the tenant
 * policy / per-user setting requires it). Children render only
 * after a successful unlock.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppState, View } from "react-native";
import type { AppStateStatus } from "react-native";
import { Button, Surface, Text } from "react-native-paper";
import { FOREST_COPPER_PALETTE } from "../theme/forest-copper.js";
import { requestBiometricUnlock } from "../biometric/expo-local-auth.js";
import { useAuthStore } from "./auth-store.js";

export interface BiometricUnlockGateProps {
  children: ReactNode;
  promptMessage?: string;
}

export function BiometricUnlockGate({
  children,
  promptMessage = "Unlock MedBrains",
}: BiometricUnlockGateProps): ReactNode {
  const required = useAuthStore((s) => s.biometricRequired);
  const identity = useAuthStore((s) => s.identity);
  const [unlocked, setUnlocked] = useState(!required);
  const lastState = useRef<AppStateStatus>(AppState.currentState);

  const attemptUnlock = useCallback(async () => {
    const result = await requestBiometricUnlock({ promptMessage });
    setUnlocked(result.ok);
  }, [promptMessage]);

  useEffect(() => {
    if (!required || !identity) {
      setUnlocked(true);
      return;
    }
    if (!unlocked) {
      void attemptUnlock();
    }
  }, [required, identity, unlocked, attemptUnlock]);

  useEffect(() => {
    if (!required) {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      if (lastState.current.match(/inactive|background/) && next === "active") {
        setUnlocked(false);
      }
      lastState.current = next;
    });
    return () => sub.remove();
  }, [required]);

  if (!required || unlocked || !identity) {
    return <>{children}</>;
  }

  return (
    <Surface
      style={{
        flex: 1,
        backgroundColor: FOREST_COPPER_PALETTE.canvas,
        justifyContent: "center",
        padding: 24,
      }}
    >
      <View style={{ alignItems: "center" }}>
        <Text
          variant="headlineSmall"
          style={{ color: FOREST_COPPER_PALETTE.brand, marginBottom: 12 }}
        >
          Locked
        </Text>
        <Text
          variant="bodyMedium"
          style={{ color: FOREST_COPPER_PALETTE.ink, marginBottom: 24, textAlign: "center" }}
        >
          {promptMessage}
        </Text>
        <Button mode="contained" onPress={attemptUnlock}>
          Unlock
        </Button>
      </View>
    </Surface>
  );
}
