import { zodResolver } from "@hookform/resolvers/zod";
import {
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
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { RetrospectiveEntry, RetrospectiveSettings } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconHistory, IconList, IconSettings, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { type Column, DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import {
  DEFAULT_RETROSPECTIVE_REVIEW_FORM_VALUES,
  DEFAULT_RETROSPECTIVE_SETTINGS_FORM_VALUES,
  type RetrospectiveReviewFormInput,
  type RetrospectiveSettingsFormInput,
  retrospectiveReviewFormSchema,
  retrospectiveSettingsFormSchema,
  toRetrospectiveReviewRequest,
  toRetrospectiveSettingsFormValues,
  toRetrospectiveSettingsRequest,
} from "@/forms/retrospective.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { statusColor } from "@/lib/status-colors";
import { retrospectiveService } from "@/services/retrospective.service";

// ── Status badge helpers ──

function statusColorTone(v: string): BadgeTone {
  const c = statusColor(v);
  const m: Record<string, BadgeTone> = {
    success: "success",
    danger: "danger",
    warning: "warning",
    primary: "primary",
    info: "info",
    slate: "neutral",
    gray: "neutral",
    teal: "success",
    green: "success",
    red: "danger",
    yellow: "warning",
    orange: "warning",
    blue: "info",
    violet: "accent",
    cinnabar: "accent",
  };
  return (c ? m[c] : undefined) ?? "neutral";
}

type ReviewAction = "approve" | "reject";

type ReviewTarget = {
  id: string;
  action: ReviewAction;
};

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusColorTone(status)}>{status}</Badge>;
}

// ── Approval Queue Tab ──

function ApprovalQueueTab() {
  const canApprove = useHasPermission(P.RETROSPECTIVE.APPROVE);
  const queryClient = useQueryClient();
  const [reviewOpened, reviewDisclosure] = useDisclosure(false);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const reviewForm = useForm<RetrospectiveReviewFormInput>({
    resolver: zodResolver(retrospectiveReviewFormSchema),
    defaultValues: DEFAULT_RETROSPECTIVE_REVIEW_FORM_VALUES,
  });

  const { data = [], isLoading } = useQuery<RetrospectiveEntry[]>({
    queryKey: ["retro-entries", "pending"],
    queryFn: () => retrospectiveService.listEntries({ status: "pending" }),
  });

  const approveMut = useMutation({
    mutationFn: (params: { id: string; data: RetrospectiveReviewFormInput }) =>
      retrospectiveService.approveEntry(params.id, toRetrospectiveReviewRequest(params.data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retro-entries"] });
      closeReview();
    },
  });

  const rejectMut = useMutation({
    mutationFn: (params: { id: string; data: RetrospectiveReviewFormInput }) =>
      retrospectiveService.rejectEntry(params.id, toRetrospectiveReviewRequest(params.data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retro-entries"] });
      closeReview();
    },
  });

  function openReview(id: string, action: ReviewAction) {
    setReviewTarget({ id, action });
    reviewForm.reset(DEFAULT_RETROSPECTIVE_REVIEW_FORM_VALUES);
    reviewDisclosure.open();
  }

  function closeReview() {
    reviewDisclosure.close();
    setReviewTarget(null);
    reviewForm.reset(DEFAULT_RETROSPECTIVE_REVIEW_FORM_VALUES);
  }

  function handleConfirm(values: RetrospectiveReviewFormInput) {
    if (!reviewTarget) return;
    if (reviewTarget.action === "approve") {
      approveMut.mutate({ id: reviewTarget.id, data: values });
    } else {
      rejectMut.mutate({ id: reviewTarget.id, data: values });
    }
  }

  const columns: Column<RetrospectiveEntry>[] = [
    {
      key: "source_table",
      label: "Source",
      render: (r) => (
        <Badge tone="neutral" variant="outline">
          {r.source_table}
        </Badge>
      ),
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
              tone="primary"
              size="xs"
              leftSection={<IconCheck size={14} />}
              onClick={() => openReview(r.id, "approve")}
            >
              Approve
            </Button>
            <Button
              tone="subtle-danger"
              size="xs"
              leftSection={<IconX size={14} />}
              onClick={() => openReview(r.id, "reject")}
            >
              Reject
            </Button>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        ),
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />

      <Modal
        opened={reviewOpened}
        onClose={closeReview}
        title={reviewTarget?.action === "approve" ? "Approve Entry" : "Reject Entry"}
      >
        <Stack component="form" onSubmit={reviewForm.handleSubmit(handleConfirm)}>
          <Textarea
            label="Review Notes (optional)"
            minRows={3}
            error={reviewForm.formState.errors.review_notes?.message}
            {...reviewForm.register("review_notes")}
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={closeReview}>
              Cancel
            </Button>
            <Button
              tone={reviewTarget?.action === "approve" ? "primary" : "danger"}
              type="submit"
              loading={approveMut.isPending || rejectMut.isPending}
            >
              {reviewTarget?.action === "approve" ? "Approve" : "Reject"}
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

  const { data = [], isLoading } = useQuery<RetrospectiveEntry[]>({
    queryKey: ["retro-entries", statusFilter, sourceFilter],
    queryFn: () =>
      retrospectiveService.listEntries({
        status: statusFilter ?? undefined,
        source_table: sourceFilter ?? undefined,
      }),
  });

  const columns: Column<RetrospectiveEntry>[] = [
    {
      key: "source_table",
      label: "Source",
      render: (r) => (
        <Badge tone="neutral" variant="outline">
          {r.source_table}
        </Badge>
      ),
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
      render: (r) => (r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "-"),
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
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
    </Stack>
  );
}

// ── Settings Tab ──

function SettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<RetrospectiveSettings>({
    queryKey: ["retro-settings"],
    queryFn: () => retrospectiveService.getSettings(),
  });

  const settingsForm = useForm<RetrospectiveSettingsFormInput>({
    resolver: zodResolver(retrospectiveSettingsFormSchema),
    defaultValues: DEFAULT_RETROSPECTIVE_SETTINGS_FORM_VALUES,
    values: toRetrospectiveSettingsFormValues(settings),
  });

  const settingsErrors = settingsForm.formState.errors;

  const saveMut = useMutation({
    mutationFn: (values: RetrospectiveSettingsFormInput) =>
      retrospectiveService.updateSettings(toRetrospectiveSettingsRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retro-settings"] });
    },
  });

  return (
    <Paper
      component="form"
      p="lg"
      withBorder
      maw={500}
      onSubmit={settingsForm.handleSubmit((values) => saveMut.mutate(values))}
    >
      <Stack>
        <Title order={4}>Retrospective Entry Settings</Title>
        <Controller
          control={settingsForm.control}
          name="max_backdate_hours"
          render={({ field }) => (
            <NumberInput
              label="Maximum Backdate Window (hours)"
              description="How far back users can create retrospective entries"
              value={field.value}
              onChange={field.onChange}
              error={settingsErrors.max_backdate_hours?.message}
              min={1}
              max={720}
              disabled={isLoading}
            />
          )}
        />
        <Controller
          control={settingsForm.control}
          name="requires_approval"
          render={({ field }) => (
            <Switch
              label="Require Approval"
              description="Retrospective entries must be approved by a reviewer"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              disabled={isLoading}
            />
          )}
        />
        <Group justify="flex-end">
          <Button tone="primary" type="submit" loading={saveMut.isPending}>
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
