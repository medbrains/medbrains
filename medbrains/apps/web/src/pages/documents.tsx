import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { logicalPrinterProfileValues, printCopyModeValues } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateReviewScheduleRequest,
  DocumentFormReviewSchedule,
  DocumentPrintFormat,
  PrintJob,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendarEvent,
  IconCheck,
  IconFileDescription,
  IconFileText,
  IconPlus,
  IconPrinter,
  IconRoute,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { documentsService } from "@/services/documents.service";
import { OutputsTab } from "./documents/outputs-tab";
import { PrintersTab } from "./documents/printers-tab";
import {
  CONNECTION_TYPES,
  capabilityString,
  LOGICAL_PRINTER_PROFILES,
  optionLabel,
  PRINT_COPY_MODES,
  PRINT_FORMATS,
} from "./documents/shared";
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

const printJobStatusColors: Record<PrintJob["status"], BadgeTone> = {
  queued: "warning",
  printing: "primary",
  completed: "success",
  failed: "danger",
  cancelled: "neutral",
};

type PrintCopyMode = (typeof printCopyModeValues)[number];
type LogicalPrinterProfile = (typeof logicalPrinterProfileValues)[number];

interface PrintRoutingRequirement {
  id: string;
  module: string;
  workflow: string;
  artifact: string;
  requiredCopies: readonly PrintCopyMode[];
  printerProfiles: readonly LogicalPrinterProfile[];
  format: DocumentPrintFormat;
  trigger: string;
  standardRefs: readonly string[];
}

const PRINT_ROUTING_REQUIREMENTS: readonly PrintRoutingRequirement[] = [
  {
    id: "registration-sheet",
    module: "Registration",
    workflow: "Patient registration",
    artifact: "Registration sheet",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["registration-a4"],
    format: "a4_portrait",
    trigger: "patient.created",
    standardRefs: ["NABH PRE patient identification", "DPDP Act purpose limitation"],
  },
  {
    id: "patient-card",
    module: "Registration",
    workflow: "Patient card",
    artifact: "Patient card",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["patient-card", "registration-a4"],
    format: "label_50x25mm",
    trigger: "patient.card_printed",
    standardRefs: ["NABH PRE two identifiers"],
  },
  {
    id: "opd-token",
    module: "OPD",
    workflow: "Queue token",
    artifact: "OPD token slip",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["opd-token-thermal", "opd-a4"],
    format: "thermal_80mm",
    trigger: "opd.queue.checked_in",
    standardRefs: ["NABH AAC access and continuity"],
  },
  {
    id: "opd-summary",
    module: "OPD",
    workflow: "Visit closure",
    artifact: "OPD visit summary",
    requiredCopies: ["customer", "office", "clinical", "mrd"],
    printerProfiles: ["opd-summary", "opd-a4", "mrd-record-room"],
    format: "a4_portrait",
    trigger: "opd.visit.completed",
    standardRefs: ["NABH COP continuity of care", "MRD retention control"],
  },
  {
    id: "prescription",
    module: "Pharmacy",
    workflow: "Prescription dispensing",
    artifact: "Prescription / medication labels",
    requiredCopies: ["customer", "office", "pharmacy"],
    printerProfiles: ["opd-a4", "pharmacy-drug-label"],
    format: "a4_portrait",
    trigger: "prescription.signed",
    standardRefs: ["NABH MOM medication safety", "Drugs and Cosmetics Act schedule controls"],
  },
  {
    id: "billing-receipt",
    module: "Billing",
    workflow: "Receipt and invoice",
    artifact: "Receipt / GST invoice",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["billing-receipt-80mm", "billing-a4"],
    format: "thermal_80mm",
    trigger: "payment.captured",
    standardRefs: ["GST invoice retention", "Consumer Protection Act patient rights"],
  },
  {
    id: "ipd-admission",
    module: "IPD",
    workflow: "Admission packet",
    artifact: "Admission case sheet / consent pack",
    requiredCopies: ["customer", "office", "clinical", "mrd"],
    printerProfiles: ["ipd-a4", "consent-a4", "mrd-record-room"],
    format: "a4_portrait",
    trigger: "ipd.admission.created",
    standardRefs: ["NABH AAC admission documentation", "IPSG patient identification"],
  },
  {
    id: "wristband",
    module: "IPD",
    workflow: "Bed assignment",
    artifact: "Patient wristband",
    requiredCopies: ["clinical"],
    printerProfiles: ["wristband-label"],
    format: "wristband",
    trigger: "bed.assigned",
    standardRefs: ["IPSG 1 correct patient identification"],
  },
  {
    id: "emergency-mlc",
    module: "Emergency",
    workflow: "MLC documentation",
    artifact: "MLC register / police intimation",
    requiredCopies: ["office", "clinical", "police", "mrd", "duplicate"],
    printerProfiles: ["mlc-secure-printer", "emergency-a4"],
    format: "a4_portrait",
    trigger: "emergency.mlc.registered",
    standardRefs: ["CrPC/IPC medico-legal reporting", "NABH emergency records"],
  },
  {
    id: "camp-token",
    module: "Camp",
    workflow: "Camp registration",
    artifact: "Camp token and encounter sheet",
    requiredCopies: ["customer", "office"],
    printerProfiles: ["camp-token-thermal", "camp-a4"],
    format: "thermal_80mm",
    trigger: "camp.patient.checked_in",
    standardRefs: ["NABH PRE patient identification"],
  },
  {
    id: "lab-report",
    module: "Lab",
    workflow: "Verified result release",
    artifact: "Lab report",
    requiredCopies: ["customer", "lab", "office"],
    printerProfiles: ["lab-report-a4"],
    format: "a4_portrait",
    trigger: "lab.result.verified",
    standardRefs: ["NABL report traceability", "LOINC-coded result readiness"],
  },
  {
    id: "radiology-report",
    module: "Radiology",
    workflow: "Report sign-off",
    artifact: "Radiology report",
    requiredCopies: ["customer", "office", "clinical"],
    printerProfiles: ["radiology-report-a4"],
    format: "a4_portrait",
    trigger: "radiology.report.signed",
    standardRefs: ["DICOM study traceability", "NABH diagnostic report release"],
  },
  {
    id: "mrd-case-sheet",
    module: "MRD",
    workflow: "Case-sheet packet",
    artifact: "OPD/IPD case-sheet packet",
    requiredCopies: ["mrd", "office", "clinical", "duplicate"],
    printerProfiles: ["mrd-a4", "mrd-record-room"],
    format: "a4_portrait",
    trigger: "mrd.packet.generated",
    standardRefs: ["MRD retention and reprint audit", "NABH IMS"],
  },
];

function readinessTone(color: string): BadgeTone {
  if (color === "success") return "success";
  if (color === "danger") return "danger";
  if (color === "orange") return "warning";
  return "neutral";
}

function routingReadiness(
  route: PrintRoutingRequirement,
  activeProfiles: ReadonlySet<string>,
  activeCopyModes: ReadonlySet<string>,
) {
  const missingProfiles = route.printerProfiles.filter((profile) => !activeProfiles.has(profile));
  const missingCopies = route.requiredCopies.filter((copy) => !activeCopyModes.has(copy));

  if (missingProfiles.length === 0 && missingCopies.length === 0) {
    return { color: "success", label: "Ready", missingCopies, missingProfiles };
  }

  if (missingProfiles.length > 0 && missingCopies.length > 0) {
    return { color: "danger", label: "Profile + copy gap", missingCopies, missingProfiles };
  }

  if (missingProfiles.length > 0) {
    return { color: "orange", label: "Printer profile gap", missingCopies, missingProfiles };
  }

  return { color: "orange", label: "Copy mode gap", missingCopies, missingProfiles };
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

function PrintRoutingTab() {
  const { data: printers = [], isLoading } = useQuery({
    queryKey: ["printers"],
    queryFn: () => documentsService.listPrinters(),
  });

  const activeProfiles = useMemo(
    () =>
      new Set(
        printers
          .filter((printer) => printer.is_active)
          .flatMap((printer) => capabilityString(printer.capabilities, "profile_code")),
      ),
    [printers],
  );
  const activeCopyModes = useMemo(
    () =>
      new Set(
        printers
          .filter((printer) => printer.is_active)
          .flatMap((printer) => capabilityString(printer.capabilities, "copy_modes")),
      ),
    [printers],
  );
  const readyCount = PRINT_ROUTING_REQUIREMENTS.filter(
    (route) =>
      routingReadiness(route, activeProfiles, activeCopyModes).missingProfiles.length === 0 &&
      routingReadiness(route, activeProfiles, activeCopyModes).missingCopies.length === 0,
  ).length;
  const customerCopyCount = PRINT_ROUTING_REQUIREMENTS.filter((route) =>
    route.requiredCopies.includes("customer"),
  ).length;
  const officeCopyCount = PRINT_ROUTING_REQUIREMENTS.filter((route) =>
    route.requiredCopies.includes("office"),
  ).length;

  const columns = [
    {
      key: "workflow",
      label: "Workflow",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={3}>
          <Group gap={6}>
            <Badge>{row.module}</Badge>
            <Badge tone="neutral">{row.trigger}</Badge>
          </Group>
          <Text size="sm" fw={600}>
            {row.workflow}
          </Text>
        </Stack>
      ),
    },
    {
      key: "artifact",
      label: "Print Sheet",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={3}>
          <Text size="sm">{row.artifact}</Text>
          <Text size="xs" c="dimmed">
            {optionLabel(PRINT_FORMATS, row.format)}
          </Text>
        </Stack>
      ),
    },
    {
      key: "copies",
      label: "Copies",
      render: (row: PrintRoutingRequirement) => (
        <Group gap={4}>
          {row.requiredCopies.map((copy) => (
            <Badge
              key={copy}
              tone={copy === "customer" || copy === "office" ? "accent" : "success"}
            >
              {optionLabel(PRINT_COPY_MODES, copy)}
            </Badge>
          ))}
        </Group>
      ),
    },
    {
      key: "printerProfiles",
      label: "Required Printers",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={4}>
          {row.printerProfiles.map((profile) => (
            <Badge key={profile} tone={activeProfiles.has(profile) ? "info" : "warning"}>
              {optionLabel(LOGICAL_PRINTER_PROFILES, profile)}
            </Badge>
          ))}
        </Stack>
      ),
    },
    {
      key: "standards",
      label: "Controls",
      render: (row: PrintRoutingRequirement) => (
        <Stack gap={3}>
          {row.standardRefs.map((standard) => (
            <Text key={standard} size="xs" c="dimmed" lineClamp={1}>
              {standard}
            </Text>
          ))}
        </Stack>
      ),
    },
    {
      key: "status",
      label: "Setup",
      render: (row: PrintRoutingRequirement) => {
        const readiness = routingReadiness(row, activeProfiles, activeCopyModes);
        return (
          <Stack gap={4}>
            <Badge tone={readinessTone(readiness.color)}>{readiness.label}</Badge>
            {readiness.missingProfiles.length > 0 && (
              <Text size="xs" c="orange">
                Missing:{" "}
                {readiness.missingProfiles
                  .map((profile) => optionLabel(LOGICAL_PRINTER_PROFILES, profile))
                  .join(", ")}
              </Text>
            )}
            {readiness.missingCopies.length > 0 && (
              <Text size="xs" c="orange">
                Copy gap:{" "}
                {readiness.missingCopies
                  .map((copy) => optionLabel(PRINT_COPY_MODES, copy))
                  .join(", ")}
              </Text>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 4 }}>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Print Routes
          </Text>
          <Text size="xl" fw={700}>
            {PRINT_ROUTING_REQUIREMENTS.length}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Ready
          </Text>
          <Text
            size="xl"
            fw={700}
            c={readyCount === PRINT_ROUTING_REQUIREMENTS.length ? "success" : "orange"}
          >
            {readyCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Customer Copy
          </Text>
          <Text size="xl" fw={700}>
            {customerCopyCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Office Copy
          </Text>
          <Text size="xl" fw={700}>
            {officeCopyCount}
          </Text>
        </Card>
      </SimpleGrid>

      <DataTable
        columns={columns}
        data={[...PRINT_ROUTING_REQUIREMENTS]}
        loading={isLoading}
        rowKey={(route) => route.id}
        virtualized="auto"
        tableMaxHeight="62vh"
        emptyIcon={<IconRoute size={36} />}
        emptyTitle="No print routes"
        emptyDescription="Add print routing requirements before enabling direct printer dispatch."
      />
    </Stack>
  );
}

// ── Print Queue Tab ─────────────────────────────────────

function PrintQueueTab() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.DOCUMENTS.PRINTERS_MANAGE);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["print-jobs"],
    queryFn: () => documentsService.listPrintJobs(),
  });
  const { data: printers = [] } = useQuery({
    queryKey: ["printers"],
    queryFn: () => documentsService.listPrinters(),
  });

  const printersById = useMemo(
    () => new Map(printers.map((printer) => [printer.id, printer])),
    [printers],
  );
  const queuedCount = jobs.filter((job) => job.status === "queued").length;
  const printingCount = jobs.filter((job) => job.status === "printing").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      status,
      errorMessage,
    }: {
      id: string;
      status: PrintJob["status"];
      errorMessage?: string;
    }) =>
      documentsService.updatePrintJob(id, {
        status,
        error_message: errorMessage,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
      toast.success("Print job status changed", { title: "Print job updated" });
    },
  });

  const columns = [
    {
      key: "created_at",
      label: "Queued At",
      render: (row: PrintJob) => <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PrintJob) => (
        <Badge tone={printJobStatusColors[row.status]}>{row.status}</Badge>
      ),
    },
    {
      key: "printer",
      label: "Printer",
      render: (row: PrintJob) => {
        const printer = row.printer_id ? printersById.get(row.printer_id) : null;
        return (
          <Stack gap={2}>
            <Text size="sm" fw={500}>
              {printer?.name ?? "Unassigned"}
            </Text>
            <Text size="xs" c="dimmed">
              {printer ? optionLabel(CONNECTION_TYPES, printer.connection_type) : "Manual dispatch"}
            </Text>
          </Stack>
        );
      },
    },
    {
      key: "copies",
      label: "Copies",
      render: (row: PrintJob) => (
        <Stack gap={2}>
          <Text size="sm">{row.copies}</Text>
          <Text size="xs" c="dimmed">
            Priority {row.priority}
          </Text>
        </Stack>
      ),
    },
    {
      key: "document_output_id",
      label: "Document",
      render: (row: PrintJob) => (
        <Text size="sm" ff="monospace">
          {row.document_output_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "error_message",
      label: "Last Error",
      render: (row: PrintJob) => (
        <Text size="sm" c={row.error_message ? "danger" : "dimmed"}>
          {row.error_message ?? "—"}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: PrintJob) => (
        <Group gap={4} justify="flex-end">
          {canManage && row.status === "queued" && (
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconPrinter size={14} />}
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: row.id, status: "printing" })}
            >
              Start
            </Button>
          )}
          {canManage && row.status === "printing" && (
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconCheck size={14} />}
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: row.id, status: "completed" })}
            >
              Complete
            </Button>
          )}
          {canManage && (row.status === "queued" || row.status === "printing") && (
            <Button
              tone="subtle-danger"
              size="xs"
              leftSection={<IconX size={14} />}
              loading={updateMutation.isPending}
              onClick={() =>
                updateMutation.mutate({
                  id: row.id,
                  status: row.status === "printing" ? "failed" : "cancelled",
                  errorMessage:
                    row.status === "printing" ? "Marked failed from print queue" : undefined,
                })
              }
            >
              {row.status === "printing" ? "Fail" : "Cancel"}
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Queued
          </Text>
          <Text size="xl" fw={700}>
            {queuedCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Printing
          </Text>
          <Text size="xl" fw={700}>
            {printingCount}
          </Text>
        </Card>
        <Card withBorder radius="sm">
          <Text size="xs" c="dimmed" tt="uppercase">
            Failed
          </Text>
          <Text size="xl" fw={700} c={failedCount > 0 ? "danger" : undefined}>
            {failedCount}
          </Text>
        </Card>
      </SimpleGrid>

      <DataTable
        columns={columns}
        data={jobs}
        loading={isLoading}
        rowKey={(job) => job.id}
        virtualized="auto"
        tableMaxHeight="62vh"
        emptyIcon={<IconPrinter size={36} />}
        emptyTitle="No print jobs"
        emptyDescription="Direct-dispatch print jobs will appear here."
      />
    </Stack>
  );
}

// ── Printers Tab ────────────────────────────────────────

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
