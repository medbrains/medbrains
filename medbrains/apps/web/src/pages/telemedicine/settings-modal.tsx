// Telemedicine TeleSettingsModal — split from telemedicine.tsx (pure move).

import { Group, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { telemedicineService } from "@/services/telemedicine.service";

export function TeleSettingsModal({
  opened,
  onClose,
  canManage,
}: {
  opened: boolean;
  onClose: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["tele-config"],
    queryFn: () => telemedicineService.getTeleConfig(),
    enabled: opened,
  });
  const [videoBase, setVideoBase] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  if (data && !seeded) {
    setVideoBase(data.video_base_configured ? data.video_base : "");
    setProvider(data.default_provider);
    setSeeded(true);
  }
  const save = useMutation({
    mutationFn: () =>
      telemedicineService.updateTeleConfig({
        video_base: videoBase.trim() || undefined,
        default_provider: provider ?? undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tele-config"] });
      notifications.show({ title: "Saved", message: "Video config updated.", color: "success" });
      onClose();
    },
    onError: (e: Error) =>
      notifications.show({ title: "Save failed", message: e.message, color: "danger" }),
  });
  const available = (data?.providers ?? []).filter((p) => p.available);
  return (
    <Modal opened={opened} onClose={onClose} title="Video provider settings" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Effective Jitsi base: {data?.video_base ?? "…"}
          {data && !data.video_base_configured ? " (public default)" : ""}
        </Text>
        <TextInput
          label="Jitsi base URL (self-host)"
          value={videoBase}
          onChange={(e) => setVideoBase(e.currentTarget.value)}
          placeholder="https://meet.jit.si"
          disabled={!canManage}
        />
        <Select
          label="Default provider"
          data={available.map((p) => ({ value: p.name, label: p.name }))}
          value={provider}
          onChange={setProvider}
          disabled={!canManage}
        />
        <Text fw={600} size="sm">
          Providers
        </Text>
        {(data?.providers ?? []).map((p) => (
          <Group key={p.name} gap="xs">
            <Text size="sm">{p.name}</Text>
            <Badge tone={p.available ? "success" : "neutral"} size="xs">
              {p.available ? "available" : "not available"}
            </Badge>
            {p.requires_credentials && (
              <Badge tone="warning" size="xs">
                needs credentials
              </Badge>
            )}
          </Group>
        ))}
        <Text size="xs" c="dimmed">
          Zoom credentials (account / client id + secret) are provisioned in the secrets store, not
          entered here.
        </Text>
        {canManage && (
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save
          </Button>
        )}
      </Stack>
    </Modal>
  );
}
