/**
 * What the signed-in user may do next with a change set. Each control is shown
 * only to holders of the permission its call requires, and the author is
 * never offered Approve.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { KnowledgeChangeSetDetail } from "@medbrains/types";
import {
  IconArrowBackUp,
  IconCheck,
  IconDownload,
  IconEye,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button, TextArea } from "@/components/ui";

export interface SetPermissions {
  canDraft: boolean;
  canApprove: boolean;
  canApply: boolean;
  canRollback: boolean;
}

export type SetAction =
  | { kind: "preview" }
  | { kind: "approve" | "reject"; note: string }
  | { kind: "apply" }
  | { kind: "rollback"; reason: string }
  | { kind: "proof" };

interface SetActionsProps {
  set: KnowledgeChangeSetDetail;
  userId: string | undefined;
  can: SetPermissions;
  busy: boolean;
  onAction: (action: SetAction) => void;
}

export function SetActions({ set, userId, can, busy, onAction }: SetActionsProps) {
  const [note, setNote] = useState("");
  const isAuthor = set.author_id === userId;
  const isOpen = ["draft", "previewed", "stale"].includes(set.status);
  const canPreview = isOpen && (can.canDraft || (can.canRollback && !!set.rollback_of_set_id));
  const canDecide = set.status === "previewed" && can.canApprove && !isAuthor;
  const canWithdraw = isAuthor && (isOpen || set.status === "approved");
  const canRollBack = set.status === "applied" && can.canRollback && !set.rolled_back_by_set_id;
  const hasProof = set.status === "applied" || set.status === "rolled_back";
  const needsNote = canDecide || canWithdraw || canRollBack;

  return (
    <Stack gap="sm">
      {set.status === "previewed" && isAuthor && (
        <Text size="sm" c="dimmed">
          You drafted this change, so someone else must approve it.
        </Text>
      )}
      {needsNote && (
        <TextArea
          label={canRollBack ? "Why roll this back?" : "Note"}
          description={canRollBack ? "Required. It becomes the rollback's reason." : "Optional."}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          autosize
          minRows={2}
        />
      )}
      <Group gap="xs">
        {canPreview && (
          <Button
            tone="primary"
            leftSection={<IconEye size={16} />}
            loading={busy}
            onClick={() => onAction({ kind: "preview" })}
          >
            {set.status === "draft" ? "Preview impact" : "Preview again"}
          </Button>
        )}
        {canDecide && (
          <Button
            tone="primary"
            leftSection={<IconCheck size={16} />}
            disabled={busy}
            onClick={() => onAction({ kind: "approve", note })}
          >
            Approve
          </Button>
        )}
        {(canDecide || canWithdraw) && (
          <Button
            tone="secondary"
            leftSection={<IconX size={16} />}
            disabled={busy}
            onClick={() => onAction({ kind: "reject", note })}
          >
            {canDecide ? "Reject" : "Withdraw"}
          </Button>
        )}
        {set.status === "approved" && can.canApply && (
          <Button
            tone="primary"
            leftSection={<IconPlayerPlay size={16} />}
            loading={busy}
            onClick={() => onAction({ kind: "apply" })}
          >
            Apply now
          </Button>
        )}
        {canRollBack && (
          <Button
            tone="danger"
            leftSection={<IconArrowBackUp size={16} />}
            disabled={busy || note.trim() === ""}
            onClick={() => onAction({ kind: "rollback", reason: note })}
          >
            Roll back
          </Button>
        )}
        {hasProof && (
          <Button
            tone="secondary"
            leftSection={<IconDownload size={16} />}
            disabled={busy}
            onClick={() => onAction({ kind: "proof" })}
          >
            Download proof
          </Button>
        )}
      </Group>
    </Stack>
  );
}
