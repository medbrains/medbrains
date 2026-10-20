import { Box, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { QRCodeSVG } from "qrcode.react";

/**
 * UPI QR, rendered locally.
 *
 * This used to be an `<img>` pointed at `chart.googleapis.com`. Three things
 * were wrong with that. The UPI string carries the payee VPA, the amount and
 * the transaction reference, so every payment a hospital took was handed to a
 * third party. The Charts image API is turned down, so the cashier could be
 * holding out a blank square to a patient who is trying to pay. And it needed
 * internet egress from the payment counter, which plenty of hospital networks
 * do not give.
 *
 * `qrcode.react` was already a dependency — the prescription print uses it.
 */
export function UpiQrCode({ value }: { value: string }) {
  return (
    <Stack
      align="center"
      gap="xs"
      style={{
        padding: 16,
        border: "2px dashed var(--mantine-color-gray-4)",
        borderRadius: 0,
        backgroundColor: "var(--mantine-color-gray-0)",
        width: "100%",
      }}
    >
      <Box
        style={{
          width: 200,
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "white",
          borderRadius: 0,
          border: "1px solid var(--mantine-color-gray-3)",
        }}
      >
        <QRCodeSVG
          value={value}
          size={180}
          // A counter QR gets scanned at an angle, in bad light, off a screen
          // with fingerprints on it. Level M leaves room to still decode.
          level="M"
          role="img"
          aria-label="UPI payment QR code"
        />
      </Box>
      <TextInput
        value={value}
        readOnly
        size="xs"
        w="100%"
        styles={{ input: { fontFamily: "monospace", fontSize: 10 } }}
        onClick={(e) => {
          e.currentTarget.select();
          void navigator.clipboard.writeText(value);
          notifications.show({
            message: "UPI URI copied to clipboard",
            color: "green",
          });
        }}
      />
    </Stack>
  );
}
