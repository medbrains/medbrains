// Utilization-review ReviewsTab — split from utilization-review.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Timeline,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { UtilizationReviewFormInput } from "@medbrains/schemas";
import { utilizationReviewFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { UtilizationReview } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCircleCheck, IconCircleX, IconClock, IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import type { CreateUrReviewInput } from "@/services/utilizationReview.service";
import { utilizationReviewService } from "@/services/utilizationReview.service";
import { optionalTrimmed, reviewTypeColors, statusColorTone } from "./shared";

type ReviewViewMode = "list" | "timeline";

const EMPTY_REVIEW_FORM: UtilizationReviewFormInput = {
  admission_id: "",
  patient_id: "",
  review_type: "admission",
  patient_status: "inpatient",
  criteria_source: "",
  clinical_summary: "",
  expected_los_days: "",
  approved_days: "",
  next_review_date: null,
};

function parseReviewViewMode(value: string): ReviewViewMode {
  return value === "timeline" ? "timeline" : "list";
}

function optionalFormInteger(value: string | number): number | undefined {
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateToIsoDate(date: Date | string | null): string | null {
  if (!date) return null;
  if (typeof date === "string") return date;
  return date.toISOString().slice(0, 10);
}

function formToReviewPayload(form: UtilizationReviewFormInput): CreateUrReviewInput {
  return {
    admission_id: form.admission_id.trim(),
    patient_id: form.patient_id.trim(),
    review_type: form.review_type,
    patient_status: form.patient_status,
    criteria_source: optionalTrimmed(form.criteria_source),
    clinical_summary: optionalTrimmed(form.clinical_summary),
    expected_los_days: optionalFormInteger(form.expected_los_days),
    approved_days: optionalFormInteger(form.approved_days),
    next_review_date: form.next_review_date ?? undefined,
  };
}

export function ReviewsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.UR.REVIEWS_CREATE);
  const canUpdate = useHasPermission(P.UR.REVIEWS_UPDATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [viewMode, setViewMode] = useState<ReviewViewMode>("list");
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>("");
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<UtilizationReviewFormInput>({
    resolver: zodResolver(utilizationReviewFormSchema),
    defaultValues: EMPTY_REVIEW_FORM,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-reviews"],
    queryFn: () => utilizationReviewService.listReviews(),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateUrReviewInput) => utilizationReviewService.createReview(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-reviews"] });
      void qc.invalidateQueries({ queryKey: ["ur-analytics"] });
      notifications.show({
        title: "Review Created",
        message: "Utilization review has been created",
        color: "success",
      });
      reset(EMPTY_REVIEW_FORM);
      close();
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to create review", color: "danger" }),
  });

  const aiMut = useMutation({
    mutationFn: (id: string) => utilizationReviewService.extractReview(id),
    onSuccess: (res) => {
      notifications.show({
        title: "AI Extract",
        message: res.message ?? "AI extraction stub called successfully",
        color: "primary",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "AI extraction failed", color: "danger" }),
  });

  const columns: Column<UtilizationReview>[] = [
    {
      key: "admission_id",
      label: "Admission ID",
      render: (r) => <Text size="sm">{r.admission_id.slice(0, 8)}...</Text>,
    },
    {
      key: "review_type",
      label: "Review Type",
      render: (r) => (
        <Badge tone={reviewTypeColors[r.review_type] ?? "neutral"}>
          {r.review_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "review_date",
      label: "Review Date",
      render: (r) => <Text size="sm">{new Date(r.review_date).toLocaleDateString()}</Text>,
    },
    {
      key: "decision",
      label: "Decision",
      render: (r) => (
        <Badge tone={statusColorTone(r.decision)}>{r.decision.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "expected_los_days",
      label: "Expected LOS",
      render: (r) => <Text size="sm">{r.expected_los_days ?? "—"}</Text>,
    },
    {
      key: "actual_los_days",
      label: "Actual LOS",
      render: (r) => <Text size="sm">{r.actual_los_days ?? "—"}</Text>,
    },
    {
      key: "is_outlier",
      label: "Outlier",
      render: (r) =>
        r.is_outlier ? <Badge tone="danger">Outlier</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "next_review_date",
      label: "Next Review",
      render: (r) => (
        <Text size="sm">
          {r.next_review_date ? new Date(r.next_review_date).toLocaleDateString() : "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap="xs">
          {canUpdate && (
            <IconButton onClick={() => aiMut.mutate(r.id)} title="AI Extract" aria-label="Edit">
              <IconPencil size={16} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  // Filter reviews by admission for timeline view
  const timelineReviews = useMemo(() => {
    if (!selectedAdmissionId) return data;
    return data.filter((r) => r.admission_id === selectedAdmissionId);
  }, [data, selectedAdmissionId]);

  // Get unique admission IDs for filter
  const admissionIds = useMemo(() => {
    const ids = Array.from(new Set(data.map((r) => r.admission_id)));
    return ids.map((id) => ({ value: id, label: `${id.slice(0, 12)}...` }));
  }, [data]);

  const openCreateReview = () => {
    reset(EMPTY_REVIEW_FORM);
    open();
  };

  const submitReview = handleSubmit((values) => {
    createMut.mutate(formToReviewPayload(values));
  });

  const getReviewIcon = (decision: string) => {
    switch (decision) {
      case "approved":
        return <IconCircleCheck size={16} />;
      case "denied":
        return <IconCircleX size={16} />;
      default:
        return <IconClock size={16} />;
    }
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Utilization Reviews"
        subtitle="Manage admission-level utilization reviews"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreateReview}>
              New Review
            </Button>
          ) : undefined
        }
      />

      <Group justify="space-between">
        <SegmentedControl
          value={viewMode}
          onChange={(value) => setViewMode(parseReviewViewMode(value))}
          data={[
            { value: "list", label: "List View" },
            { value: "timeline", label: "Timeline View" },
          ]}
        />
        {viewMode === "timeline" && (
          <Select
            placeholder="Select Admission"
            data={admissionIds}
            value={selectedAdmissionId}
            onChange={(v) => setSelectedAdmissionId(v ?? "")}
            clearable
            w={300}
          />
        )}
      </Group>

      {viewMode === "list" ? (
        <DataTable<UtilizationReview>
          data={data}
          loading={isLoading}
          rowKey={(r) => r.id}
          columns={columns}
        />
      ) : (
        <Card withBorder p="md">
          {!selectedAdmissionId ? (
            <Text c="dimmed" ta="center" py="xl">
              Select an admission to view review timeline
            </Text>
          ) : timelineReviews.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              No reviews found for this admission
            </Text>
          ) : (
            <Timeline active={timelineReviews.length - 1} bulletSize={28} lineWidth={2}>
              {timelineReviews.map((r) => (
                <Timeline.Item
                  key={r.id}
                  bullet={getReviewIcon(r.decision)}
                  title={
                    <Group gap="xs">
                      <Text fw={600}>{r.review_type.replace(/_/g, " ")}</Text>
                      <Badge tone={statusColorTone(r.decision)} size="sm">
                        {r.decision.replace(/_/g, " ")}
                      </Badge>
                    </Group>
                  }
                >
                  <Stack gap={4}>
                    <Text size="sm" c="dimmed">
                      Review Date: {new Date(r.review_date).toLocaleDateString()}
                    </Text>
                    {r.reviewer_id && (
                      <Text size="sm" c="dimmed">
                        Reviewer: {r.reviewer_id}
                      </Text>
                    )}
                    {r.expected_los_days && (
                      <Text size="sm">Expected LOS: {r.expected_los_days} days</Text>
                    )}
                    {r.approved_days && (
                      <Text size="sm" c="success">
                        Approved: {r.approved_days} days
                      </Text>
                    )}
                    {r.decision === "denied" && r.notes && (
                      <Text size="sm" c="danger">
                        Denial Reason: {r.notes}
                      </Text>
                    )}
                    {r.clinical_summary && (
                      <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                        {r.clinical_summary}
                      </Text>
                    )}
                    {r.next_review_date && (
                      <Badge tone="primary" size="xs" mt={4}>
                        Next Review: {new Date(r.next_review_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </Stack>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </Card>
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="Create Utilization Review"
        position="right"
        size="xl"
      >
        <Stack component="form" gap="sm" onSubmit={submitReview}>
          <TextInput
            label="Admission ID"
            required
            error={errors.admission_id?.message}
            {...register("admission_id")}
          />
          <Controller
            name="patient_id"
            control={control}
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                required
                error={errors.patient_id?.message}
              />
            )}
          />
          <Controller
            name="review_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Review Type"
                required
                data={[
                  { value: "pre_admission", label: "Pre-Admission" },
                  { value: "admission", label: "Admission" },
                  { value: "continued_stay", label: "Continued Stay" },
                  { value: "retrospective", label: "Retrospective" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.review_type?.message}
              />
            )}
          />
          <Controller
            name="patient_status"
            control={control}
            render={({ field }) => (
              <Select
                label="Patient Status"
                data={[
                  { value: "inpatient", label: "Inpatient" },
                  { value: "observation", label: "Observation" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.patient_status?.message}
              />
            )}
          />
          <TextInput
            label="Criteria Source"
            error={errors.criteria_source?.message}
            {...register("criteria_source")}
          />
          <Textarea
            label="Clinical Summary"
            autosize
            minRows={3}
            error={errors.clinical_summary?.message}
            {...register("clinical_summary")}
          />
          <Controller
            name="expected_los_days"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Expected LOS (days)"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.expected_los_days?.message}
              />
            )}
          />
          <Controller
            name="approved_days"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Approved Days"
                min={0}
                value={field.value}
                onChange={field.onChange}
                error={errors.approved_days?.message}
              />
            )}
          />
          <Controller
            name="next_review_date"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Next Review Date"
                clearable
                value={field.value ? new Date(field.value) : null}
                onChange={(date) => field.onChange(dateToIsoDate(date))}
                error={errors.next_review_date?.message}
              />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Create Review
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 2 — LOS Monitoring
// ═══════════════════════════════════════════════════════
