/** One change set: what it changes, who it affects, and what to do next. */
import { Stack, Text, Title } from "@mantine/core";
import type { KnowledgeChangeSetDetail, KnowledgeProof } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Divider, Modal, toast } from "@/components/ui";
import { knowledgeChangesService as svc } from "@/services/knowledgeChanges.service";
import { DiffTable } from "./diff-table";
import { ImpactPanel } from "./impact-panel";
import { AREA_LABEL, STATUS } from "./labels";
import { type SetAction, SetActions, type SetPermissions } from "./set-actions";

interface ChangeSetDialogProps {
  id: string | null;
  userId: string | undefined;
  can: SetPermissions;
  onClose: () => void;
  onOpen: (id: string) => void;
}

const DONE: Record<SetAction["kind"], string> = {
  preview: "Impact measured. A second person can now approve it.",
  approve: "Approved. It can now be applied.",
  reject: "Recorded.",
  apply: "Applied. The change is live.",
  rollback: "Rollback drafted. Preview it and have it approved.",
  proof: "Proof downloaded.",
};

function saveProof(proof: KnowledgeProof) {
  const blob = new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), {
    href: url,
    download: `knowledge-change-${proof.change_set_id}-proof.json`,
  }).click();
  URL.revokeObjectURL(url);
}

function run(id: string, action: SetAction): Promise<KnowledgeChangeSetDetail | KnowledgeProof> {
  switch (action.kind) {
    case "preview":
      return svc.preview(id);
    case "approve":
      return svc.approve(id, action.note || undefined);
    case "reject":
      return svc.reject(id, action.note || undefined);
    case "apply":
      return svc.apply(id);
    case "rollback":
      return svc.rollback(id, action.reason);
    case "proof":
      return svc.proof(id);
  }
}

export function ChangeSetDialog({ id, userId, can, onClose, onOpen }: ChangeSetDialogProps) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["knowledge-changes", "detail", id],
    queryFn: () => svc.get(id ?? ""),
    enabled: id !== null,
  });
  const act = useMutation({
    mutationFn: (action: SetAction) => run(id ?? "", action),
    onSuccess: (result, action) => {
      toast.success(DONE[action.kind]);
      void qc.invalidateQueries({ queryKey: ["knowledge-changes"] });
      if (action.kind === "proof") saveProof(result as KnowledgeProof);
      if (action.kind === "rollback") onOpen((result as KnowledgeChangeSetDetail).id);
    },
    // A refused apply leaves the set stale; show the new state.
    onError: () => void qc.invalidateQueries({ queryKey: ["knowledge-changes"] }),
  });
  const set = detail.data;

  return (
    <Modal
      opened={id !== null}
      onClose={onClose}
      size="xl"
      title={set ? set.title : "Knowledge change"}
    >
      {detail.error ? (
        <Alert tone="danger" role="alert" title="This change could not be loaded">
          <Button tone="secondary" size="compact-sm" onClick={() => void detail.refetch()}>
            Try again
          </Button>
        </Alert>
      ) : !set ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : (
        <Stack gap="md">
          <Stack gap={4}>
            <Badge tone={STATUS[set.status].tone}>{STATUS[set.status].label}</Badge>
            <Text size="sm">
              {AREA_LABEL[set.area]} · drafted by {set.author_name ?? "unknown"}
              {set.approver_name ? ` · approved by ${set.approver_name}` : ""}
            </Text>
            <Text size="sm">Reason: {set.reason}</Text>
            {set.decision_note && <Text size="sm">Note: {set.decision_note}</Text>}
          </Stack>
          {set.status === "stale" && (
            <Alert tone="warning" role="status">
              Live data changed since preview, so nothing was applied. Preview again, then have it
              approved again.
            </Alert>
          )}
          {act.error && (
            <Alert tone="danger" role="alert">
              {act.error.message}
            </Alert>
          )}
          <SetActions
            set={set}
            userId={userId}
            can={can}
            busy={act.isPending}
            onAction={(a) => act.mutate(a)}
          />
          <Divider />
          <Title order={4}>Who this affects</Title>
          <ImpactPanel report={set.impact} isStale={set.status === "stale"} />
          <Divider />
          <Title order={4}>What changes</Title>
          <DiffTable area={set.area} items={set.items} />
          {set.proof_hash && (
            <Text size="xs" c="dimmed" ff="monospace">
              Proof hash {set.proof_hash}
            </Text>
          )}
        </Stack>
      )}
    </Modal>
  );
}
