/**
 * What passed between MedBrains and one analyzer (#227): orders loaded onto
 * it, results that came back, and anything refused — so the lab in-charge can
 * tell "the analyzer never got the order" from "the result never came back".
 */
import { Stack, Text } from "@mantine/core";
import type { DeviceMessage } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, type BadgeTone, Drawer, Table } from "@/components/ui";
import { adminDevicesService } from "@/services/adminDevices.service";

interface DeviceMessagesDrawerProps {
  device: { id: string; name: string } | null;
  onClose: () => void;
}

const STATUS_TONE: Partial<Record<string, BadgeTone>> = {
  delivered: "success",
  failed: "danger",
  rejected: "danger",
  dead_letter: "danger",
  mapped: "warning",
};

interface Mapped {
  identifiers?: { sample_barcode?: string | null };
  test_code?: string;
  results?: unknown[];
}

function summary(m: DeviceMessage): { sample: string; what: string } {
  const mapped = (m.mapped_data ?? {}) as Mapped;
  const sample = mapped.identifiers?.sample_barcode ?? "—";
  if (m.direction === "outbound") return { sample, what: `Order ${mapped.test_code ?? ""}`.trim() };
  const count = mapped.results?.length ?? 0;
  return { sample, what: count ? `${count} result${count === 1 ? "" : "s"}` : m.protocol };
}

export function DeviceMessagesDrawer({ device, onClose }: DeviceMessagesDrawerProps) {
  const messages = useQuery({
    queryKey: ["device-messages", device?.id],
    queryFn: () => adminDevicesService.listDeviceMessages(device?.id ?? ""),
    enabled: device !== null,
  });
  return (
    <Drawer
      opened={device !== null}
      onClose={onClose}
      title={device ? `Messages — ${device.name}` : "Messages"}
      position="right"
      size="xl"
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Orders sent to the analyzer and results received from it, newest first.
        </Text>
        {messages.isError && (
          <Alert tone="danger" title="Messages could not be loaded">
            {(messages.error as Error).message}
          </Alert>
        )}
        {messages.data?.length === 0 && (
          <Text size="sm">Nothing has passed between MedBrains and this device yet.</Text>
        )}
        {!!messages.data?.length && (
          <Table aria-label="Device messages">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Direction</Table.Th>
                <Table.Th>Sample</Table.Th>
                <Table.Th>What</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Problem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {messages.data.map((m) => {
                const { sample, what } = summary(m);
                return (
                  <Table.Tr key={m.id}>
                    <Table.Td>{new Date(m.created_at).toLocaleString()}</Table.Td>
                    <Table.Td>
                      {m.direction === "outbound" ? "Sent to analyzer" : "Received"}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="var(--font-mono, monospace)">
                        {sample}
                      </Text>
                    </Table.Td>
                    <Table.Td>{what}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" tone={STATUS_TONE[m.processing_status] ?? "neutral"}>
                        {m.processing_status.replace(/_/g, " ")}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{m.error_message ?? ""}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Drawer>
  );
}
