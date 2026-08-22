/**
 * The one barcode/QR scanner. Every surface that needs to read a code uses
 * this rather than mounting its own camera.
 *
 * `expo-camera` has been a dependency of all six mobile apps for some time and
 * was never used — `PairScreen` takes a `scanQr` callback that nothing
 * implements. So this is the first real camera in the product, and the pitfalls
 * are handled here once:
 *
 *   - `onBarcodeScanned` fires per frame, not per barcode. Without a lock a
 *     single tube held in front of the lens fires thirty lookups a second. The
 *     component hands the caller exactly one result until it is told to resume.
 *   - Permission has three states, not two. "Not asked yet" must not render as
 *     "denied", or the user sees a refusal they never made.
 *   - Wards, store rooms and mortuary corridors are dark, and the code being
 *     read is often on a curved tube, so the torch is a control and not a
 *     setting buried elsewhere.
 */

import { ink } from "@medbrains/design-system/tokens";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { BarcodeType } from "expo-camera";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, IconButton, Text } from "react-native-paper";
import { DEVICE_PALETTE } from "../theme/device-theme.js";

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules. */
const MIN_TOUCH_TARGET = 44;

/**
 * Linear codes for specimen tubes and asset tags, plus QR. Narrower than
 * everything expo supports on purpose — each extra symbology is more work per
 * frame, and a scanner that reads formats the hospital does not print only
 * makes misreads more likely.
 */
export const CLINICAL_BARCODE_TYPES: BarcodeType[] = [
  "qr",
  "code128",
  "code39",
  "ean13",
  "datamatrix",
];

export interface BarcodeScannerProps {
  /** Called once per scan. The scanner stays locked until `resumeKey` changes. */
  onScan: (value: string, type: string) => void;
  onCancel?: () => void;
  /** What the user is being asked to point the camera at. */
  title: string;
  hint?: string;
  barcodeTypes?: BarcodeType[];
  /**
   * Change this to unlock the scanner for another read — typically after the
   * caller has finished handling the previous one.
   */
  resumeKey?: string | number;
}

export function BarcodeScanner(props: BarcodeScannerProps): ReactNode {
  const {
    onScan,
    onCancel,
    title,
    hint,
    barcodeTypes = CLINICAL_BARCODE_TYPES,
    resumeKey,
  } = props;

  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);

  // Locked against the frame rate, and released when the caller says so.
  const lockedFor = useRef<string | number | undefined>(undefined);
  const isLocked = lockedFor.current === resumeKey && lockedFor.current !== undefined;

  const handleScan = useCallback(
    ({ data, type }: { data: string; type: string }) => {
      if (lockedFor.current === resumeKey) {
        return;
      }
      lockedFor.current = resumeKey;
      onScan(data, type);
    },
    [onScan, resumeKey],
  );

  if (!permission) {
    // Still resolving. Saying nothing is right — claiming denial would be a lie.
    return <Centered>{null}</Centered>;
  }

  if (!permission.granted) {
    return (
      <Centered>
        <Text variant="titleMedium" style={{ color: DEVICE_PALETTE.ink, textAlign: "center" }}>
          {permission.canAskAgain
            ? "The camera is needed to read the code"
            : "Camera access is turned off"}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: DEVICE_PALETTE.ink, opacity: 0.7, textAlign: "center" }}
        >
          {permission.canAskAgain
            ? "Nothing is recorded — the camera is only used to read the code in front of it."
            : "Turn the camera on for this app in your device settings, then come back."}
        </Text>
        {permission.canAskAgain && (
          <Button
            mode="contained"
            onPress={requestPermission}
            accessibilityLabel="Allow camera access"
          >
            Allow camera
          </Button>
        )}
        {onCancel && (
          <Button mode="text" onPress={onCancel} accessibilityLabel="Cancel scanning">
            Cancel
          </Button>
        )}
      </Centered>
    );
  }

  if (mountError) {
    return (
      <Centered>
        <Text variant="titleMedium" style={{ color: DEVICE_PALETTE.ink, textAlign: "center" }}>
          The camera would not start
        </Text>
        <HelperText type="error" visible accessibilityRole="alert">
          {mountError}
        </HelperText>
        {onCancel && (
          <Button mode="contained" onPress={onCancel} accessibilityLabel="Enter the code by hand">
            Enter it by hand
          </Button>
        )}
      </Centered>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.fill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes }}
        onBarcodeScanned={isLocked ? undefined : handleScan}
        onMountError={(event) => setMountError(event.message)}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.instructions}>
          <Text variant="titleMedium" style={styles.overlayTitle}>
            {title}
          </Text>
          {hint && (
            <Text variant="bodySmall" style={styles.overlayHint}>
              {hint}
            </Text>
          )}
        </View>

        <View
          style={styles.reticle}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Scanning area — hold the code inside this frame"
        />

        <View style={styles.controls}>
          <IconButton
            icon={torchOn ? "flashlight-off" : "flashlight"}
            mode="contained"
            size={24}
            onPress={() => setTorchOn((on) => !on)}
            accessibilityLabel={torchOn ? "Turn the light off" : "Turn the light on"}
            style={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
          />
          {onCancel && (
            <Button mode="contained" onPress={onCancel} accessibilityLabel="Stop scanning">
              Cancel
            </Button>
          )}
        </View>
      </View>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }): ReactNode {
  return (
    <View style={styles.centered}>
      <View style={{ gap: 12, alignItems: "center", maxWidth: 320 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: DEVICE_PALETTE.canvas,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 24,
  },
  instructions: { gap: 4 },
  overlayTitle: { color: ink[0], fontWeight: "700" },
  overlayHint: { color: ink[0], opacity: 0.85 },
  reticle: {
    alignSelf: "center",
    width: "78%",
    aspectRatio: 1.4,
    borderWidth: 3,
    borderColor: ink[0],
    borderRadius: 4,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
});
