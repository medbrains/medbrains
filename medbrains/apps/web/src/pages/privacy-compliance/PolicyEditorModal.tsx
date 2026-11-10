// One policy version: edit it while it is a draft, send it for review,
// approve (publish) or return it — never by the person who drafted it.

import { Grid, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import { type CompliancePolicy, P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Markdown from "react-markdown";
import { Alert, Badge, Button, Input, Modal, TextArea, toast } from "@/components/ui";
import { canDecidePolicy, LANGUAGE_LABEL, policyUnfinished } from "@/lib/privacy-compliance";
import { privacyComplianceService } from "@/services/privacyCompliance.service";
import { CounselNotice } from "./CounselNotice";

const STATUS_TONE = {
  draft: "neutral",
  in_review: "warning",
  published: "success",
  superseded: "neutral",
  returned: "danger",
} as const;

export function PolicyEditorModal({
  policy,
  onClose,
}: {
  policy: CompliancePolicy;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const canDraft = useHasPermission(P.REGULATORY.DPDP.POLICY_DRAFT);
  const canApprove = useHasPermission(P.REGULATORY.DPDP.POLICY_APPROVE);
  const editable = canDraft && (policy.status === "draft" || policy.status === "returned");
  const decidable = canApprove && canDecidePolicy(policy, userId);
  const [title, setTitle] = useState(policy.title);
  const [body, setBody] = useState(policy.body);
  const [reason, setReason] = useState("");
  const unfinished = policyUnfinished(body);
  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ["privacy-compliance"] });
    toast.success(msg);
    onClose();
  };
  const fail = (e: Error) => toast.error(e.message);
  const save = useMutation({
    mutationFn: () => privacyComplianceService.editPolicy(policy.id, { title, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-compliance"] });
      toast.success("Draft saved");
    },
    onError: fail,
  });
  const submit = useMutation({
    mutationFn: async () => {
      await privacyComplianceService.editPolicy(policy.id, { title, body });
      return privacyComplianceService.submitPolicy(policy.id);
    },
    onSuccess: () => done("Sent for review — another person approves it"),
    onError: fail,
  });
  const approve = useMutation({
    mutationFn: () => privacyComplianceService.approvePolicy(policy.id),
    onSuccess: () => done("Approved and published"),
    onError: fail,
  });
  const giveBack = useMutation({
    mutationFn: () => privacyComplianceService.returnPolicy(policy.id, reason.trim()),
    onSuccess: () => done("Returned to the drafter"),
    onError: fail,
  });
  return (
    <Modal
      opened
      onClose={onClose}
      fullScreen
      title={`${policy.title} — ${LANGUAGE_LABEL[policy.language]}, version ${policy.version}`}
    >
      <Stack>
        <CounselNotice />
        <Group gap="xs">
          <Badge tone={STATUS_TONE[policy.status]}>{policy.status.replace("_", " ")}</Badge>
          <Text size="sm">Drafted by {policy.drafted_by_name ?? "—"}</Text>
          {policy.decided_by_name && <Text size="sm">· decided by {policy.decided_by_name}</Text>}
        </Group>
        {policy.status === "returned" && policy.return_reason && (
          <Alert tone="danger" title="Returned">
            {policy.return_reason}
          </Alert>
        )}
        {unfinished && policy.status !== "published" && policy.status !== "superseded" && (
          <Alert tone="warning" title="Not ready to approve">
            {unfinished}
          </Alert>
        )}
        {policy.status === "in_review" && !decidable && canApprove && (
          <Alert tone="info" title="Waiting for a second person">
            You drafted this policy, so someone else must approve or return it.
          </Alert>
        )}
        <Grid>
          {editable && (
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xs">
                <Input
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.currentTarget.value)}
                />
                <TextArea
                  label="Text (Markdown)"
                  autosize
                  minRows={18}
                  maxRows={40}
                  value={body}
                  onChange={(e) => setBody(e.currentTarget.value)}
                  styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }}
                />
              </Stack>
            </Grid.Col>
          )}
          <Grid.Col span={{ base: 12, md: editable ? 6 : 12 }}>
            <Text size="sm" fw={600} mb={4}>
              {editable ? "Preview" : "Text"}
            </Text>
            <ScrollArea.Autosize mah="70vh">
              <Markdown>{body}</Markdown>
            </ScrollArea.Autosize>
          </Grid.Col>
        </Grid>
        {decidable && (
          <TextArea
            label="Reason, if returning it"
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
        )}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Close
          </Button>
          {editable && (
            <>
              <Button tone="secondary" onClick={() => save.mutate()} loading={save.isPending}>
                Save draft
              </Button>
              <Button tone="primary" onClick={() => submit.mutate()} loading={submit.isPending}>
                Send for review
              </Button>
            </>
          )}
          {decidable && (
            <>
              <Button
                tone="danger-tertiary"
                onClick={() => giveBack.mutate()}
                loading={giveBack.isPending}
                disabled={reason.trim().length < 3}
              >
                Return
              </Button>
              <Button
                tone="primary"
                onClick={() => approve.mutate()}
                loading={approve.isPending}
                disabled={unfinished !== null}
              >
                Approve and publish
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
