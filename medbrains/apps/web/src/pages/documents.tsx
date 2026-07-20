import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateReviewScheduleRequest, DocumentFormReviewSchedule } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendarEvent,
  IconFileDescription,
  IconFileText,
  IconPlus,
  IconPrinter,
  IconRoute,
  IconSettings,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { documentsService } from "@/services/documents.service";
import { OutputsTab } from "./documents/outputs-tab";
import { PrintQueueTab } from "./documents/print-queue-tab";
import { PrintRoutingTab } from "./documents/print-routing-tab";
import { PrintersTab } from "./documents/printers-tab";
import { TemplatesTab } from "./documents/templates-tab";

// ── Constants ────────────────────────────────────────────

const REVIEW_STATUS_TONES: Record<string, BadgeTone> = {
  pending: "warning",
  reviewed: "success",
  overdue: "danger",
  gray: "neutral",
  slate: "neutral",
  teal: "success",
  orange: "warning",
  red: "danger",
  blue: "info",
  primary: "primary",
  violet: "accent",
};

function reviewStatusTone(status: string): BadgeTone {
  return REVIEW_STATUS_TONES[status] ?? "neutral";
}

// ── Templates Tab ────────────────────────────────────────

function ReviewScheduleTab() {
  const queryClient = useQueryClient();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

  const canManage = useHasPermission(P.DOCUMENTS.REVIEW_MANAGE);

  const [templateId, setTemplateId] = useState("");
  const [cyclemonths, setCycleMonths] = useState(12);
  const [nextDue, setNextDue] = useState("");
  const [notes, setNotes] = useState("");

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["document-review-schedule"],
    queryFn: () => documentsService.listReviewSchedule(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["document-templates-for-select"],
    queryFn: () => documentsService.listDocumentTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateReviewScheduleRequest) => documentsService.createReviewSchedule(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-review-schedule"] });
      toast.success("Review schedule added", { title: "Schedule Created" });
      closeDrawer();
    },
    onError: () => {
      toast.error("Failed to create schedule", { title: "Error" });
    },
  });

  const markReviewedMutation = useMutation({
    mutationFn: (id: string) => documentsService.markReviewed(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-review-schedule"] });
      toast.success("Schedule marked as reviewed", { title: "Reviewed" });
    },
  });

  const templateOptions = templates.map((t) => ({
    value: t.id,
    label: `${t.code} — ${t.name}`,
  }));

  const columns = [
    {
      key: "template_id",
      label: "Template",
      render: (row: DocumentFormReviewSchedule) => {
        const t = templates.find((tpl) => tpl.id === row.template_id);
        return <Text size="sm">{t ? `${t.code} — ${t.name}` : row.template_id}</Text>;
      },
    },
    {
      key: "review_cycle_months",
      label: "Cycle",
      render: (row: DocumentFormReviewSchedule) => (
        <Text size="sm">{row.review_cycle_months} months</Text>
      ),
    },
    {
      key: "last_reviewed_at",
      label: "Last Reviewed",
      render: (row: DocumentFormReviewSchedule) => (
        <Text size="sm">
          {row.last_reviewed_at ? new Date(row.last_reviewed_at).toLocaleDateString() : "Never"}
        </Text>
      ),
    },
    {
      key: "next_review_due",
      label: "Next Due",
      render: (row: DocumentFormReviewSchedule) => {
        const due = row.next_review_due ? new Date(row.next_review_due) : null;
        const overdue = due && due < new Date();
        return (
          <Text size="sm" c={overdue ? "danger" : undefined} fw={overdue ? 600 : undefined}>
            {due ? due.toLocaleDateString() : "—"}
          </Text>
        );
      },
    },
    {
      key: "review_status",
      label: "Status",
      render: (row: DocumentFormReviewSchedule) => (
        <Badge size="sm" tone={reviewStatusTone(row.review_status ?? "pending")}>
          {row.review_status ?? "pending"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DocumentFormReviewSchedule) => (
        <Group gap={4}>
          {canManage && row.review_status !== "reviewed" && (
            <Button
              tone="ghost"
              size="xs"
              onClick={() => markReviewedMutation.mutate(row.id)}
              loading={markReviewedMutation.isPending}
            >
              Mark Reviewed
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            NABH-mandated annual form/document review tracking
          </Text>
          {canManage && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openDrawer}>
              Add Schedule
            </Button>
          )}
        </Group>

        <DataTable columns={columns} data={schedules} loading={isLoading} rowKey={(r) => r.id} />
      </Stack>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title="Add Review Schedule"
        position="right"
        size="md"
      >
        <Stack gap="sm">
          <Select
            label="Template"
            data={templateOptions}
            value={templateId}
            onChange={(v) => setTemplateId(v ?? "")}
            searchable
            required
          />
          <NumberInput
            label="Review Cycle (months)"
            value={cyclemonths}
            onChange={(v) => setCycleMonths(typeof v === "number" ? v : 12)}
            min={1}
            max={60}
          />
          <TextInput
            label="Next Review Due"
            type="date"
            value={nextDue}
            onChange={(e) => setNextDue(e.currentTarget.value)}
          />
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            rows={3}
          />
          <Group justify="flex-end" mt="md">
            <Button tone="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button
              tone="primary"
              onClick={() =>
                createMutation.mutate({
                  template_id: templateId,
                  review_cycle_months: cyclemonths,
                  next_review_due: nextDue || undefined,
                  notes: notes || undefined,
                })
              }
              loading={createMutation.isPending}
              disabled={!templateId}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Print Routing Tab ───────────────────────────────────

export function DocumentsPage() {
  useRequirePermission([P.DOCUMENTS.TEMPLATES_LIST, P.DOCUMENTS.PRINTERS_LIST]);
  const canViewDocuments = useHasPermission(P.DOCUMENTS.TEMPLATES_LIST);
  const canViewPrinters = useHasPermission(P.DOCUMENTS.PRINTERS_LIST);
  const defaultTab = canViewDocuments ? "templates" : "queue";

  return (
    <div>
      <PageHeader
        title="Documents & Printing"
        subtitle="Manage templates, generated outputs, print queues, and copy/printer routing"
      />
      <Tabs defaultValue={defaultTab}>
        <Tabs.List>
          {canViewDocuments && (
            <Tabs.Tab value="templates" leftSection={<IconFileText size={16} />}>
              Templates
            </Tabs.Tab>
          )}
          {canViewDocuments && (
            <Tabs.Tab value="outputs" leftSection={<IconFileDescription size={16} />}>
              Generated Documents
            </Tabs.Tab>
          )}
          {canViewDocuments && (
            <Tabs.Tab value="review" leftSection={<IconCalendarEvent size={16} />}>
              Review Schedule
            </Tabs.Tab>
          )}
          {canViewPrinters && (
            <Tabs.Tab value="queue" leftSection={<IconPrinter size={16} />}>
              Print Queue
            </Tabs.Tab>
          )}
          {canViewPrinters && (
            <Tabs.Tab value="routes" leftSection={<IconRoute size={16} />}>
              Print Routes
            </Tabs.Tab>
          )}
          {canViewPrinters && (
            <Tabs.Tab value="printers" leftSection={<IconSettings size={16} />}>
              Printers
            </Tabs.Tab>
          )}
        </Tabs.List>

        {canViewDocuments && (
          <Tabs.Panel value="templates" pt="md">
            <TemplatesTab />
          </Tabs.Panel>
        )}
        {canViewDocuments && (
          <Tabs.Panel value="outputs" pt="md">
            <OutputsTab />
          </Tabs.Panel>
        )}
        {canViewDocuments && (
          <Tabs.Panel value="review" pt="md">
            <ReviewScheduleTab />
          </Tabs.Panel>
        )}
        {canViewPrinters && (
          <Tabs.Panel value="queue" pt="md">
            <PrintQueueTab />
          </Tabs.Panel>
        )}
        {canViewPrinters && (
          <Tabs.Panel value="routes" pt="md">
            <PrintRoutingTab />
          </Tabs.Panel>
        )}
        {canViewPrinters && (
          <Tabs.Panel value="printers" pt="md">
            <PrintersTab />
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
}
