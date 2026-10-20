import { Group, Stack, Text } from "@mantine/core";
import { QRCodeSVG } from "qrcode.react";

/**
 * Where a new screen starts: the address to open on the TV or counter
 * tablet, as text and as a QR its camera can open. The screen then shows the
 * code an administrator approves above.
 */
export function ScreenUrlHint() {
  const url = `${window.location.origin}/screen`;
  return (
    <Group gap="md" wrap="nowrap" align="center" data-testid="screen-url-hint">
      <QRCodeSVG value={url} size={96} marginSize={2} title="Address to open on the screen" />
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          Pair a new screen
        </Text>
        <Text size="sm">
          On the TV or counter tablet, open{" "}
          <Text span ff="monospace">
            {url}
          </Text>{" "}
          (or scan this). It shows a code; approve it here and choose its board — “Customer display
          (counter)” for the screen facing patients at a billing or pharmacy counter.
        </Text>
      </Stack>
    </Group>
  );
}
