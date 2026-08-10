/**
 * `SyncSetupScreen` — shows the node id an administrator binds.
 *
 * A paired device already syncs on the hospital LAN. This is the step
 * that lets it sync from anywhere else: a camp on cellular, a vehicle
 * whose wifi drops, or directly with another volunteer's phone.
 *
 * The device mints its own key and shows only the public half. An
 * administrator reads it out and binds it in Admin → Paired devices,
 * and nothing here can admit the device by itself — which is the
 * point. A device that could enrol itself would make the binding
 * worthless.
 *
 * The node id is rendered in generously-spaced groups because a
 * person is going to read it aloud or type it into a laptop across a
 * ward. Running it together as one string is how the wrong device
 * gets bound.
 */

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { ActivityIndicator, Button, HelperText, Surface, Text } from "react-native-paper";
import { DEVICE_PALETTE } from "../theme/device-theme.js";
import { groupForReading } from "./node-id-format.js";
import { mobileShellPairingText } from "./pairing-text.js";
import { useSyncIdentity } from "./use-sync-identity.js";

export interface SyncSetupScreenProps {
  /** Called once the device has an identity, so a host can move on. */
  onReady?: (nodeId: string) => void;
}

export function SyncSetupScreen({ onReady }: SyncSetupScreenProps): ReactNode {
  const { state, mint, minting } = useSyncIdentity();

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, gap: 16 }}
      style={{ backgroundColor: DEVICE_PALETTE.canvas }}
    >
      <Text variant="headlineSmall" style={{ color: DEVICE_PALETTE.ink }}>
        {mobileShellPairingText("mobileShell.sync.title")}
      </Text>
      <Text variant="bodyMedium" style={{ color: DEVICE_PALETTE.ink }}>
        {mobileShellPairingText("mobileShell.sync.body")}
      </Text>

      {state.status === "loading" && (
        <ActivityIndicator
          accessibilityLabel={mobileShellPairingText("mobileShell.sync.loading")}
        />
      )}

      {state.status === "failed" && (
        <HelperText type="error" visible accessibilityRole="alert">
          {state.reason}
        </HelperText>
      )}

      {state.status === "absent" && (
        <Button
          mode="contained"
          onPress={() => {
            void mint();
          }}
          loading={minting}
          disabled={minting}
          // Comfortably past the 44px floor: this is tapped once, by
          // someone standing up, often wearing gloves.
          contentStyle={{ minHeight: 52 }}
          accessibilityLabel={mobileShellPairingText("mobileShell.sync.action.create")}
        >
          {mobileShellPairingText("mobileShell.sync.action.create")}
        </Button>
      )}

      {state.status === "present" && (
        <NodeIdPanel nodeId={state.nodeId} onReady={onReady} />
      )}
    </ScrollView>
  );
}

function NodeIdPanel({
  nodeId,
  onReady,
}: {
  nodeId: string;
  onReady?: (nodeId: string) => void;
}): ReactNode {
  return (
    <Surface
      elevation={0}
      style={{
        backgroundColor: DEVICE_PALETTE.panel,
        borderColor: DEVICE_PALETTE.rule,
        borderWidth: 1,
        padding: 16,
        gap: 12,
      }}
    >
      <Text variant="labelLarge" style={{ color: DEVICE_PALETTE.brandDeep }}>
        {mobileShellPairingText("mobileShell.sync.nodeId.label")}
      </Text>

      <Text
        variant="titleMedium"
        selectable
        // One accessible string, so a screen reader announces the id
        // rather than a run of disconnected groups.
        accessibilityLabel={nodeId}
        style={{
          color: DEVICE_PALETTE.ink,
          fontFamily: "monospace",
          letterSpacing: 1,
          lineHeight: 26,
        }}
      >
        {groupForReading(nodeId)}
      </Text>

      <Text variant="bodySmall" style={{ color: DEVICE_PALETTE.muted }}>
        {mobileShellPairingText("mobileShell.sync.nodeId.help")}
      </Text>

      {onReady && (
        <View>
          <Button
            mode="contained"
            onPress={() => onReady(nodeId)}
            contentStyle={{ minHeight: 52 }}
            accessibilityLabel={mobileShellPairingText("mobileShell.sync.action.done")}
          >
            {mobileShellPairingText("mobileShell.sync.action.done")}
          </Button>
        </View>
      )}
    </Surface>
  );
}

