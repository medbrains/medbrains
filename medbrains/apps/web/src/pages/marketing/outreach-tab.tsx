import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import type { MarketingCohort, MarketingOutreachRun } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, Tooltip, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";
import { RunDetailDrawer } from "./run-detail-drawer";

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "danger" | "warning"> = {
  draft: "neutral",
  pending: "warning",
  approved: "success",
  sending: "info",
  sent: "success",
  cancelled: "danger",
  failed: "danger",
};

export function MarketingOutreachTab({
  canSend,
  canApprove,
}: {
  canSend: boolean;
  canApprove: boolean;
}) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const {
    data: runs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "outreach"],
    queryFn: () => marketingService.listOutreachRuns(),
  });

  const { data: cohorts = [] } = useQuery({
    queryKey: ["marketing", "cohorts"],
    queryFn: () => marketingService.listCohorts(),
  });

  const cohortName = (id: string) =>
    cohorts.find((c: MarketingCohort) => c.id === id)?.name ?? "Unknown cohort";

  // Dispatch is separate from approve: approval says the words are lawful,
  // dispatch is the act of sending them to four thousand people.
  const canDispatch = useHasPermission(P.MARKETING.OUTREACH_DISPATCH);
  const canSeeRecipients = useHasPermission(P.MARKETING.MESSAGES_VIEW);
  const [inspecting, setInspecting] = useState<MarketingOutreachRun | null>(null);
  const detail = useDisclosure(false);

  const startMutation = useMutation({
    mutationFn: (id: string) => marketingService.startOutreachRun(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "outreach"] });
      toast.success(
        result.blocked > 0
          ? `${result.queued} queued. ${result.blocked} were excluded — open the run to see why.`
          : `${result.queued} queued.`,
        { title: "Run started" },
      );
    },
    // The server refuses rather than half-sending when the consent gate cannot
    // decide about somebody, and that message names how many — so it is shown
    // rather than replaced with a generic failure.
    onError: (error: Error) => toast.error(error.message, { title: "Could not start the run" }),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => marketingService.submitOutreachRun(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "outreach"] });
      toast.success("Sent for review");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not submit" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => marketingService.approveOutreachRun(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "outreach"] });
      toast.success("Approved");
    },
    // The server refuses self-approval with a sentence explaining why. It is
    // surfaced verbatim rather than replaced with "forbidden".
    onError: (error: Error) => toast.error(error.message, { title: "Not approved" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => marketingService.cancelOutreachRun(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketing", "outreach"] });
      toast.success("Cancelled");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not cancel" }),
  });

  const columns = [
    {
      key: "cohort",
      label: "Cohort",
      render: (row: MarketingOutreachRun) => (
        <Stack gap={0}>
          <Text fw={500}>{cohortName(row.cohort_id)}</Text>
          <Text size="xs" c="dimmed">
            {row.channel}
            {row.dlt_template_id && ` · DLT ${row.dlt_template_id}`}
          </Text>
        </Stack>
      ),
    },
    {
      key: "body_preview",
      label: "Message",
      // The approver approves the words, not a template name. If there is no
      // preview that is stated, because approving an unseen message is the
      // failure this queue exists to prevent.
      render: (row: MarketingOutreachRun) =>
        row.body_preview ? (
          <Text size="sm" lineClamp={3}>
            {row.body_preview}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            No preview — nothing to review
          </Text>
        ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: MarketingOutreachRun) => (
        <Badge tone={STATUS_TONE[row.status] ?? "neutral"} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "counts",
      label: "Sent / failed",
      render: (row: MarketingOutreachRun) => (
        <Text size="sm">
          {row.sent_count} / {row.failed_count}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: MarketingOutreachRun) => {
        const isOwnRun = row.created_by !== null && row.created_by === currentUserId;
        return (
          <Group gap="xs" wrap="nowrap">
            {canSend && row.status === "draft" && (
              <Button
                tone="primary"
                size="xs"
                loading={submitMutation.isPending}
                onClick={() => submitMutation.mutate(row.id)}
              >
                Send for review
              </Button>
            )}
            {canApprove && row.status === "pending" && (
              // Disabled rather than left to fail: the rule is a second pair
              // of eyes, and a button that refuses on press teaches nothing.
              <Tooltip
                label={
                  isOwnRun
                    ? "You raised this run. Approval is a second pair of eyes, so somebody else must give it."
                    : "Approve this run for sending"
                }
              >
                <Button
                  tone="primary"
                  size="xs"
                  disabled={isOwnRun}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(row.id)}
                >
                  Approve
                </Button>
              </Tooltip>
            )}
            {canDispatch && row.status === "approved" && (
              <Tooltip label="Checks consent for the whole cohort, then queues the sendable ones">
                <Button
                  tone="primary"
                  size="xs"
                  loading={startMutation.isPending}
                  onClick={() => startMutation.mutate(row.id)}
                >
                  Start sending
                </Button>
              </Tooltip>
            )}
            {canSeeRecipients &&
              (row.status === "sending" ||
                row.status === "completed" ||
                row.status === "failed") && (
                <Button
                  tone="ghost"
                  size="xs"
                  onClick={() => {
                    setInspecting(row);
                    detail[1].open();
                  }}
                >
                  Who it reached
                </Button>
              )}
            {canSend && (row.status === "draft" || row.status === "pending") && (
              <Button
                tone="danger-ghost"
                size="xs"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(row.id)}
              >
                Cancel
              </Button>
            )}
          </Group>
        );
      },
    },
  ];

  return (
    <Stack>
      <DataTable
        columns={columns}
        data={runs}
        loading={isLoading}
        rowKey={(row: MarketingOutreachRun) => row.id}
        emptyTitle={isError ? "Outreach runs could not be loaded" : "Nothing awaiting review"}
        emptyDescription={
          isError
            ? "This is not a statement that nothing is pending — the list failed to load."
            : "Runs raised against a cohort appear here for approval before anything is sent."
        }
      />

      <RunDetailDrawer
        run={inspecting}
        opened={detail[0]}
        onClose={() => {
          detail[1].close();
          setInspecting(null);
        }}
      />
    </Stack>
  );
}
