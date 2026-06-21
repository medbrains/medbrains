import { Stack, Text } from "@mantine/core";
import type { FatigueFlag } from "@medbrains/types";
import { useState } from "react";
import { Alert, Button, Input, Modal } from "@/components/ui";

interface Props {
  opened: boolean;
  onClose: () => void;
  flags: FatigueFlag[];
  busy: boolean;
  onAcknowledge: (reason: string) => void;
}

/**
 * Advisory fatigue warning — lists the duty-hours concerns and lets the staff
 * member acknowledge a reason and continue. Never blocks (you can't strand a
 * patient); the acknowledgement is logged and the charge nurse is notified.
 */
export function FatigueAckModal({ opened, onClose, flags, busy, onAcknowledge }: Props) {
  const [reason, setReason] = useState("");

  return (
    <Modal opened={opened} onClose={onClose} title="Fatigue check" size="md">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Your duty hours have crossed a safe-working threshold. Working while fatigued raises the
          risk of error — please take a break if you safely can.
        </Text>
        {flags.map((f) => (
          <Alert key={f.code} tone="warning">
            {f.message}
          </Alert>
        ))}
        <Input
          label="Why are you continuing? (optional)"
          placeholder="e.g. covering an emergency until relief arrives"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Button tone="primary" loading={busy} onClick={() => onAcknowledge(reason.trim())}>
          Acknowledge &amp; continue
        </Button>
      </Stack>
    </Modal>
  );
}
