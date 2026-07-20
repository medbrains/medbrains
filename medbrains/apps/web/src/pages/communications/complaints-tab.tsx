// IPD ComplaintsTab — split from communications.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CommComplaintRow,
  CommComplaintSource,
  CreateCommComplaintRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { communicationsService } from "@/services/communications.service";
import { numberValue, optionalText, requiredText } from "./shared";

function complaintSource(value: string | null | undefined): CommComplaintSource | null {
  if (
    value === "walk_in" ||
    value === "phone" ||
    value === "email" ||
    value === "portal" ||
    value === "kiosk" ||
    value === "social_media" ||
    value === "google_review"
  ) {
    return value;
  }
  return null;
}

const COMPLAINT_STATUS_COLORS: Record<string, BadgeTone> = {
  open: "danger",
  assigned: "info",
  in_progress: "warning",
  pending_review: "warning",
  resolved: "success",
  closed: "neutral",
  reopened: "danger",
};

const SEVERITY_COLORS: Record<string, BadgeTone> = {
  low: "info",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

type ComplaintForm = {
  source: string | null;
  complainant_name: string;
  complainant_phone: string;
  complainant_email: string;
  category: string | null;
  severity: string | null;
  subject: string;
  description: string;
  sla_hours: number | string;
};

const emptyComplaintForm: ComplaintForm = {
  source: null,
  complainant_name: "",
  complainant_phone: "",
  complainant_email: "",
  category: null,
  severity: null,
  subject: "",
  description: "",
  sla_hours: 48,
};

function complaintPayload(form: ComplaintForm): CreateCommComplaintRequest | null {
  const source = complaintSource(form.source);
  const complainant_name = requiredText(form.complainant_name);
  const subject = requiredText(form.subject);
  const description = requiredText(form.description);
  if (!source || !complainant_name || !subject || !description) return null;
  return {
    source,
    complainant_name,
    subject,
    description,
    complainant_phone: optionalText(form.complainant_phone),
    complainant_email: optionalText(form.complainant_email),
    category: optionalText(form.category),
    severity: optionalText(form.severity),
    sla_hours: numberValue(form.sla_hours),
  };
}

export function ComplaintsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.COMMUNICATIONS.COMPLAINTS_CREATE);
  const canManage = useHasPermission(P.COMMUNICATIONS.COMPLAINTS_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [form, setForm] = useState<ComplaintForm>(emptyComplaintForm);

  const { data = [], isLoading } = useQuery({
    queryKey: ["comm-complaints", statusFilter],
    queryFn: () => communicationsService.listComplaints({ status: statusFilter ?? undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateCommComplaintRequest) => communicationsService.createComplaint(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-complaints"] });
      close();
      notifications.show({ title: "Registered", message: "Complaint registered", color: "green" });
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => communicationsService.resolveComplaint(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comm-complaints"] });
      notifications.show({ title: "Resolved", message: "Complaint resolved", color: "green" });
    },
  });

  const cols: Column<CommComplaintRow>[] = [
    {
      key: "complaint_code",
      label: "Code",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.complaint_code}
        </Text>
      ),
    },
    {
      key: "source",
      label: "Source",
      render: (r) => <Badge size="sm">{r.source.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="sm" tone={COMPLAINT_STATUS_COLORS[r.status] ?? "neutral"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      render: (r) => (
        <Badge size="sm" tone={SEVERITY_COLORS[r.severity ?? "medium"] ?? "neutral"}>
          {r.severity ?? "medium"}
        </Badge>
      ),
    },
    {
      key: "complainant_name",
      label: "Complainant",
      render: (r) => <Text size="sm">{r.complainant_name}</Text>,
    },
    {
      key: "subject",
      label: "Subject",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.subject}
        </Text>
      ),
    },
    {
      key: "sla_deadline",
      label: "SLA",
      render: (r) => {
        if (!r.sla_deadline) return <Text size="sm">—</Text>;
        const remaining = (new Date(r.sla_deadline).getTime() - Date.now()) / 3600000;
        return (
          <Badge size="sm" tone={r.sla_breached ? "danger" : remaining < 4 ? "warning" : "success"}>
            {r.sla_breached ? "Breached" : `${Math.round(remaining)}h`}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canManage && r.status !== "resolved" && r.status !== "closed" ? (
          <Tooltip label="Resolve">
            <IconButton
              tone="success"
              size="sm"
              onClick={() => resolveMut.mutate(r.id)}
              aria-label="Confirm"
            >
              <IconCheck size={14} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={Object.keys(COMPLAINT_STATUS_COLORS).map((s) => ({
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
              setForm(emptyComplaintForm);
              open();
            }}
          >
            New Complaint
          </Button>
        )}
      </Group>
      <DataTable columns={cols} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Register Complaint" position="right" size="xl">
        <Stack>
          <Select
            label="Source"
            required
            data={["walk_in", "phone", "email", "portal", "kiosk", "social_media", "google_review"]}
            value={form.source ?? null}
            onChange={(v) => setForm({ ...form, source: v })}
          />
          <TextInput
            label="Complainant Name"
            required
            value={form.complainant_name ?? ""}
            onChange={(e) => setForm({ ...form, complainant_name: e.currentTarget.value })}
          />
          <TextInput
            label="Phone"
            value={form.complainant_phone ?? ""}
            onChange={(e) => setForm({ ...form, complainant_phone: e.currentTarget.value })}
          />
          <TextInput
            label="Email"
            value={form.complainant_email ?? ""}
            onChange={(e) => setForm({ ...form, complainant_email: e.currentTarget.value })}
          />
          <Select
            label="Category"
            data={[
              "clinical",
              "billing",
              "staff_behavior",
              "facilities",
              "wait_time",
              "food",
              "other",
            ]}
            value={form.category ?? null}
            onChange={(v) => setForm({ ...form, category: v })}
          />
          <Select
            label="Severity"
            data={["low", "medium", "high", "critical"]}
            value={form.severity ?? null}
            onChange={(v) => setForm({ ...form, severity: v })}
          />
          <TextInput
            label="Subject"
            required
            value={form.subject ?? ""}
            onChange={(e) => setForm({ ...form, subject: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            required
            minRows={3}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
          />
          <NumberInput
            label="SLA Hours"
            value={form.sla_hours ?? 48}
            onChange={(v) => setForm({ ...form, sla_hours: v })}
          />
          <Button
            tone="primary"
            onClick={() => {
              const payload = complaintPayload(form);
              if (!payload) return;
              createMut.mutate(payload);
            }}
            loading={createMut.isPending}
          >
            Register
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Feedback Tab ────────────────────────────────────────
