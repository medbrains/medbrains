import { Drawer, Group, Select, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import { type BreakGlassEventSummary, P } from "@medbrains/types";
import { IconEye, IconShieldLock } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Column, DataTable } from "@/components/DataTable";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { auditService } from "@/services/audit.service";

type BreakGlassFilter = "all" | "active" | "needs_review" | "reviewed";

const FILTER_OPTIONS = [
  { value: "needs_review", label: "Needs review" },
  { value: "active", label: "Active" },
  { value: "reviewed", label: "Reviewed" },
  { value: "all", label: "All" },
];

const lifecycleBadge = (event: BreakGlassEventSummary): { tone: BadgeTone; label: string } => {
  if (event.is_active) return { tone: "danger", label: "Active" };
  if (event.end_time) return { tone: "neutral", label: "Ended" };
  if (new Date(event.expires_at).getTime() <= Date.now()) {
    return { tone: "warning", label: "Expired" };
  }
  return { tone: "neutral", label: "Inactive" };
};

const reviewBadge = (event: BreakGlassEventSummary): { tone: BadgeTone; label: string } =>
  event.reviewed_at
    ? { tone: "success", label: "Reviewed" }
    : { tone: "warning", label: "Needs review" };

const moduleBadges = (modules: string[]) =>
  modules.length > 0 ? (
    <Group gap={4}>
      {modules.slice(0, 3).map((module) => (
        <Badge key={module} size="xs">
          {module}
        </Badge>
      ))}
      {modules.length > 3 && (
        <Badge size="xs" tone="neutral">
          +{modules.length - 3}
        </Badge>
      )}
    </Group>
  ) : (
    <Text size="sm" c="dimmed">
      All patient context
    </Text>
  );

const queryForFilter = (filter: BreakGlassFilter) => {
  switch (filter) {
    case "active":
      return { is_active: true, per_page: 100 };
    case "needs_review":
      return { reviewed: false, per_page: 100 };
    case "reviewed":
      return { reviewed: true, per_page: 100 };
    default:
      return { per_page: 100 };
  }
};

function toBreakGlassFilter(value: string | null): BreakGlassFilter {
  switch (value) {
    case "all":
    case "active":
    case "reviewed":
      return value;
    default:
      return "needs_review";
  }
}

export function BreakGlassReviewTab() {
  const queryClient = useQueryClient();
  const canReview = useHasPermission(P.AUDIT.BREAK_GLASS_REVIEW);
  const [filter, setFilter] = useState<BreakGlassFilter>("needs_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["break-glass", filter],
    queryFn: () => auditService.listBreakGlass(queryForFilter(filter)),
    enabled: canReview,
  });

  const { data: selectedEvent, isLoading: detailLoading } = useQuery({
    queryKey: ["break-glass", selectedId],
    queryFn: () => auditService.getBreakGlass(selectedId ?? ""),
    enabled: canReview && !!selectedId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      auditService.reviewBreakGlass(id, { review_notes: notes.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["break-glass"] });
      setReviewNotes("");
      notifications.show({
        title: "Break-glass reviewed",
        message: "Supervisor review has been recorded.",
        color: "success",
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: "Review failed",
        message: error.message,
        color: "danger",
      });
    },
  });

  const openEvent = (event: BreakGlassEventSummary) => {
    setSelectedId(event.id);
    setReviewNotes("");
    openDetail();
  };

  if (!canReview) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        Break-glass evidence is restricted to review users.
      </Text>
    );
  }

  const columns: Column<BreakGlassEventSummary>[] = [
    {
      key: "lifecycle",
      label: "Access",
      render: (event) => {
        const badge = lifecycleBadge(event);
        return <Badge tone={badge.tone}>{badge.label}</Badge>;
      },
    },
    {
      key: "review",
      label: "Review",
      render: (event) => {
        const badge = reviewBadge(event);
        return <Badge tone={badge.tone}>{badge.label}</Badge>;
      },
    },
    {
      key: "user",
      label: "User",
      render: (event) => <Text size="sm">{event.user_name ?? event.user_id.slice(0, 8)}</Text>,
    },
    {
      key: "patient",
      label: "Patient",
      render: (event) => (
        <Text size="sm">{event.patient_name ?? event.patient_id?.slice(0, 8) ?? "-"}</Text>
      ),
    },
    {
      key: "scope",
      label: "Scope",
      render: (event) => (
        <Stack gap={2}>
          <Text size="sm">{event.scope_type.replace(/_/g, " ")}</Text>
          <Text size="xs" c="dimmed">
            {event.scope_id?.slice(0, 8) ?? "-"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "modules",
      label: "Requested modules",
      render: (event) => moduleBadges(event.requested_modules),
    },
    {
      key: "phi_access_count",
      label: "PHI reads",
      render: (event) => (
        <Badge tone={event.phi_access_count > 0 ? "warning" : "neutral"}>
          {event.phi_access_count}
        </Badge>
      ),
    },
    {
      key: "time",
      label: "Window",
      render: (event) => (
        <Stack gap={2}>
          <Text size="sm">{formatDateTime(event.start_time)}</Text>
          <Text size="xs" c="dimmed">
            Expires {formatDateTime(event.expires_at)}
          </Text>
        </Stack>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (event) => (
        <Tooltip label="View review evidence">
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconEye size={14} />}
            onClick={() => openEvent(event)}
          >
            Review
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Group gap="xs">
            <IconShieldLock size={18} />
            <Text fw={600}>Break-glass supervisor review</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Emergency patient access is scoped, time-limited, and must be reviewed after use.
          </Text>
        </Stack>
        <Select
          label="Queue"
          data={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => setFilter(toBreakGlassFilter(value))}
          w={180}
        />
      </Group>

      <DataTable
        columns={columns}
        data={events}
        loading={isLoading}
        rowKey={(event) => event.id}
        onRowClick={openEvent}
        emptyTitle="No break-glass events"
        emptyDescription="Emergency access sessions will appear here for supervisor review."
      />

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Break-glass evidence"
        position="right"
        size="xl"
      >
        {detailLoading || !selectedEvent ? (
          <Text c="dimmed">Loading...</Text>
        ) : (
          <Stack>
            <Group>
              <Badge tone={selectedEvent.is_active ? "danger" : "neutral"}>
                {selectedEvent.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge tone={selectedEvent.reviewed_at ? "success" : "warning"}>
                {selectedEvent.reviewed_at ? "Reviewed" : "Needs review"}
              </Badge>
            </Group>

            <Stack gap={4}>
              <Text fw={600}>Reason</Text>
              <Text size="sm">{selectedEvent.reason}</Text>
              {selectedEvent.justification && (
                <Text size="sm" c="dimmed">
                  {selectedEvent.justification}
                </Text>
              )}
            </Stack>

            <Group grow align="flex-start">
              <Stack gap={4}>
                <Text fw={600}>Actor</Text>
                <Text size="sm">{selectedEvent.user_id}</Text>
              </Stack>
              <Stack gap={4}>
                <Text fw={600}>Patient scope</Text>
                <Text size="sm">{selectedEvent.patient_id ?? selectedEvent.scope_id ?? "-"}</Text>
              </Stack>
            </Group>

            <Group grow align="flex-start">
              <Stack gap={4}>
                <Text fw={600}>Started</Text>
                <Text size="sm">{formatDateTime(selectedEvent.start_time)}</Text>
              </Stack>
              <Stack gap={4}>
                <Text fw={600}>Expires</Text>
                <Text size="sm">{formatDateTime(selectedEvent.expires_at)}</Text>
              </Stack>
              <Stack gap={4}>
                <Text fw={600}>Ended</Text>
                <Text size="sm">{formatDateTime(selectedEvent.end_time)}</Text>
              </Stack>
            </Group>

            <Stack gap={4}>
              <Text fw={600}>Requested modules</Text>
              {moduleBadges(selectedEvent.requested_modules)}
            </Stack>

            <Stack gap={4}>
              <Text fw={600}>Modules actually accessed</Text>
              {moduleBadges(selectedEvent.modules_accessed)}
            </Stack>

            <Group grow align="flex-start">
              <Stack gap={4}>
                <Text fw={600}>PHI access count</Text>
                <Text size="sm">{selectedEvent.phi_access_count}</Text>
              </Stack>
              <Stack gap={4}>
                <Text fw={600}>Last PHI access</Text>
                <Text size="sm">{formatDateTime(selectedEvent.last_phi_accessed_at)}</Text>
              </Stack>
            </Group>

            {selectedEvent.reviewed_at ? (
              <Stack gap={4}>
                <Text fw={600}>Supervisor review</Text>
                <Text size="sm">{selectedEvent.review_notes || "Reviewed without notes."}</Text>
                <Text size="xs" c="dimmed">
                  Reviewed {formatDateTime(selectedEvent.reviewed_at)} by{" "}
                  {selectedEvent.supervisor_id ?? "-"}
                </Text>
              </Stack>
            ) : (
              canReview && (
                <Stack>
                  <Textarea
                    label="Supervisor review notes"
                    minRows={4}
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.currentTarget.value)}
                    placeholder="Confirm the emergency reason, scope, PHI accessed, and any follow-up action."
                    required
                  />
                  <Button
                    tone="primary"
                    loading={reviewMutation.isPending}
                    disabled={!reviewNotes.trim()}
                    onClick={() =>
                      reviewMutation.mutate({ id: selectedEvent.id, notes: reviewNotes })
                    }
                  >
                    Record review
                  </Button>
                </Stack>
              )
            )}
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
