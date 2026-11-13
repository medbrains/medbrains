import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Alert } from "@/components/ui";

/**
 * Where a new screen starts: the address to open on the TV or counter
 * tablet, carrying this hospital's code, as text and as a QR its camera can
 * open. The screen asks this hospital — and only this one — to pair it, and
 * shows a code an administrator types above.
 */
export function ScreenUrlHint() {
  const tenant = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.getTenant(),
    staleTime: 600_000,
  });
  if (tenant.isError) {
    return (
      <Alert tone="warning">Could not load this hospital's code for the screen address.</Alert>
    );
  }
  if (!tenant.data) return null;
  const url = `${window.location.origin}/screen?hospital=${encodeURIComponent(tenant.data.code)}`;
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
          (or scan this). If it asks, the hospital code is{" "}
          <Text span ff="monospace" fw={600}>
            {tenant.data.code}
          </Text>
          . The screen shows a reference and a code; find the reference here, type the code and
          choose its board — “Customer display (counter)” for the screen facing patients at a
          billing or pharmacy counter.
        </Text>
      </Stack>
    </Group>
  );
}
