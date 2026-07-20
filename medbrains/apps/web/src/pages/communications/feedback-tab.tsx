// IPD FeedbackTab — split from communications.tsx (pure move).

import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CommFeedbackSurveyRow,
  CommFeedbackType,
  CreateCommFeedbackRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { communicationsService } from "@/services/communications.service";
import { numberValue, optionalText } from "./shared";

function feedbackType(value: string | null | undefined): CommFeedbackType | null {
  if (
    value === "bedside" ||
    value === "post_discharge" ||
    value === "nps" ||
    value === "department" ||
    value === "kiosk"
  ) {
    return value;
  }
  return null;
}

const FEEDBACK_COLORS: Record<string, BadgeTone> = {
  bedside: "success",
  post_discharge: "info",
  nps: "accent",
  department: "warning",
  kiosk: "info",
};

type FeedbackForm = {
  feedback_type: string | null;
  overall_rating: number | string;
  nps_score: number | string;
  staff_rating: number | string;
  cleanliness_rating: number | string;
  would_recommend: boolean;
  comments: string;
  suggestions: string;
  is_anonymous: boolean;
};

const emptyFeedbackForm: FeedbackForm = {
  feedback_type: null,
  overall_rating: "",
  nps_score: "",
  staff_rating: "",
  cleanliness_rating: "",
  would_recommend: false,
  comments: "",
  suggestions: "",
  is_anonymous: false,
};

function feedbackPayload(form: FeedbackForm): CreateCommFeedbackRequest | null {
  const selectedFeedbackType = feedbackType(form.feedback_type);
  if (!selectedFeedbackType) return null;
  return {
    feedback_type: selectedFeedbackType,
    overall_rating: numberValue(form.overall_rating),
    nps_score: numberValue(form.nps_score),
    staff_rating: numberValue(form.staff_rating),
    cleanliness_rating: numberValue(form.cleanliness_rating),
    would_recommend: form.would_recommend,
    comments: optionalText(form.comments),
    suggestions: optionalText(form.suggestions),
    is_anonymous: form.is_anonymous,
  };
}

export function FeedbackTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.COMMUNICATIONS.FEEDBACK_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [form, setForm] = useState<FeedbackForm>(emptyFeedbackForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-feedback", typeFilter],
    queryFn: () =>
      communicationsService.listCommFeedback({ feedback_type: typeFilter ?? undefined }),
  });

  const { data: stats } = useQuery({
    queryKey: ["comm-feedback-stats", typeFilter],
    queryFn: () =>
      communicationsService.getCommFeedbackStats({ feedback_type: typeFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCommFeedbackRequest) => communicationsService.createCommFeedback(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-feedback"] });
      void qc.invalidateQueries({ queryKey: ["comm-feedback-stats"] });
      close();
      notifications.show({ title: "Recorded", message: "Feedback recorded", color: "green" });
    },
  });

  const cols: Column<CommFeedbackSurveyRow>[] = [
    {
      key: "feedback_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.feedback_code}
        </Text>
      ),
    },
    {
      key: "feedback_type",
      label: "Type",
      render: (r) => (
        <Badge size="sm" tone={FEEDBACK_COLORS[r.feedback_type] ?? "neutral"}>
          {r.feedback_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "overall_rating",
      label: "Rating",
      render: (r) => (
        <Text size="sm" fw={600}>
          {r.overall_rating ?? "—"}/5
        </Text>
      ),
    },
    {
      key: "nps_score",
      label: "NPS",
      render: (r) => <Text size="sm">{r.nps_score ?? "—"}/10</Text>,
    },
    {
      key: "would_recommend",
      label: "Recommend",
      render: (r) =>
        r.would_recommend != null ? (
          <Badge size="xs" tone={r.would_recommend ? "success" : "danger"}>
            {r.would_recommend ? "Yes" : "No"}
          </Badge>
        ) : (
          <Text size="sm">—</Text>
        ),
    },
    {
      key: "comments",
      label: "Comments",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.comments ?? "—"}
        </Text>
      ),
    },
    {
      key: "submitted_at",
      label: "Submitted",
      render: (r) => <Text size="sm">{new Date(r.submitted_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Total Responses
          </Text>
          <Text size="xl" fw={700}>
            {stats?.total_responses ?? 0}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            NPS Score
          </Text>
          <Text size="xl" fw={700} c={stats && stats.nps_score >= 50 ? "green" : "orange"}>
            {stats?.nps_score?.toFixed(0) ?? 0}
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Avg Rating
          </Text>
          <Text size="xl" fw={700}>
            {stats?.avg_overall?.toFixed(1) ?? 0}/5
          </Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">
            Would Recommend
          </Text>
          <Text size="xl" fw={700}>
            {stats?.would_recommend_pct?.toFixed(0) ?? 0}%
          </Text>
        </Card>
      </SimpleGrid>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Type"
          clearable
          value={typeFilter}
          onChange={setTypeFilter}
          data={Object.keys(FEEDBACK_COLORS).map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          w={180}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setForm(emptyFeedbackForm);
              open();
            }}
          >
            Collect Feedback
          </Button>
        )}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Collect Feedback" position="right" size="xl">
        <Stack>
          <Select
            label="Type"
            required
            data={Object.keys(FEEDBACK_COLORS)}
            value={form.feedback_type ?? null}
            onChange={(v) => setForm({ ...form, feedback_type: v })}
          />
          <NumberInput
            label="Overall Rating (1-5)"
            min={1}
            max={5}
            value={form.overall_rating ?? ""}
            onChange={(v) => setForm({ ...form, overall_rating: v })}
          />
          <NumberInput
            label="NPS Score (0-10)"
            min={0}
            max={10}
            value={form.nps_score ?? ""}
            onChange={(v) => setForm({ ...form, nps_score: v })}
          />
          <NumberInput
            label="Staff Rating (1-5)"
            min={1}
            max={5}
            value={form.staff_rating ?? ""}
            onChange={(v) => setForm({ ...form, staff_rating: v })}
          />
          <NumberInput
            label="Cleanliness (1-5)"
            min={1}
            max={5}
            value={form.cleanliness_rating ?? ""}
            onChange={(v) => setForm({ ...form, cleanliness_rating: v })}
          />
          <Switch
            label="Would Recommend"
            checked={form.would_recommend ?? false}
            onChange={(e) => setForm({ ...form, would_recommend: e.currentTarget.checked })}
          />
          <Textarea
            label="Comments"
            value={form.comments ?? ""}
            onChange={(e) => setForm({ ...form, comments: e.currentTarget.value })}
          />
          <Textarea
            label="Suggestions"
            value={form.suggestions ?? ""}
            onChange={(e) => setForm({ ...form, suggestions: e.currentTarget.value })}
          />
          <Switch
            label="Anonymous"
            checked={form.is_anonymous ?? false}
            onChange={(e) => setForm({ ...form, is_anonymous: e.currentTarget.checked })}
          />
          <Button
            tone="primary"
            onClick={() => {
              const payload = feedbackPayload(form);
              if (!payload) return;
              createMut.mutate(payload);
            }}
            loading={createMut.isPending}
          >
            Submit
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Config Tab ──────────────────────────────────────────
