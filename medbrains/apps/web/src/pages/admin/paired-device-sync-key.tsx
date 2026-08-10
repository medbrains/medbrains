/**
 * Binding a paired device's peer-to-peer sync key, from the paired-devices
 * table.
 *
 * A device can reach the hospital over the LAN with nothing more than its
 * certificate. Reaching it from a camp on cellular, or peer-to-peer between two
 * volunteers' phones, needs a node key bound to the device here — until an
 * operator does this, the device is paired but cannot sync off the LAN.
 *
 * Enrolment is deliberately an operator's act. A device that could enrol itself
 * would make the binding worthless: anyone able to reach the endpoint could mint
 * an admitted peer. So the device shows its node id and a person decides it
 * belongs to a machine this hospital admitted.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { adminDevicesService } from "@/services/adminDevices.service";

/**
 * A node id is the device's public key as the transport prints it. Length is
 * checked rather than format: rejecting on a shape guess would block a future
 * key encoding, while an empty or obviously truncated paste is worth catching
 * before it becomes a binding nobody can dial.
 */
const syncKeySchema = z.object({
  node_id: z
    .string()
    .trim()
    .min(32, "That looks too short to be a node key — paste the whole value.")
    .max(256, "That is longer than any node key."),
});

type SyncKeyForm = z.infer<typeof syncKeySchema>;

/** Shown in the table: whether this device can sync beyond the LAN. */
export function SyncKeyBadge({ nodeId }: { nodeId: string | undefined }) {
  return nodeId ? (
    <Badge tone="success" title={nodeId}>
      keyed
    </Badge>
  ) : (
    <Badge tone="neutral">LAN only</Badge>
  );
}

interface SyncKeyModalProps {
  device: { id: string; label: string } | null;
  nodeId: string | undefined;
  canManage: boolean;
  onClose: () => void;
}

export function SyncKeyModal({ device, nodeId, canManage, onClose }: SyncKeyModalProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, formState } = useForm<SyncKeyForm>({
    resolver: zodResolver(syncKeySchema),
    defaultValues: { node_id: "" },
  });

  const done = (message: string) => {
    notifications.show({ message });
    void queryClient.invalidateQueries({ queryKey: ["peer-roster"] });
    reset({ node_id: "" });
    onClose();
  };

  const bind = useMutation({
    mutationFn: (form: SyncKeyForm) =>
      adminDevicesService.registerDeviceNodeKey(device?.id ?? "", form.node_id),
    onSuccess: () => done("Sync key bound. The device can now sync beyond the LAN."),
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });

  const revoke = useMutation({
    mutationFn: () => adminDevicesService.revokeDeviceNodeKey(device?.id ?? ""),
    onSuccess: () => done("Sync key revoked."),
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });

  return (
    <Modal
      opened={device !== null}
      onClose={onClose}
      title={device ? `Sync key — ${device.label}` : "Sync key"}
    >
      <Stack gap="md">
        {nodeId ? (
          <>
            <Text size="sm">This device holds a sync key.</Text>
            <Text size="xs" ff="monospace" style={{ wordBreak: "break-all" }}>
              {nodeId}
            </Text>
            <Alert tone="warning" title="Revoking stops this device syncing">
              Appliances and other devices refuse it as soon as they next refresh their roster. A
              device that is offline may keep syncing peer-to-peer until then.
            </Alert>
            {canManage && (
              <Button
                tone="danger-ghost"
                loading={revoke.isPending}
                onClick={() => revoke.mutate()}
              >
                Revoke sync key
              </Button>
            )}
          </>
        ) : (
          <>
            <Text size="sm">
              This device can sync on the hospital LAN. To let it sync from outside — a camp on
              cellular, or directly with another device — bind the node key it shows on its own
              screen.
            </Text>
            <form onSubmit={handleSubmit((form) => bind.mutate(form))}>
              <Stack gap="sm">
                <Controller
                  name="node_id"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Node key"
                      placeholder="Paste the node key shown on the device"
                      error={formState.errors.node_id?.message}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                />
                {canManage ? (
                  <Button type="submit" tone="primary" loading={bind.isPending}>
                    Bind sync key
                  </Button>
                ) : (
                  <Alert tone="info" title="You cannot bind sync keys">
                    Binding a key admits a device to peer-to-peer sync, so it needs the
                    device-pairing permission.
                  </Alert>
                )}
              </Stack>
            </form>
          </>
        )}
      </Stack>
    </Modal>
  );
}
