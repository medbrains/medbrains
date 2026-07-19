// REGULATORY SubmissionsTab — split from regulatory.tsx (pure move).

import { Drawer, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateRegulatorySubmissionRequest, RegulatorySubmission } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";

export function SubmissionsTab() {
  const canManage = useHasPermission(P.REGULATORY.CALENDAR_MANAGE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["regulatory-submissions"],
    queryFn: () => regulatoryService.listRegulatorySubmissions(),
  });

  const [form, setForm] = useState<CreateRegulatorySubmissionRequest>({
    submission_type: "",
    submitted_to: "",
    submitted_at: new Date().toISOString().slice(0, 10),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateRegulatorySubmissionRequest) =>
      regulatoryService.createRegulatorySubmission(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-submissions"] });
      toast.success("", { title: "Submission recorded" });
      close();
      setForm({
        submission_type: "",
        submitted_to: "",
        submitted_at: new Date().toISOString().slice(0, 10),
      });
    },
  });

  const submissionStatusColors: Record<string, BadgeTone> = {
    pending: "warning",
    submitted: "primary",
    acknowledged: "success",
    rejected: "danger",
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Regulatory Submissions"
        subtitle="Track submissions to regulatory bodies"
        actions={
          canManage ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Submission
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={submissions}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "submission_type",
            label: "Type",
            render: (r: RegulatorySubmission) => <Badge tone="neutral">{r.submission_type}</Badge>,
          },
          {
            key: "submitted_to",
            label: "Submitted To",
            render: (r: RegulatorySubmission) => (
              <Text size="sm" fw={500}>
                {r.submitted_to}
              </Text>
            ),
          },
          {
            key: "reference_number",
            label: "Reference #",
            render: (r: RegulatorySubmission) => (
              <Text size="sm">{r.reference_number ?? "---"}</Text>
            ),
          },
          {
            key: "submitted_at",
            label: "Date",
            render: (r: RegulatorySubmission) => (
              <Text size="sm">{r.submitted_at.slice(0, 10)}</Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: RegulatorySubmission) => (
              <Badge tone={submissionStatusColors[r.status] ?? "neutral"}>{r.status}</Badge>
            ),
          },
          {
            key: "notes",
            label: "Notes",
            render: (r: RegulatorySubmission) => (
              <Text size="sm" lineClamp={1}>
                {r.notes ?? "---"}
              </Text>
            ),
          },
        ]}
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="New Regulatory Submission"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <Select
            label="Submission Type"
            required
            data={[
              "annual_report",
              "quarterly_report",
              "incident_report",
              "license_application",
              "renewal",
              "notification",
              "other",
            ]}
            value={form.submission_type || null}
            onChange={(v) => setForm({ ...form, submission_type: v ?? "" })}
          />
          <TextInput
            label="Submitted To"
            required
            placeholder="e.g., NABH, State Health Dept"
            value={form.submitted_to}
            onChange={(e) => setForm({ ...form, submitted_to: e.currentTarget.value })}
          />
          <TextInput
            label="Reference Number"
            value={form.reference_number ?? ""}
            onChange={(e) =>
              setForm({ ...form, reference_number: e.currentTarget.value || undefined })
            }
          />
          <DateInput
            label="Submission Date"
            required
            value={form.submitted_at ? new Date(form.submitted_at) : null}
            onChange={(d) =>
              setForm({ ...form, submitted_at: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Select
            label="Status"
            data={["pending", "submitted", "acknowledged", "rejected"]}
            value={form.status ?? "submitted"}
            onChange={(v) => setForm({ ...form, status: v ?? undefined })}
          />
          <Textarea
            label="Notes"
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value || undefined })}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Save Submission
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Mock Surveys Tab
// ══════════════════════════════════════════════════════════
