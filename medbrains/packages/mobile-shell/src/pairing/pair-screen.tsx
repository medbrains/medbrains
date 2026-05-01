/**
 * `PairScreen` — admin-issued QR scan + mTLS handshake. Reads via
 * `expo-camera` (peer dep), decodes the pairing payload, posts to
 * the configured `/api/devices/pair` endpoint, and stores the
 * issued cert + JWT in the SecretStore.
 *
 * The actual mTLS handshake is delegated to a host-supplied
 * `pairDevice` callback because keypair generation lives in
 * platform-native land (Keychain / Keystore APIs).
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, HelperText, Surface, Text } from "react-native-paper";
import { FOREST_COPPER_PALETTE } from "../theme/forest-copper.js";
import { SECRET_KEYS } from "../secret-store/index.js";
import { useSecretStore } from "../auth/auth-provider.js";

export interface PairingPayload {
  pairingToken: string;
  edgeHost: string;
  edgePort: number;
  tenantId: string;
  certFingerprint: string;
}

export interface PairResult {
  jwt: string;
  deviceCert: string;
  deviceCertKey: string;
  pairingId: string;
  edgeFingerprint: string;
}

export interface PairScreenProps {
  scanQr: () => Promise<PairingPayload>;
  pairDevice: (payload: PairingPayload) => Promise<PairResult>;
  onPaired: () => void;
}

export function PairScreen(props: PairScreenProps): ReactNode {
  const { scanQr, pairDevice, onPaired } = props;
  const secretStore = useSecretStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = await scanQr();
      const result = await pairDevice(payload);
      await Promise.all([
        secretStore.setItem(SECRET_KEYS.jwt, result.jwt, {
          keychainAccessible: "whenUnlockedThisDeviceOnly",
        }),
        secretStore.setItem(SECRET_KEYS.deviceCert, result.deviceCert, {
          keychainAccessible: "whenUnlockedThisDeviceOnly",
        }),
        secretStore.setItem(SECRET_KEYS.deviceCertKey, result.deviceCertKey, {
          requireAuthentication: true,
          keychainAccessible: "whenUnlockedThisDeviceOnly",
        }),
        secretStore.setItem(SECRET_KEYS.pairingId, result.pairingId),
        secretStore.setItem(
          SECRET_KEYS.edgeCertFingerprint,
          result.edgeFingerprint,
        ),
      ]);
      onPaired();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface
      style={{
        flex: 1,
        padding: 24,
        backgroundColor: FOREST_COPPER_PALETTE.canvas,
        justifyContent: "center",
      }}
    >
      <View style={{ marginBottom: 24 }}>
        <Text
          variant="headlineMedium"
          style={{ color: FOREST_COPPER_PALETTE.brand, marginBottom: 8 }}
        >
          Pair this device
        </Text>
        <Text variant="bodyMedium" style={{ color: FOREST_COPPER_PALETTE.ink }}>
          Ask an administrator to generate a one-time QR. Scanning issues a
          device certificate stored in the OS keychain.
        </Text>
      </View>
      {error && (
        <HelperText type="error" visible style={{ marginBottom: 8 }}>
          {error}
        </HelperText>
      )}
      <Button
        mode="contained"
        loading={busy}
        disabled={busy}
        onPress={handle}
      >
        Scan pairing QR
      </Button>
    </Surface>
  );
}
