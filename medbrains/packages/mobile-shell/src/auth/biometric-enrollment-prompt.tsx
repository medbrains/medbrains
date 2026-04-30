/**
 * Post-login modal that asks the user to opt into biometric-gated
 * unlock. Patient apps default the answer to "skip"; staff apps
 * default to "enable" when tenant policy mandates it.
 */

import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { FOREST_COPPER_PALETTE } from "../theme/forest-copper.js";
import { useBiometricCapability } from "../biometric/use-biometric-capability.js";
import { useAuthStore } from "./auth-store.js";

export interface BiometricEnrollmentPromptProps {
  policy: "required" | "recommended" | "optional";
  onEnable: () => Promise<void>;
  onSkip: () => void;
}

export function BiometricEnrollmentPrompt({
  policy,
  onEnable,
  onSkip,
}: BiometricEnrollmentPromptProps): ReactNode {
  const { capability, loading } = useBiometricCapability();
  const setBiometricRequired = useAuthStore((s) => s.setBiometricRequired);

  if (loading || !capability.available) {
    return null;
  }

  const titleByKind: Record<NonNullable<typeof capability.kind>, string> = {
    face: "Use Face ID to unlock",
    fingerprint: "Use fingerprint to unlock",
    iris: "Use iris scan to unlock",
    passcode: "Use device passcode to unlock",
  };
  const title = capability.kind ? titleByKind[capability.kind] : "Enable quick unlock";

  return (
    <Card
      mode="outlined"
      style={{ margin: 16, borderColor: FOREST_COPPER_PALETTE.rule }}
    >
      <Card.Title
        title={title}
        titleStyle={{ color: FOREST_COPPER_PALETTE.brand }}
      />
      <Card.Content>
        <Text variant="bodyMedium" style={{ color: FOREST_COPPER_PALETTE.ink }}>
          {policy === "required"
            ? "Your hospital policy requires biometric unlock. We'll prompt every time the app comes back to the foreground."
            : "Quick unlock keeps your session in OS-managed secure storage. You can change this later in Settings."}
        </Text>
      </Card.Content>
      <Card.Actions>
        {policy !== "required" && (
          <Button onPress={onSkip}>Skip</Button>
        )}
        <Button
          mode="contained"
          onPress={async () => {
            await onEnable();
            setBiometricRequired(true);
          }}
        >
          Enable
        </Button>
      </Card.Actions>
      {policy === "required" && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text variant="bodySmall" style={{ color: FOREST_COPPER_PALETTE.brandDeep }}>
            Required by hospital policy.
          </Text>
        </View>
      )}
    </Card>
  );
}
