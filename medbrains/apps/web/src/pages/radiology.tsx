import { zodResolver } from "@hookform/resolvers/zod";
import {
  Checkbox,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { RadiologyAppointmentFormInput, RadiologyOrderFormInput } from "@medbrains/schemas";
import { radiologyAppointmentFormSchema, radiologyOrderFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateRadiologyAppointmentRequest,
  CreateRadiologyOrderRequest,
  RadiationDoseRecord,
  RadiologyDicomStudy,
  RadiologyModality,
  RadiologyOrder,
  RadiologyReportPrintData,
  RadiologyTatRow,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendar,
  IconChartBar,
  IconEye,
  IconPlus,
  IconPrinter,
  IconRadar,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ClinicalEventProvider,
  DataTable,
  PageHeader,
  StatusDot,
  useClinicalEmit,
} from "@/components";
import { EncounterSelect } from "@/components/EncounterSelect";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, Table } from "@/components/ui";
import { radiologyOptionalText, radiologyPriorityOptions } from "@/forms/radiology.form";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";
import { statusColor } from "@/lib/status-colors";
import { radiologyService } from "@/services/radiology.service";
import { buildCopyPrintHtml, copyPrintStyles, PRINT_COPY_PACKETS } from "@/utils/printCopies";

const statusColors: Record<string, string> = {
  ordered: "primary",
  scheduled: "info",
  in_progress: "warning",
  completed: "orange",
  reported: "teal",
  verified: "success",
  cancelled: "danger",
};

function colorToBadgeTone(color: string | null | undefined): BadgeTone {
  switch (color) {
    case "primary":
      return "primary";
    case "info":
    case "blue":
      return "info";
    case "warning":
    case "orange":
    case "yellow":
      return "warning";
    case "teal":
    case "green":
    case "success":
      return "success";
    case "danger":
    case "red":
      return "danger";
    case "violet":
    case "grape":
    case "rose":
    case "cinnabar":
      return "accent";
    default:
      return "neutral";
  }
}

const RADIOLOGY_REPORT_PRINT_COPIES = PRINT_COPY_PACKETS.radiologyReport;

function escapeRadiologyPrintText(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function radiologyPrintValue(value: string | null | undefined, fallback = "-") {
  return escapeRadiologyPrintText(value?.trim() || fallback);
}

function buildRadiologyReportContent(data: RadiologyReportPrintData) {
  return `
    <section class="radiology-report-print">
      <header class="report-header">
        <div>
          <h1>Radiology Report</h1>
          <div class="report-subtitle">${radiologyPrintValue(data.modality)} ${radiologyPrintValue(data.body_part)}</div>
        </div>
        <div class="report-date">${radiologyPrintValue(data.date)}</div>
      </header>

      <dl class="report-grid">
        <dt>Patient</dt><dd>${radiologyPrintValue(data.patient_name)} (${radiologyPrintValue(data.uhid)})</dd>
        <dt>Age / Gender</dt><dd>${radiologyPrintValue(data.age)} / ${radiologyPrintValue(data.gender)}</dd>
        <dt>Modality</dt><dd>${radiologyPrintValue(data.modality)}</dd>
        <dt>Body part</dt><dd>${radiologyPrintValue(data.body_part)}</dd>
        <dt>Indication</dt><dd class="span-all">${radiologyPrintValue(data.clinical_indication)}</dd>
      </dl>

      <section class="report-section">
        <h2>Findings</h2>
        <p>${radiologyPrintValue(data.findings)}</p>
      </section>
      <section class="report-section">
        <h2>Impression</h2>
        <p>${radiologyPrintValue(data.impression)}</p>
      </section>
      <section class="report-section">
        <h2>Recommendations</h2>
        <p>${radiologyPrintValue(data.recommendations)}</p>
      </section>

      <footer class="report-footer">
        <div>Reported by: ${radiologyPrintValue(data.reported_by)}</div>
        <div>Verified by: ${radiologyPrintValue(data.verified_by)}</div>
        <div>Generated: ${escapeRadiologyPrintText(new Date().toLocaleString("en-IN"))}</div>
      </footer>
    </section>
  `;
}

function writeRadiologyReportPrintPacket(win: Window, data: RadiologyReportPrintData) {
  const content = buildRadiologyReportContent(data);
  win.document.open();
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Radiology Report ${radiologyPrintValue(data.uhid)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 18px; color: #101918; font-size: 12px; }
          .radiology-report-print { border: 1px solid #cfd8dc; padding: 16px; border-radius: 6px; }
          .report-header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; margin-bottom: 12px; }
          h1 { font-size: 18px; margin: 0; }
          h2 { font-size: 13px; margin: 0 0 6px; color: #334155; }
          .report-subtitle { margin-top: 4px; color: #475569; font-weight: 700; }
          .report-date { font-weight: 700; color: #0f6b75; white-space: nowrap; }
          .report-grid { display: grid; grid-template-columns: 130px 1fr 130px 1fr; gap: 7px 12px; margin: 0 0 14px; }
          .report-grid dt { color: #475569; font-weight: 700; }
          .report-grid dd { margin: 0; }
          .span-all { grid-column: span 3; }
          .report-section { border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px; }
          .report-section p { margin: 0; white-space: pre-wrap; line-height: 1.55; }
          .report-footer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; border-top: 1px solid #cbd5e1; margin-top: 18px; padding-top: 10px; color: #475569; }
          ${copyPrintStyles()}
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${buildCopyPrintHtml(content, RADIOLOGY_REPORT_PRINT_COPIES)}
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  win.document.close();
}

async function printRadiologyReportPacket(orderId: string) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) {
    notifications.show({
      title: "Print blocked",
      message: "Allow pop-ups to print the radiology report packet.",
      color: "warning",
    });
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html><head><title>Preparing radiology report</title></head>
    <body style="font-family:Arial,sans-serif;padding:20px;">Preparing radiology report...</body></html>
  `);
  win.document.close();

  try {
    const data = await radiologyService.getRadiologyPrintData(orderId);
    writeRadiologyReportPrintPacket(win, data);
  } catch (error) {
    win.close();
    notifications.show({
      title: "Print failed",
      message:
        error instanceof Error ? error.message : "Unable to load radiology report print data.",
      color: "danger",
    });
  }
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════

export function RadiologyPage() {
  useRequirePermission(P.RADIOLOGY.ORDERS_LIST);

  return (
    <ClinicalEventProvider moduleCode="radiology" contextCode="radiology-orders">
      <Tabs defaultValue="orders">
        <Tabs.List>
          <Tabs.Tab value="orders" leftSection={<IconRadar size={16} />}>
            Orders
          </Tabs.Tab>
          <Tabs.Tab value="modalities">Modalities</Tabs.Tab>
          <Tabs.Tab value="appointments" leftSection={<IconCalendar size={16} />}>
            Appointments
          </Tabs.Tab>
          <Tabs.Tab value="dicom" leftSection={<IconEye size={16} />}>
            DICOM Studies
          </Tabs.Tab>
          <Tabs.Tab value="tat" leftSection={<IconChartBar size={16} />}>
            TAT Analytics
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="orders" pt="md">
          <RadiologyOrdersTab />
        </Tabs.Panel>
        <Tabs.Panel value="modalities" pt="md">
          <ModalitiesTab />
        </Tabs.Panel>
        <Tabs.Panel value="appointments" pt="md">
          <AppointmentsTab />
        </Tabs.Panel>
        <Tabs.Panel value="dicom" pt="md">
          <DicomStudiesTab />
        </Tabs.Panel>
        <Tabs.Panel value="tat" pt="md">
          <TatAnalyticsTab />
        </Tabs.Panel>
      </Tabs>
    </ClinicalEventProvider>
  );
}

// ══════════════════════════════════════════════════════════
//  Orders Tab
// ══════════════════════════════════════════════════════════

function RadiologyOrdersTab() {
  const canCreate = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const canReport = useHasPermission(P.RADIOLOGY.REPORTS_CREATE);
  const canVerify = useHasPermission(P.RADIOLOGY.REPORTS_VERIFY);
  const canCancel = useHasPermission(P.RADIOLOGY.ORDERS_CANCEL);
  const canPrintReports = useHasPermission(P.RADIOLOGY.ORDERS_VIEW);
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [createOpen, createHandlers] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["radiology-orders", params],
    queryFn: () => radiologyService.listRadiologyOrders(params),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      radiologyService.cancelRadiologyOrder(id, { cancellation_reason: "Cancelled by user" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Order cancelled", message: "", color: "danger" });
    },
  });

  const statusTransitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      radiologyService.updateRadiologyOrderStatus(id, status),
    onSuccess: (result, variables) => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      if (variables.status === "completed") {
        emit("radiology.order.completed", {
          body_part: result.body_part,
          encounter_id: result.encounter_id,
          modality_id: result.modality_id,
          order_id: result.id,
          patient_id: result.patient_id,
          priority: result.priority,
        });
      }
    },
  });

  const orders = data?.orders ?? [];
  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  const columns = [
    {
      key: "patient_id" as const,
      label: "Patient",
      render: (o: RadiologyOrder) => <PatientNameCell patientId={o.patient_id} showUhid={false} />,
    },
    {
      key: "priority" as const,
      label: "Priority",
      render: (o: RadiologyOrder) => (
        <Badge size="xs" tone={colorToBadgeTone(statusColor(o.priority))}>
          {o.priority}
        </Badge>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (o: RadiologyOrder) => (
        <StatusDot label={o.status} color={statusColors[o.status] ?? "slate"} />
      ),
    },
    {
      key: "body_part" as const,
      label: "Body Part",
      render: (o: RadiologyOrder) => o.body_part ?? "—",
    },
    {
      key: "flags" as const,
      label: "Flags",
      render: (o: RadiologyOrder) => (
        <Group gap={4}>
          {o.contrast_required && (
            <Badge size="xs" tone="warning">
              Contrast
            </Badge>
          )}
          {o.allergy_flagged && (
            <Badge size="xs" tone="danger">
              Allergy
            </Badge>
          )}
          {o.pregnancy_checked && (
            <Badge size="xs" tone="danger">
              Preg-Chk
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "created_at" as const,
      label: "Date",
      render: (o: RadiologyOrder) => new Date(o.created_at).toLocaleDateString(),
    },
    {
      key: "actions" as const,
      label: "",
      render: (o: RadiologyOrder) => (
        <Group gap={4}>
          <Tooltip label="View">
            <IconButton tone="default" onClick={() => setDetailId(o.id)} aria-label="View details">
              <IconEye size={16} />
            </IconButton>
          </Tooltip>
          {o.status === "ordered" && canCancel && (
            <Tooltip label="Cancel">
              <IconButton
                tone="danger"
                onClick={() =>
                  confirmDestructive({
                    title: "Cancel order",
                    message: "Cancel this order? This cannot be undone.",
                    confirmLabel: "Cancel order",
                    cancelLabel: "Keep",
                    onConfirm: () => cancelMutation.mutate(o.id),
                  })
                }
                aria-label="Close"
              >
                <IconX size={16} />
              </IconButton>
            </Tooltip>
          )}
          {canPrintReports && o.status === "verified" && (
            <Tooltip label="Print report">
              <IconButton
                tone="success"
                onClick={() => {
                  void printRadiologyReportPacket(o.id);
                }}
                aria-label="Print report"
              >
                <IconPrinter size={16} />
              </IconButton>
            </Tooltip>
          )}
          {o.status === "ordered" && (
            <Button
              tone="secondary"
              size="xs"
              onClick={() => statusTransitionMutation.mutate({ id: o.id, status: "in_progress" })}
            >
              Start
            </Button>
          )}
          {o.status === "in_progress" && (
            <Button
              tone="secondary"
              size="xs"
              onClick={() => statusTransitionMutation.mutate({ id: o.id, status: "completed" })}
            >
              Complete
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Radiology Orders"
        subtitle="Imaging order management"
        actions={
          <Group>
            <Select
              placeholder="Filter by status"
              clearable
              size="xs"
              w={160}
              data={[
                "ordered",
                "scheduled",
                "in_progress",
                "completed",
                "reported",
                "verified",
                "cancelled",
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            {canCreate && (
              <Button
                tone="primary"
                leftSection={<IconPlus size={16} />}
                size="xs"
                onClick={createHandlers.open}
              >
                New Order
              </Button>
            )}
          </Group>
        }
      />

      <DataTable
        columns={columns}
        data={orders}
        rowKey={(o) => o.id}
        loading={isLoading}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <CreateOrderDrawer opened={createOpen} onClose={createHandlers.close} />

      {detailId && (
        <OrderDetailDrawer
          id={detailId}
          onClose={() => setDetailId(null)}
          canReport={canReport}
          canVerify={canVerify}
          canPrintReports={canPrintReports}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Create Order Drawer
// ══════════════════════════════════════════════════════════

function CreateOrderDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const { data: modalities } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
  });

  const orderDefaults: RadiologyOrderFormInput = {
    patient_id: "",
    modality_id: "",
    body_part: "",
    clinical_indication: "",
    priority: "routine",
    contrast_required: false,
    pregnancy_checked: false,
    allergy_flagged: false,
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RadiologyOrderFormInput>({
    resolver: zodResolver(radiologyOrderFormSchema),
    defaultValues: orderDefaults,
  });
  const patientId = watch("patient_id");

  const createMutation = useMutation({
    mutationFn: (data: CreateRadiologyOrderRequest) => radiologyService.createRadiologyOrder(data),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Order created", message: "", color: "success" });
      emit("order.created", {
        body_part: result.body_part,
        clinical_indication: result.clinical_indication,
        contrast_required: result.contrast_required,
        encounter_id: result.encounter_id,
        modality_id: result.modality_id,
        order_id: result.id,
        order_type: "radiology",
        patient_id: result.patient_id,
        pregnancy_checked: result.pregnancy_checked,
        priority: result.priority,
      });
      reset(orderDefaults);
      onClose();
    },
  });

  const modalityOptions = (modalities ?? [])
    .filter((m: RadiologyModality) => m.is_active)
    .map((m: RadiologyModality) => ({ value: m.id, label: `${m.code} — ${m.name}` }));

  const handleCreateOrder = (values: RadiologyOrderFormInput) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      modality_id: values.modality_id.trim(),
      body_part: radiologyOptionalText(values.body_part),
      clinical_indication: radiologyOptionalText(values.clinical_indication),
      priority: values.priority,
      notes: radiologyOptionalText(values.notes),
      contrast_required: values.contrast_required,
      pregnancy_checked: values.pregnancy_checked,
      allergy_flagged: values.allergy_flagged,
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="New Radiology Order"
      position="right"
      size="xl"
    >
      <Stack component="form" onSubmit={handleSubmit(handleCreateOrder)}>
        <Controller
          control={control}
          name="patient_id"
          render={({ field }) => (
            <PatientSearchSelect
              value={field.value}
              onChange={field.onChange}
              error={errors.patient_id?.message}
              required
            />
          )}
        />
        <PatientContextBanner patientId={patientId} hideLoadingState />
        <Controller
          control={control}
          name="modality_id"
          render={({ field }) => (
            <Select
              label="Modality"
              required
              data={modalityOptions}
              value={field.value || null}
              onChange={(value) => field.onChange(value ?? "")}
              error={errors.modality_id?.message}
              searchable
            />
          )}
        />
        <TextInput label="Body Part" error={errors.body_part?.message} {...register("body_part")} />
        <Textarea
          label="Clinical Indication"
          error={errors.clinical_indication?.message}
          {...register("clinical_indication")}
        />
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <Select
              label="Priority"
              data={radiologyPriorityOptions}
              value={field.value}
              onChange={(value) => field.onChange(value ?? "routine")}
              error={errors.priority?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="contrast_required"
          render={({ field }) => (
            <Switch
              label="Contrast Required"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              error={errors.contrast_required?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="pregnancy_checked"
          render={({ field }) => (
            <Checkbox
              label="Pregnancy Verified"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              error={errors.pregnancy_checked?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="allergy_flagged"
          render={({ field }) => (
            <Checkbox
              label="Allergy Flagged"
              checked={field.value}
              onChange={(event) => field.onChange(event.currentTarget.checked)}
              error={errors.allergy_flagged?.message}
            />
          )}
        />
        <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
        <Button tone="primary" type="submit" loading={createMutation.isPending}>
          Create Order
        </Button>
      </Stack>
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Order Detail Drawer
// ══════════════════════════════════════════════════════════

function OrderDetailDrawer({
  id,
  onClose,
  canReport,
  canVerify,
  canPrintReports,
}: {
  id: string;
  onClose: () => void;
  canReport: boolean;
  canVerify: boolean;
  canPrintReports: boolean;
}) {
  const qc = useQueryClient();
  const emit = useClinicalEmit();

  const { data } = useQuery({
    queryKey: ["radiology-order", id],
    queryFn: () => radiologyService.getRadiologyOrder(id),
  });

  const [reportTab, setReportTab] = useState<string | null>("details");
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [isCritical, setIsCritical] = useState(false);

  const reportMutation = useMutation({
    mutationFn: () =>
      radiologyService.createRadiologyReport(id, {
        findings,
        impression: impression || undefined,
        recommendations: recommendations || undefined,
        is_critical: isCritical,
        status: "preliminary",
      }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      notifications.show({ title: "Report created", message: "", color: "success" });
      if (order) {
        emit("radiology.report.created", {
          body_part: order.body_part,
          encounter_id: order.encounter_id,
          is_critical: result.is_critical,
          modality_id: order.modality_id,
          order_id: order.id,
          patient_id: order.patient_id,
          report_id: result.id,
          report_status: result.status,
          reported_at: result.created_at,
        });
      }
      setFindings("");
      setImpression("");
      setRecommendations("");
      setIsCritical(false);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (reportId: string) => radiologyService.verifyRadiologyReport(reportId),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      void qc.invalidateQueries({ queryKey: ["radiology-orders"] });
      if (order) {
        emit("radiology.report.verified", {
          body_part: order.body_part,
          encounter_id: order.encounter_id,
          modality_id: order.modality_id,
          order_id: order.id,
          patient_id: order.patient_id,
          report_id: result.id,
          report_status: result.status,
          verified_at: result.verified_at,
        });
      }
      notifications.show({ title: "Report verified", message: "", color: "success" });
    },
  });

  const order = data?.order;
  const report = data?.report;
  const doseRecords = data?.dose_records ?? [];

  return (
    <Drawer opened onClose={onClose} title="Order Detail" position="right" size="lg">
      {order && (
        <Stack>
          <PatientContextBanner patientId={order.patient_id} hideLoadingState />
          <Group>
            <Text fw={600}>Status:</Text>
            <Badge tone={colorToBadgeTone(statusColors[order.status])}>{order.status}</Badge>
            <Text fw={600}>Priority:</Text>
            <Badge tone={colorToBadgeTone(statusColor(order.priority))}>{order.priority}</Badge>
          </Group>
          {order.body_part && <Text size="sm">Body Part: {order.body_part}</Text>}
          {order.clinical_indication && (
            <Text size="sm">Indication: {order.clinical_indication}</Text>
          )}
          {order.cancellation_reason && (
            <Badge tone="danger">Cancelled: {order.cancellation_reason}</Badge>
          )}

          <Tabs value={reportTab} onChange={setReportTab}>
            <Tabs.List>
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="report">Report</Tabs.Tab>
              <Tabs.Tab value="dose">Dose Tracking</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="details" pt="sm">
              <Stack gap="xs">
                <Group gap={8}>
                  {order.contrast_required && (
                    <Badge size="sm" tone="warning">
                      Contrast Required
                    </Badge>
                  )}
                  {order.pregnancy_checked && (
                    <Badge size="sm" tone="danger">
                      Pregnancy Verified
                    </Badge>
                  )}
                  {order.allergy_flagged && (
                    <Badge size="sm" tone="danger">
                      Allergy Flagged
                    </Badge>
                  )}
                </Group>
                {order.notes && <Text size="sm">Notes: {order.notes}</Text>}
                {order.scheduled_at && (
                  <Text size="sm">Scheduled: {new Date(order.scheduled_at).toLocaleString()}</Text>
                )}
                {order.completed_at && (
                  <Text size="sm">Completed: {new Date(order.completed_at).toLocaleString()}</Text>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="report" pt="sm">
              {report ? (
                <Stack>
                  <Group>
                    <Badge tone={report.status === "final" ? "success" : "warning"}>
                      {report.status}
                    </Badge>
                    {report.is_critical && <Badge tone="danger">CRITICAL</Badge>}
                  </Group>
                  <Text fw={600}>Findings:</Text>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                    {report.findings}
                  </Text>
                  {report.impression && (
                    <>
                      <Text fw={600}>Impression:</Text>
                      <Text size="sm">{report.impression}</Text>
                    </>
                  )}
                  {report.recommendations && (
                    <>
                      <Text fw={600}>Recommendations:</Text>
                      <Text size="sm">{report.recommendations}</Text>
                    </>
                  )}
                  {canVerify && report.status !== "final" && (
                    <Button
                      tone="primary"
                      onClick={() => verifyMutation.mutate(report.id)}
                      loading={verifyMutation.isPending}
                    >
                      Verify & Finalize Report
                    </Button>
                  )}
                  {canPrintReports && order.status === "verified" && (
                    <Button
                      tone="secondary"
                      leftSection={<IconPrinter size={16} />}
                      onClick={() => {
                        void printRadiologyReportPacket(order.id);
                      }}
                    >
                      Print report
                    </Button>
                  )}
                </Stack>
              ) : canReport && ["completed", "in_progress"].includes(order.status) ? (
                <Stack>
                  <Textarea
                    label="Findings"
                    required
                    value={findings}
                    onChange={(e) => setFindings(e.currentTarget.value)}
                    minRows={4}
                  />
                  <Textarea
                    label="Impression"
                    value={impression}
                    onChange={(e) => setImpression(e.currentTarget.value)}
                  />
                  <Textarea
                    label="Recommendations"
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.currentTarget.value)}
                  />
                  <Switch
                    label="Critical Finding"
                    checked={isCritical}
                    onChange={(e) => setIsCritical(e.currentTarget.checked)}
                  />
                  <Button
                    tone="primary"
                    onClick={() => reportMutation.mutate()}
                    loading={reportMutation.isPending}
                    disabled={!findings}
                  >
                    Submit Report
                  </Button>
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">
                  No report available yet.
                </Text>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="dose" pt="sm">
              {doseRecords.length > 0 ? (
                <DataTable
                  columns={[
                    {
                      key: "modality",
                      label: "Modality",
                      render: (d: RadiationDoseRecord) => d.modality_code,
                    },
                    {
                      key: "body_part",
                      label: "Body Part",
                      render: (d: RadiationDoseRecord) => d.body_part ?? "—",
                    },
                    {
                      key: "dose",
                      label: "Dose",
                      render: (d: RadiationDoseRecord) =>
                        d.dose_value ? `${d.dose_value} ${d.dose_unit}` : "—",
                    },
                    {
                      key: "dlp",
                      label: "DLP",
                      render: (d: RadiationDoseRecord) => d.dlp ?? "—",
                    },
                    {
                      key: "ctdi_vol",
                      label: "CTDIvol",
                      render: (d: RadiationDoseRecord) => d.ctdi_vol ?? "—",
                    },
                    {
                      key: "recorded",
                      label: "Recorded",
                      render: (d: RadiationDoseRecord) => new Date(d.recorded_at).toLocaleString(),
                    },
                  ]}
                  data={doseRecords}
                  rowKey={(d) => d.id}
                />
              ) : (
                <Text c="dimmed" size="sm">
                  No dose records.
                </Text>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Drawer>
  );
}

// ══════════════════════════════════════════════════════════
//  Modalities Tab
// ══════════════════════════════════════════════════════════

function ModalitiesTab() {
  const canManage = useHasPermission(P.RADIOLOGY.MODALITIES_MANAGE);
  const qc = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: modalities, isLoading } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      radiologyService.createRadiologyModality({
        code,
        name,
        description: description || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-modalities"] });
      notifications.show({ title: "Modality created", message: "", color: "success" });
      setCode("");
      setName("");
      setDescription("");
      formHandlers.close();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => radiologyService.deleteRadiologyModality(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-modalities"] });
      notifications.show({ title: "Modality deleted", message: "", color: "danger" });
    },
  });

  return (
    <>
      <PageHeader
        title="Imaging Modalities"
        subtitle="Master list of imaging types"
        actions={
          canManage ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={formHandlers.open}
            >
              Add Modality
            </Button>
          ) : undefined
        }
      />

      {formOpened && (
        <Stack
          mb="md"
          p="md"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
        >
          <Group grow>
            <TextInput
              label="Code"
              required
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              placeholder="XRAY"
            />
            <TextInput
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="X-Ray"
            />
          </Group>
          <TextInput
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Group>
            <Button
              tone="primary"
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!code || !name}
            >
              Save
            </Button>
            <Button tone="ghost" onClick={formHandlers.close}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Active</Table.Th>
            {canManage && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed">Loading...</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            (modalities ?? []).map((m: RadiologyModality) => (
              <Table.Tr key={m.id}>
                <Table.Td fw={600}>{m.code}</Table.Td>
                <Table.Td>{m.name}</Table.Td>
                <Table.Td>{m.description ?? "—"}</Table.Td>
                <Table.Td>
                  {m.is_active ? (
                    <Badge tone="success" size="xs">
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="xs">
                      Inactive
                    </Badge>
                  )}
                </Table.Td>
                {canManage && (
                  <Table.Td>
                    <IconButton
                      tone="danger"
                      onClick={() =>
                        confirmDestructive({
                          title: "Delete",
                          message: "Permanently delete this record? This cannot be undone.",
                          onConfirm: () => deleteMutation.mutate(m.id),
                        })
                      }
                      aria-label="Close"
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Table.Td>
                )}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Appointments Tab
// ══════════════════════════════════════════════════════════

function AppointmentsTab() {
  const canCreate = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["radiology-appointments"],
    queryFn: () => radiologyService.listRadiologyAppointments(),
  });

  const { data: modalities } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
  });

  const appointmentDefaults: RadiologyAppointmentFormInput = {
    patient_id: "",
    modality_id: "",
    encounter_id: "",
    priority: "routine",
    notes: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<RadiologyAppointmentFormInput>({
    resolver: zodResolver(radiologyAppointmentFormSchema),
    defaultValues: appointmentDefaults,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRadiologyAppointmentRequest) =>
      radiologyService.createRadiologyAppointment(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-appointments"] });
      notifications.show({ title: "Appointment created", message: "", color: "success" });
      reset(appointmentDefaults);
      createHandlers.close();
    },
  });

  const modalityOptions = (modalities ?? [])
    .filter((m: RadiologyModality) => m.is_active)
    .map((m: RadiologyModality) => ({ value: m.id, label: `${m.code} — ${m.name}` }));

  const handleCreateAppointment = (values: RadiologyAppointmentFormInput) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      modality_id: values.modality_id.trim(),
      encounter_id: values.encounter_id.trim(),
      priority: values.priority,
      notes: radiologyOptionalText(values.notes),
    });
  };

  const columns = [
    {
      key: "patient_id" as const,
      label: "Patient",
      render: (r: Record<string, unknown>) => (
        <PatientNameCell
          patientId={typeof r.patient_id === "string" ? r.patient_id : null}
          showUhid={false}
        />
      ),
    },
    {
      key: "modality_id" as const,
      label: "Modality",
      render: (r: Record<string, unknown>) => {
        const mod = (modalities ?? []).find((m: RadiologyModality) => m.id === r.modality_id);
        return mod ? `${mod.code} — ${mod.name}` : String(r.modality_id ?? "---");
      },
    },
    {
      key: "encounter_id" as const,
      label: "Encounter",
      render: (r: Record<string, unknown>) => String(r.encounter_id ?? "---").slice(0, 8),
    },
    {
      key: "priority" as const,
      label: "Priority",
      render: (r: Record<string, unknown>) => {
        const p = String(r.priority ?? "routine");
        return (
          <Badge size="xs" tone={colorToBadgeTone(statusColor(p))}>
            {p}
          </Badge>
        );
      },
    },
    {
      key: "notes" as const,
      label: "Notes",
      render: (r: Record<string, unknown>) => String(r.notes ?? "---"),
    },
    {
      key: "created_at" as const,
      label: "Created",
      render: (r: Record<string, unknown>) =>
        r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : "---",
    },
  ];

  return (
    <>
      <PageHeader
        title="Radiology Appointments"
        subtitle="Scheduled imaging appointments"
        actions={
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={createHandlers.open}
            >
              Create Appointment
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={appointments}
        rowKey={(r) => String(r.id ?? Math.random())}
        loading={isLoading}
      />

      <Modal
        opened={createOpen}
        onClose={createHandlers.close}
        title="Create Radiology Appointment"
        size="md"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateAppointment)}>
          <Controller
            control={control}
            name="patient_id"
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                error={errors.patient_id?.message}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="modality_id"
            render={({ field }) => (
              <Select
                label="Modality"
                required
                data={modalityOptions}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.modality_id?.message}
                searchable
              />
            )}
          />
          <Controller
            control={control}
            name="encounter_id"
            render={({ field }) => (
              <EncounterSelect
                label="Encounter"
                required
                value={field.value}
                onChange={field.onChange}
                error={errors.encounter_id?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select
                label="Priority"
                data={radiologyPriorityOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine")}
                error={errors.priority?.message}
              />
            )}
          />
          <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
          <Button tone="primary" type="submit" loading={createMutation.isPending}>
            Create Appointment
          </Button>
        </Stack>
      </Modal>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  DICOM Studies Tab
// ══════════════════════════════════════════════════════════

function DicomStudiesTab() {
  const [patientId, setPatientId] = useState("");

  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["radiology-dicom-studies", patientId],
    queryFn: () =>
      radiologyService.listRadiologyDicomStudies(patientId ? { patient_id: patientId } : undefined),
  });

  const columns = [
    {
      key: "patient_id" as const,
      label: "Patient",
      render: (study: RadiologyDicomStudy) =>
        study.patient_id ? <PatientNameCell patientId={study.patient_id} showUhid={false} /> : "—",
    },
    {
      key: "modality" as const,
      label: "Modality",
      render: (study: RadiologyDicomStudy) => (
        <Badge size="xs" tone="neutral">
          {study.modality}
        </Badge>
      ),
    },
    {
      key: "study_description" as const,
      label: "Study",
      render: (study: RadiologyDicomStudy) => (
        <div>
          <Text size="sm" fw={500}>
            {study.study_description ?? "DICOM Study"}
          </Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {study.study_instance_uid}
          </Text>
        </div>
      ),
    },
    {
      key: "instance_count" as const,
      label: "Instances",
      render: (study: RadiologyDicomStudy) =>
        `${study.series_count} series / ${study.instance_count} images`,
    },
    {
      key: "study_date" as const,
      label: "Date",
      render: (study: RadiologyDicomStudy) =>
        study.study_date ? new Date(study.study_date).toLocaleDateString() : "—",
    },
    {
      key: "viewer_url" as const,
      label: "Links",
      render: (study: RadiologyDicomStudy) =>
        study.viewer_url || study.pacs_url ? (
          <Group gap="xs" wrap="nowrap">
            {study.viewer_url ? (
              <Button
                tone="secondary"
                component="a"
                href={study.viewer_url}
                target="_blank"
                rel="noreferrer"
                size="xs"
                leftSection={<IconEye size={14} />}
              >
                Viewer
              </Button>
            ) : null}
            {study.pacs_url ? (
              <Button
                tone="ghost"
                component="a"
                href={study.pacs_url}
                target="_blank"
                rel="noreferrer"
                size="xs"
              >
                DICOM
              </Button>
            ) : null}
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            Not linked
          </Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="DICOM Studies"
        subtitle="PACS-linked studies, viewer URLs, and prior imaging"
        actions={
          <Group align="end">
            <PatientSearchSelect
              value={patientId}
              onChange={setPatientId}
              label="Filter by patient"
              placeholder="Search patient..."
              size="xs"
            />
          </Group>
        }
      />

      <DataTable
        columns={columns}
        data={studies}
        rowKey={(study) => study.id}
        loading={isLoading}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  TAT Analytics Tab
// ══════════════════════════════════════════════════════════

function TatAnalyticsTab() {
  const { data: tatData = [], isLoading } = useQuery({
    queryKey: ["radiology-tat"],
    queryFn: () => radiologyService.getRadiologyTat(),
  });

  const columns = [
    {
      key: "modality_name" as const,
      label: "Modality",
      render: (r: RadiologyTatRow) => <Text fw={600}>{r.modality_name}</Text>,
    },
    {
      key: "total_orders" as const,
      label: "Total Orders",
      render: (r: RadiologyTatRow) => String(r.total_orders),
    },
    {
      key: "completed_count" as const,
      label: "Total Completed",
      render: (r: RadiologyTatRow) => String(r.completed_count),
    },
    {
      key: "avg_tat_hours" as const,
      label: "Avg TAT (hours)",
      render: (r: RadiologyTatRow) =>
        r.avg_tat_hours !== null ? (
          <Badge
            tone={r.avg_tat_hours <= 24 ? "success" : r.avg_tat_hours <= 48 ? "warning" : "danger"}
          >
            {r.avg_tat_hours.toFixed(1)}h
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Turnaround Time Analytics"
        subtitle="Average turnaround times by modality"
      />
      <DataTable
        columns={columns}
        data={tatData}
        rowKey={(r) => r.modality_name}
        loading={isLoading}
      />
    </>
  );
}
