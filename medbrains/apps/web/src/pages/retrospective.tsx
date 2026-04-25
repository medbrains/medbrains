import { useState } from "react";
import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import {
  IconCheck,
  IconHistory,
  IconList,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { P } from "@medbrains/types";
import type {
  RetrospectiveEntry,
  RetrospectiveSettings,
  ApproveRejectRequest,
} from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { api } from "@medbrains/api";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";

// ── Status badge helpers ──

const STATUS_COLORS: Record<string, string> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge color={STATUS_COLORS[status] ?? "slate"} variant="light">
      {status}
    </Badge>
  );
}

// ── Approval Queue Tab ──

function ApprovalQueueTab() {
  const canApprove = useHasPermission(P.RETROSPECTIVE.APPROVE);
  const queryClient = useQueryClient();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["retro-entries", "pending"],
    queryFn: () => api.listRetroEntries({ status: "pending" }),
  });

  const approveMut = useMutation({
    mutationFn: (params: { id: string; data?: ApproveRejectRequest }) =>
      api.approveRetroEntry(params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retro-entries"] });
      setReviewId(null);
      setReviewNotes("");
    },
  });

  const rejectMut = useMutation({
    mutationFn: (params: { id: string; data?: ApproveRejectRequest }) =>
      api.rejectRetroEntry(params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retro-entries"] });
      setReviewId(null);
      setReviewNotes("");
    },
  });

  function handleConfirm() {
    if (!reviewId) return;
    const payload: ApproveRejectRequest = { review_notes: reviewNotes || undefined };
    if (reviewAction === "approve") {
      approveMut.mutate({ id: reviewId, data: payload });
    } else {
      rejectMut.mutate({ id: reviewId, data: payload });
    }
  }

  const columns: Column<RetrospectiveEntry>[] = [
    {
      key: "source_table",
      label: "Source",
      render: (r) => <Badge variant="outline">{r.source_table}</Badge>,
    },
    {
      key: "clinical_event_date",
      label: "Clinical Event Date",
      render: (r) => new Date(r.clinical_event_date).toLocaleDateString(),
    },
    {
      key: "entry_date",
      label: "Entry Date",
      render: (r) => new Date(r.entry_date).toLocaleDateString(),
    },
    {
      key: "entered_by_name",
      label: "Entered By",
      render: (r) => r.entered_by_name ?? "-",
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.reason}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) =>
        canApprove ? (
          <Group gap="xs">
            <Button
              size="xs"
              color="success"
              leftSection={<IconCheck size={14} />}
              onClick={() => {
                setReviewId(r.id);
                setReviewAction("approve");
              }}
            >
              Approve
            </Button>
            <Button
              size="xs"
              color="danger"
              variant="outline"
              leftSection={<IconX size={14} />}
              onClick={() => {
                setReviewId(r.id);
                setReviewAction("reject");
              }}
            >
              Reject
            </Button>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">-</Text>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
      />

      <Modal
        opened={reviewId !== null}
        onClose={() => {
          setReviewId(null);
          setReviewNotes("");
        }}
        title={reviewAction === "approve" ? "Approve Entry" : "Reject Entry"}
      >
        <Stack>
          <Textarea
            label="Review Notes (optional)"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setReviewId(null)}>
              Cancel
            </Button>
            <Button
              color={reviewAction === "approve" ? "success" : "danger"}
              onClick={handleConfirm}
              loading={approveMut.isPending || rejectMut.isPending}
            >
              {reviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// ── All Entries Tab ──

function AllEntriesTab() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["retro-entries", statusFilter, sourceFilter],
    queryFn: () =>
      api.listRetroEntries({
        status: statusFilter ?? undefined,
        source_table: sourceFilter ?? undefined,
      }),
  });

  const columns: Column<RetrospectiveEntry>[] = [
    {
      key: "source_table",
      label: "Source",
      render: (r) => <Badge variant="outline">{r.source_table}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "clinical_event_date",
      label: "Clinical Event Date",
      render: (r) => new Date(r.clinical_event_date).toLocaleDateString(),
    },
    {
      key: "entry_date",
      label: "Entry Date",
      render: (r) => new Date(r.entry_date).toLocaleDateString(),
    },
    {
      key: "entered_by_name",
      label: "Entered By",
      render: (r) => r.entered_by_name ?? "-",
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.reason}
        </Text>
      ),
    },
    {
      key: "reviewed_by_name",
      label: "Reviewed By",
      render: (r) => r.reviewed_by_name ?? "-",
    },
    {
      key: "reviewed_at",
      label: "Reviewed At",
      render: (r) =>
        r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "-",
    },
    {
      key: "review_notes",
      label: "Review Notes",
      render: (r) => (
        <Text size="sm" lineClamp={2}>
          {r.review_notes ?? "-"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          data={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          w={180}
        />
        <Select
          placeholder="Filter by source"
          clearable
          data={[
            { value: "encounters", label: "Encounters" },
            { value: "vitals", label: "Vitals" },
            { value: "prescriptions", label: "Prescriptions" },
          ]}
          value={sourceFilter}
          onChange={setSourceFilter}
          w={180}
        />
      </Group>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
      />
    </Stack>
  );
}

// ── Settings Tab ──

function SettingsTab() {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<number | string>(72);
  const [approval, setApproval] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["retro-settings"],
    queryFn: () => api.getRetroSettings(),
    select: (data: RetrospectiveSettings) => {
      if (!loaded) {
        setHours(data.max_backdate_hours);
        setApproval(data.requires_approval);
        setLoaded(true);
      }
      return data;
    },
  });

  const saveMut = useMutation({
    mutationFn: () =>
      api.updateRetroSettings({
        max_backdate_hours: typeof hours === "number" ? hours : 72,
        requires_approval: approval,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retro-settings"] });
    },
  });

  return (
    <Paper p="lg" withBorder maw={500}>
      <Stack>
        <Title order={4}>Retrospective Entry Settings</Title>
        <NumberInput
          label="Maximum Backdate Window (hours)"
          description="How far back users can create retrospective entries"
          value={hours}
          onChange={setHours}
          min={1}
          max={720}
          disabled={isLoading}
        />
        <Switch
          label="Require Approval"
          description="Retrospective entries must be approved by a reviewer"
          checked={approval}
          onChange={(e) => setApproval(e.currentTarget.checked)}
          disabled={isLoading}
        />
        <Group justify="flex-end">
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending}>
            Save Settings
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

// ── Main Page ──

export function RetrospectivePage() {
  useRequirePermission(P.RETROSPECTIVE.LIST);

  const canApprove = useHasPermission(P.RETROSPECTIVE.APPROVE);
  const canSettings = useHasPermission(P.RETROSPECTIVE.SETTINGS);

  return (
    <div>
      <PageHeader
        title="Retrospective Data Entry"
        subtitle="Manage backdated clinical entries and approval workflows"
      />

      <Tabs defaultValue="queue">
        <Tabs.List mb="md">
          {canApprove && (
            <Tabs.Tab value="queue" leftSection={<IconHistory size={16} />}>
              Approval Queue
            </Tabs.Tab>
          )}
          <Tabs.Tab value="all" leftSection={<IconList size={16} />}>
            All Entries
          </Tabs.Tab>
          {canSettings && (
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              Settings
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canApprove && (
          <Tabs.Panel value="queue">
            <ApprovalQueueTab />
          </Tabs.Panel>
        )}

        <Tabs.Panel value="all">
          <AllEntriesTab />
        </Tabs.Panel>

        {canSettings && (
          <Tabs.Panel value="settings">
            <SettingsTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}
