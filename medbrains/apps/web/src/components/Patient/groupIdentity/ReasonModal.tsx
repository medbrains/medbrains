import { Group, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { Button, Modal, TextArea } from "@/components/ui";

interface ReasonModalProps {
  opened: boolean;
  title: string;
  /** What the action does, said before it is done. */
  explanation: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

const MIN_REASON = 5;

/** Asks why before a link is rejected or undone; the reason stays on record. */
export function ReasonModal({
  opened,
  title,
  explanation,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= MIN_REASON;
  return (
    <Modal opened={opened} onClose={onClose} title={title}>
      <Stack gap="md">
        <Text size="sm">{explanation}</Text>
        <TextArea
          label="Why"
          description="Stays on the record with your name."
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          minRows={2}
          required
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="danger"
            disabled={!ok}
            loading={busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
