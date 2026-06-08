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
import { mobileShellBiometricText } from "../biometric/biometric-text.js";
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
    face: mobileShellBiometricText("mobileShell.biometric.enrollment.title.face"),
    fingerprint: mobileShellBiometricText("mobileShell.biometric.enrollment.title.fingerprint"),
    iris: mobileShellBiometricText("mobileShell.biometric.enrollment.title.iris"),
    passcode: mobileShellBiometricText("mobileShell.biometric.enrollment.title.passcode"),
  };
  const title = capability.kind
    ? titleByKind[capability.kind]
    : mobileShellBiometricText("mobileShell.biometric.enrollment.title.default");

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
            ? mobileShellBiometricText("mobileShell.biometric.enrollment.message.required")
            : mobileShellBiometricText("mobileShell.biometric.enrollment.message.optional")}
        </Text>
      </Card.Content>
      <Card.Actions>
        {policy !== "required" && (
          <Button onPress={onSkip}>
            {mobileShellBiometricText("mobileShell.biometric.action.skip")}
          </Button>
        )}
        <Button
          mode="contained"
          onPress={async () => {
            await onEnable();
            setBiometricRequired(true);
          }}
        >
          {mobileShellBiometricText("mobileShell.biometric.action.enable")}
        </Button>
      </Card.Actions>
      {policy === "required" && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text variant="bodySmall" style={{ color: FOREST_COPPER_PALETTE.brandDeep }}>
            {mobileShellBiometricText("mobileShell.biometric.enrollment.requiredNotice")}
          </Text>
        </View>
      )}
    </Card>
  );
}
