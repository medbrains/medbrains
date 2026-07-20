// Telemedicine ChatModal — split from telemedicine.tsx (pure move).

import { Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import { telemedicineService } from "@/services/telemedicine.service";

export function ChatModal({
  consultationId,
  onClose,
}: {
  consultationId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["tele-chat", consultationId],
    queryFn: () => telemedicineService.listTeleChat(consultationId),
    refetchInterval: 5_000,
  });
  const send = useMutation({
    mutationFn: () => telemedicineService.postTeleChat(consultationId, { body: text }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tele-chat", consultationId] });
      setText("");
    },
    onError: (e: Error) =>
      notifications.show({ title: "Send failed", message: e.message, color: "danger" }),
  });
  return (
    <Modal opened onClose={onClose} title="Consultation chat" size="md">
      <Stack gap="sm">
        <Stack gap="xs" style={{ maxHeight: 300, overflowY: "auto" }}>
          {data.length === 0 ? (
            <Text size="sm" c="dimmed">
              No messages yet.
            </Text>
          ) : (
            data.map((m) => (
              <Group key={m.id} gap={6}>
                <Badge tone={m.sender_role === "doctor" ? "info" : "neutral"} size="xs">
                  {m.sender_role}
                </Badge>
                <Text size="sm">{m.body}</Text>
              </Group>
            ))
          )}
        </Stack>
        <Group align="flex-end" gap="xs">
          <TextInput
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder="Message…"
            style={{ flex: 1 }}
          />
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!text.trim()}>
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
