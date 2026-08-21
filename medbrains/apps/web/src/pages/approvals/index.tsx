/**
 * Approvals — one screen for everything a person can be asked to decide.
 *
 * Two tabs: what awaits me, and what I asked for. Every request type is
 * decided through the same component, which is most of the value over the
 * sixteen bespoke approval screens this replaces — an approver learns the
 * interaction once.
 *
 * The screen knows nothing about leave, access or controlled drugs. A request
 * type is configuration on the server, so adding one adds nothing here.
 */

import { Group, SegmentedControl, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { ApprovalRequestDetail, ApprovalRequestSummary, ApprovalStep } from "@medbrains/types";
import { IconCheck, IconInbox, IconSend, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge, Button, Drawer, Modal } from "@/components/ui";

type Tab = "inbox" | "mine";

/**
 * How a status is painted.
 *
 * `revoked` is `warning` rather than `danger` deliberately: the grant existed
 * and was used, which is a different situation from a refusal and should not
 * look identical to one.
 */
function statusTone(status: ApprovalRequestSummary["status"]): BadgeTone {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "revoked":
    case "expired":
      return "warning";
    case "pending":
      return "primary";
    default:
      return "neutral";
  }
}

export function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [openId, setOpenId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const inbox = useQuery({
    queryKey: ["approvals", "inbox"],
    queryFn: () => api.listApprovalInbox(),
    enabled: tab === "inbox",
  });
  const mine = useQuery({
    queryKey: ["approvals", "mine"],
    queryFn: () => api.listMyApprovalRequests(),
    enabled: tab === "mine",
  });

  const active = tab === "inbox" ? inbox : mine;

  const columns = [
    {
      key: "kind",
      label: "Request",
      render: (row: ApprovalRequestSummary) => (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {row.kind}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {row.reason}
          </Text>
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: ApprovalRequestSummary) => (
        // Never colour alone: the label carries the meaning, the tone
        // reinforces it. WCAG 2.2 and a colour-blind approver both need this.
        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: "current_step_seq",
      label: "Stage",
      render: (row: ApprovalRequestSummary) => <Text size="sm">{row.current_step_seq}</Text>,
    },
    {
      key: "created_at",
      label: "Raised",
      render: (row: ApprovalRequestSummary) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: ApprovalRequestSummary) => (
        <Button tone="ghost" size="xs" onClick={() => setOpenId(row.id)}>
          {tab === "inbox" ? "Review" : "View"}
        </Button>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Approvals"
        description="Requests awaiting your decision, and the ones you have raised."
      />

      <SegmentedControl
        value={tab}
        onChange={(value) => setTab(value as Tab)}
        data={[
          { label: "Awaiting me", value: "inbox" },
          { label: "My requests", value: "mine" },
        ]}
        aria-label="Which approvals to show"
      />

      {active.isError ? (
        <Alert tone="danger" title="Could not load approvals">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">{(active.error as Error).message}</Text>
            <Button size="xs" tone="tertiary" onClick={() => void active.refetch()}>
              Retry
            </Button>
          </Stack>
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        data={active.data ?? []}
        loading={active.isLoading}
        rowKey={(row: ApprovalRequestSummary) => row.id}
        emptyIcon={tab === "inbox" ? <IconInbox /> : <IconSend />}
        // An empty inbox is a good state, not a failure. Saying "nothing found"
        // reads like something went wrong.
        emptyTitle={tab === "inbox" ? "Nothing awaiting you" : "You have not raised anything"}
        emptyDescription={
          tab === "inbox"
            ? "Requests appear here when it is your turn to decide."
            : "Requests you raise will appear here with their progress."
        }
      />

      {openId ? (
        <RequestDrawer
          requestId={openId}
          canDecide={tab === "inbox"}
          onClose={() => setOpenId(null)}
          onDecided={() => {
            setOpenId(null);
            void queryClient.invalidateQueries({ queryKey: ["approvals"] });
          }}
        />
      ) : null}
    </Stack>
  );
}

interface RequestDrawerProps {
  requestId: string;
  canDecide: boolean;
  onClose: () => void;
  onDecided: () => void;
}

function RequestDrawer({ requestId, canDecide, onClose, onDecided }: RequestDrawerProps) {
  const detail = useQuery({
    queryKey: ["approvals", "request", requestId],
    queryFn: () => api.getApprovalRequest(requestId),
  });

  return (
    <Drawer opened onClose={onClose} title="Request" position="right" size="lg">
      {detail.isError ? (
        <Alert tone="danger" title="Could not load this request">
          {(detail.error as Error).message}
        </Alert>
      ) : null}
      {detail.data ? (
        <RequestBody detail={detail.data} canDecide={canDecide} onDecided={onDecided} />
      ) : null}
    </Drawer>
  );
}

function RequestBody({
  detail,
  canDecide,
  onDecided,
}: {
  detail: ApprovalRequestDetail;
  canDecide: boolean;
  onDecided: () => void;
}) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      api.decideApprovalRequest(detail.id, {
        decision,
        note: note.trim() || null,
        // The stage this view was rendered from. If the request moved on since
        // — another approver got there first, or this tab has been open a
        // while — the server answers 409 rather than applying the decision to
        // whatever stage happens to be live now.
        expected_step_seq: detail.current_step_seq,
      }),
    onSuccess: (result) => {
      notifications.show({ title: "Decision recorded", message: result.outcome });
      onDecided();
    },
    onError: (error: Error & { status?: number }) => {
      const moved = error.status === 409;
      notifications.show({
        color: moved ? "yellow" : "red",
        title: moved ? "This request has moved on" : "Could not record the decision",
        // A 409 is not the approver's mistake: somebody else decided first.
        // Telling them to reload is more use than an error they cannot act on.
        message: moved
          ? "Someone else decided it, or it advanced while this was open. Reload to see where it stands."
          : error.message,
      });
    },
  });

  const liveStep = detail.steps.find((step) => step.seq === detail.current_step_seq);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>{detail.kind}</Text>
        <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
      </Group>

      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          Reason
        </Text>
        <Text size="sm">{detail.reason}</Text>
      </Stack>

      {Object.keys(detail.payload).length > 0 ? (
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            Details
          </Text>
          {Object.entries(detail.payload).map(([key, value]) => (
            <Group key={key} justify="space-between">
              <Text size="sm" c="dimmed">
                {key.replace(/_/g, " ")}
              </Text>
              <Text size="sm">{String(value)}</Text>
            </Group>
          ))}
        </Stack>
      ) : null}

      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          Approval chain
        </Text>
        {detail.steps.map((step) => (
          <StepRow key={step.seq} step={step} isLive={step.seq === detail.current_step_seq} />
        ))}
      </Stack>

      {canDecide && detail.status === "pending" ? (
        <Stack gap="sm">
          <Textarea
            label="Note (optional)"
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            autosize
            minRows={2}
          />
          {liveStep?.requires_witness ? (
            // Not yet buildable here: a witness must be a real person who is
            // not the actor, which needs a user picker. Saying so beats
            // offering a button that will be refused by the server.
            <Alert tone="warning" title="This stage requires a witness">
              Witnessed decisions cannot yet be recorded from this screen.
            </Alert>
          ) : (
            <Group>
              <Button
                tone="primary"
                leftSection={<IconCheck size={16} />}
                loading={decide.isPending}
                onClick={() => setConfirming("approve")}
              >
                Approve
              </Button>
              <Button
                tone="danger-tertiary"
                leftSection={<IconX size={16} />}
                loading={decide.isPending}
                onClick={() => setConfirming("reject")}
              >
                Reject
              </Button>
            </Group>
          )}
        </Stack>
      ) : null}

      <Modal
        opened={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === "reject" ? "Reject this request?" : "Approve this request?"}
      >
        <Stack gap="md">
          <Text size="sm">
            {confirming === "reject"
              ? "Rejecting ends the request. It cannot be decided again."
              : liveStep && liveStep.quorum > 1
                ? `This stage needs ${liveStep.quorum} approvals. Yours is one of them.`
                : "This is the final approval for this stage."}
          </Text>
          <Group justify="flex-end">
            <Button tone="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              tone={confirming === "reject" ? "danger" : "primary"}
              loading={decide.isPending}
              onClick={() => {
                if (confirming) decide.mutate(confirming);
                setConfirming(null);
              }}
            >
              {confirming === "reject" ? "Reject" : "Approve"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function StepRow({ step, isLive }: { step: ApprovalStep; isLive: boolean }) {
  const approvals = step.decisions.filter((d) => d.decision === "approve").length;
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={isLive ? 600 : 400}>
          {step.seq}. {step.name}
        </Text>
        {step.requires_witness ? <Badge tone="warning">witness</Badge> : null}
      </Group>
      <Text size="xs" c="dimmed">
        {/* A quorum stage says so, so an approver knows their click is not
            the last word. */}
        {step.quorum > 1 ? `${approvals} of ${step.quorum} · ` : ""}
        {step.status}
      </Text>
    </Group>
  );
}
