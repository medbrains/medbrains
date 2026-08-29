import { Group, Stack, Text } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import type { MarketingCohort, MarketingOutreachRun } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge, Button, Tooltip, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

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
    </Stack>
  );
}
