/**
 * Sign Workspace — slide-in for signing a single pending record.
 *
 * Mantine Drawer placeholder until useWorkspace() ships.
 * Per RFCs/sprints/SPRINT-doctor-activities.md §5.3.
 */
import {
  Alert,
  Badge,
  Button,
  Code,
  Divider,
  Drawer,
  Group,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconShield, IconSignature } from "@tabler/icons-react";
import { useState } from "react";
import { api } from "@medbrains/api";
import type { PendingSignoffEntry } from "@medbrains/types";

interface SignWorkspaceProps {
  opened: boolean;
  target: PendingSignoffEntry;
  onClose: () => void;
  onSigned: () => void;
}

export function SignWorkspace({ opened, target, onClose, onSigned }: SignWorkspaceProps) {
  const [notes, setNotes] = useState("");
  const [isSigning, setIsSigning] = useState(false);

  const legalClassFor = (recordType: string): string => {
    if (recordType.startsWith("mlc") || recordType.includes("death")) return "medico_legal";
    if (recordType.includes("certificate")) return "medico_legal";
    return "clinical";
  };

  const handleSign = async () => {
    setIsSigning(true);
    try {
      const res = await api.signRecord({
        record_type: target.record_type,
        record_id: target.record_id,
        // For Phase 1 we use a minimal payload — server canonicalizes.
        // Real implementation should fetch the full record + sign that.
        payload: {
          record_type: target.record_type,
          record_id: target.record_id,
          created_at: target.created_at,
        },
        signer_role: "primary",
        legal_class: legalClassFor(target.record_type),
        notes: notes.trim() || undefined,
      });
      notifications.show({
        title: "Signed",
        message: `Signature ${res.signature_hex.slice(0, 12)}… recorded`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onSigned();
    } catch (err) {
      notifications.show({
        title: "Sign failed",
        message: (err as Error).message,
        color: "danger",
      });
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSignature size={18} />
          <Text fw={600}>Sign record</Text>
        </Group>
      }
      position="right"
      size="md"
      padding="md"
    >
      <Stack gap="md">
        <Alert color="primary" icon={<IconShield size={16} />} variant="light">
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Cryptographic + visual signature
            </Text>
            <Text size="xs" c="dimmed">
              Ed25519 over canonical payload + scanned signature image stamped
              onto the printed PDF. Both verifiable by any auditor.
            </Text>
          </Stack>
        </Alert>

        <Stack gap={4}>
          <Group gap="xs">
            <Badge size="sm" variant="light">{target.record_type}</Badge>
            <Badge size="sm" color={legalColor(legalClassFor(target.record_type))}>
              {legalClassFor(target.record_type).replace("_", " ")}
            </Badge>
          </Group>
          <Text size="sm">Record ID</Text>
          <Code block>{target.record_id}</Code>
          <Text size="xs" c="dimmed">
            Created {new Date(target.created_at).toLocaleString()}
          </Text>
        </Stack>

        <Divider />

        <Textarea
          label="Notes (optional)"
          placeholder="e.g., reviewed and approved per ward protocol"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={6}
        />

        <Alert color="warning" variant="light">
          <Text size="xs">
            Signing creates an immutable cryptographic record. Verify the
            content above is correct before proceeding.
          </Text>
        </Alert>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} disabled={isSigning}>
            Cancel
          </Button>
          <Button
            color="primary"
            loading={isSigning}
            leftSection={<IconSignature size={14} />}
            onClick={handleSign}
          >
            Sign
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

function legalColor(legalClass: string): string {
  switch (legalClass) {
    case "medico_legal": return "red";
    case "statutory_export": return "orange";
    case "clinical": return "blue";
    default: return "gray";
  }
}
