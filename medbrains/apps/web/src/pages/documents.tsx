import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  JsonInput,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCalendarEvent,
  IconEye,
  IconFileDescription,
  IconFileText,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  DocumentTemplate,
  DocumentOutput,
  DocumentFormReviewSchedule,
  CreateDocumentTemplateRequest,
  UpdateDocumentTemplateRequest,
  CreateReviewScheduleRequest,
  DocumentTemplateCategory,
  DocumentPrintFormat,
  DocumentWatermark,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { DataTable, PageHeader } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";
import { DocumentPreviewModal } from "../components/DocumentPreview/DocumentPreviewModal";

// ── Constants ────────────────────────────────────────────

const TEMPLATE_CATEGORIES: { value: string; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "consultation_summary", label: "Consultation Summary" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "death_certificate", label: "Death Certificate" },
  { value: "consent_form", label: "Consent Form" },
  { value: "lab_report", label: "Lab Report" },
  { value: "radiology_report", label: "Radiology Report" },
  { value: "opd_bill", label: "OPD Bill" },
  { value: "ipd_bill", label: "IPD Bill" },
  { value: "receipt", label: "Receipt" },
  { value: "case_sheet_cover", label: "Case Sheet Cover" },
  { value: "progress_note", label: "Progress Note" },
  { value: "nursing_assessment", label: "Nursing Assessment" },
  { value: "mar_chart", label: "MAR Chart" },
  { value: "vitals_chart", label: "Vitals Chart" },
  { value: "surgical_checklist", label: "Surgical Checklist" },
  { value: "anesthesia_record", label: "Anesthesia Record" },
  { value: "operation_note", label: "Operation Note" },
  { value: "employee_id_card", label: "Employee ID Card" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "patient_card", label: "Patient Card" },
  { value: "wristband", label: "Wristband" },
  { value: "queue_token", label: "Queue Token" },
  { value: "bmw_manifest", label: "BMW Manifest" },
  { value: "pcpndt_form_f", label: "PCPNDT Form F" },
  { value: "mlc_certificate", label: "MLC Certificate" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "transfer_summary", label: "Transfer Summary" },
  { value: "custom", label: "Custom" },
];

const PRINT_FORMATS: { value: string; label: string }[] = [
  { value: "a4_portrait", label: "A4 Portrait" },
  { value: "a4_landscape", label: "A4 Landscape" },
  { value: "a5_portrait", label: "A5 Portrait" },
  { value: "a5_landscape", label: "A5 Landscape" },
  { value: "thermal_80mm", label: "Thermal 80mm" },
  { value: "thermal_58mm", label: "Thermal 58mm" },
  { value: "label_50x25mm", label: "Label 50x25mm" },
  { value: "wristband", label: "Wristband" },
  { value: "custom", label: "Custom" },
];

const WATERMARKS: { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "draft", label: "Draft" },
  { value: "confidential", label: "Confidential" },
  { value: "copy", label: "Copy" },
  { value: "duplicate", label: "Duplicate" },
  { value: "uncontrolled", label: "Uncontrolled" },
  { value: "sample", label: "Sample" },
  { value: "cancelled", label: "Cancelled" },
];

const statusColors: Record<string, string> = {
  draft: "slate",
  generated: "primary",
  printed: "success",
  downloaded: "teal",
  voided: "danger",
  superseded: "orange",
};

const reviewStatusColors: Record<string, string> = {
  pending: "warning",
  reviewed: "success",
  overdue: "danger",
};

// ── Templates Tab ────────────────────────────────────────

function TemplatesTab() {
  const queryClient = useQueryClient();
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const canCreate = useHasPermission(P.DOCUMENTS.TEMPLATES_CREATE);
  const canUpdate = useHasPermission(P.DOCUMENTS.TEMPLATES_UPDATE);
  const canDelete = useHasPermission(P.DOCUMENTS.TEMPLATES_DELETE);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("prescription");
  const [moduleCode, setModuleCode] = useState("");
  const [description, setDescription] = useState("");
  const [printFormat, setPrintFormat] = useState<string>("a4_portrait");
  const [showLogo, setShowLogo] = useState(true);
  const [showHospitalName, setShowHospitalName] = useState(true);
  const [showHospitalAddress, setShowHospitalAddress] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showPrintMetadata, setShowPrintMetadata] = useState(true);
  const [defaultWatermark, setDefaultWatermark] = useState<string>("none");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(10);
  const [marginTop, setMarginTop] = useState(15);
  const [marginBottom, setMarginBottom] = useState(15);
  const [marginLeft, setMarginLeft] = useState(15);
  const [marginRight, setMarginRight] = useState(15);
  const [headerLayout, setHeaderLayout] = useState("");
  const [bodyLayout, setBodyLayout] = useState("");
  const [footerLayout, setFooterLayout] = useState("");
  const [signatureBlocks, setSignatureBlocks] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["document-templates", filterCategory],
    queryFn: () => api.listDocumentTemplates({ category: filterCategory ?? undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentTemplateRequest) => api.createDocumentTemplate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({ title: "Template Created", message: "Document template created", color: "success" });
      closeDrawer();
      resetForm();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create template", color: "danger" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentTemplateRequest }) =>
      api.updateDocumentTemplate(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({ title: "Template Updated", message: "Document template updated", color: "success" });
      closeDrawer();
      resetForm();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to update template", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocumentTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({ title: "Template Deleted", message: "Document template deleted", color: "orange" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.setDefaultTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({ title: "Default Set", message: "Template set as default", color: "success" });
    },
  });

  const resetForm = () => {
    setEditingTemplate(null);
    setCode("");
    setName("");
    setCategory("prescription");
    setModuleCode("");
    setDescription("");
    setPrintFormat("a4_portrait");
    setShowLogo(true);
    setShowHospitalName(true);
    setShowHospitalAddress(true);
    setShowPageNumbers(true);
    setShowQrCode(false);
    setShowPrintMetadata(true);
    setDefaultWatermark("none");
    setFontFamily("Arial");
    setFontSize(10);
    setMarginTop(15);
    setMarginBottom(15);
    setMarginLeft(15);
    setMarginRight(15);
    setHeaderLayout("");
    setBodyLayout("");
    setFooterLayout("");
    setSignatureBlocks("");
  };

  const openCreate = () => {
    resetForm();
    openDrawer();
  };

  const openEdit = (t: DocumentTemplate) => {
    setEditingTemplate(t);
    setCode(t.code);
    setName(t.name);
    setCategory(t.category);
    setModuleCode(t.module_code ?? "");
    setDescription(t.description ?? "");
    setPrintFormat(t.print_format ?? "a4_portrait");
    setShowLogo(t.show_logo ?? true);
    setShowHospitalName(t.show_hospital_name ?? true);
    setShowHospitalAddress(t.show_hospital_address ?? true);
    setShowPageNumbers(t.show_page_numbers ?? true);
    setShowQrCode(t.show_qr_code ?? false);
    setShowPrintMetadata(t.show_print_metadata ?? true);
    setDefaultWatermark(t.default_watermark ?? "none");
    setFontFamily(t.font_family ?? "Arial");
    setFontSize(t.font_size_pt ?? 10);
    setMarginTop(t.margin_top_mm ?? 15);
    setMarginBottom(t.margin_bottom_mm ?? 15);
    setMarginLeft(t.margin_left_mm ?? 15);
    setMarginRight(t.margin_right_mm ?? 15);
    setHeaderLayout(t.header_layout ? JSON.stringify(t.header_layout, null, 2) : "");
    setBodyLayout(t.body_layout ? JSON.stringify(t.body_layout, null, 2) : "");
    setFooterLayout(t.footer_layout ? JSON.stringify(t.footer_layout, null, 2) : "");
    setSignatureBlocks(t.signature_blocks ? JSON.stringify(t.signature_blocks, null, 2) : "");
    openDrawer();
  };

  const parseJson = (s: string): Record<string, unknown> | undefined => {
    if (!s.trim()) return undefined;
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  };

  const handleSubmit = () => {
    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: {
          name,
          category: category as DocumentTemplateCategory,
          module_code: moduleCode || undefined,
          description: description || undefined,
          print_format: printFormat as DocumentPrintFormat,
          show_logo: showLogo,
          show_hospital_name: showHospitalName,
          show_hospital_address: showHospitalAddress,
          show_page_numbers: showPageNumbers,
          show_qr_code: showQrCode,
          show_print_metadata: showPrintMetadata,
          default_watermark: defaultWatermark as DocumentWatermark,
          font_family: fontFamily || undefined,
          font_size_pt: fontSize,
          margin_top_mm: marginTop,
          margin_bottom_mm: marginBottom,
          margin_left_mm: marginLeft,
          margin_right_mm: marginRight,
          header_layout: parseJson(headerLayout),
          body_layout: parseJson(bodyLayout),
          footer_layout: parseJson(footerLayout),
          signature_blocks: parseJson(signatureBlocks),
        },
      });
    } else {
      createMutation.mutate({
        code,
        name,
        category: category as DocumentTemplateCategory,
        module_code: moduleCode || undefined,
        description: description || undefined,
        print_format: printFormat as DocumentPrintFormat,
        show_logo: showLogo,
        show_hospital_name: showHospitalName,
        show_hospital_address: showHospitalAddress,
        show_page_numbers: showPageNumbers,
        show_qr_code: showQrCode,
        show_print_metadata: showPrintMetadata,
        default_watermark: defaultWatermark as DocumentWatermark,
        font_family: fontFamily || undefined,
        font_size_pt: fontSize,
        margin_top_mm: marginTop,
        margin_bottom_mm: marginBottom,
        margin_left_mm: marginLeft,
        margin_right_mm: marginRight,
        header_layout: parseJson(headerLayout),
        body_layout: parseJson(bodyLayout),
        footer_layout: parseJson(footerLayout),
        signature_blocks: parseJson(signatureBlocks),
      });
    }
  };

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.code.toLowerCase().includes(search.toLowerCase()),
  );

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: DocumentTemplate) => (
        <Text size="sm" fw={500}>{row.code}</Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: DocumentTemplate) => (
        <Text size="sm">{row.name}</Text>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: DocumentTemplate) => (
        <Badge size="sm" variant="light">
          {row.category.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "print_format",
      label: "Format",
      render: (row: DocumentTemplate) => (
        <Text size="sm">{row.print_format?.replace(/_/g, " ") ?? "—"}</Text>
      ),
    },
    {
      key: "version",
      label: "Version",
      render: (row: DocumentTemplate) => (
        <Badge size="sm" variant="outline">{row.version}</Badge>
      ),
    },
    {
      key: "is_default",
      label: "Default",
      render: (row: DocumentTemplate) =>
        row.is_default ? (
          <Badge size="sm" color="success" variant="light">Default</Badge>
        ) : (
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={() => setDefaultMutation.mutate(row.id)}
          >
            Set Default
          </Button>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (row: DocumentTemplate) => (
        <Badge
          size="sm"
          color={row.is_active ? "success" : "slate"}
          variant="light"
        >
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DocumentTemplate) => (
        <Group gap={4}>
          {canUpdate && (
            <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(row)} aria-label="Edit">
              <IconPencil size={14} />
            </ActionIcon>
          )}
          {canDelete && (
            <ActionIcon
              variant="subtle"
              size="sm"
              color="danger"
              onClick={() => deleteMutation.mutate(row.id)}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Stack gap="md">
        <Group>
          <TextInput
            placeholder="Search templates..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by category"
            data={TEMPLATE_CATEGORIES}
            value={filterCategory}
            onChange={setFilterCategory}
            clearable
            w={200}
          />
          {canCreate && (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              Create Template
            </Button>
          )}
        </Group>

        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          rowKey={(r) => r.id}
        />
      </Stack>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title={editingTemplate ? "Edit Template" : "Create Template"}
        position="right"
        size="lg"
      >
        <Stack gap="sm">
          {!editingTemplate && (
            <TextInput
              label="Template Code"
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              required
              placeholder="e.g. prescription_opd"
            />
          )}
          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <Group grow>
            <Select
              label="Category"
              data={TEMPLATE_CATEGORIES}
              value={category}
              onChange={(v) => setCategory(v ?? "prescription")}
            />
            <TextInput
              label="Module Code"
              value={moduleCode}
              onChange={(e) => setModuleCode(e.currentTarget.value)}
              placeholder="e.g. opd"
            />
          </Group>
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            rows={2}
          />

          <Text size="sm" fw={600} mt="sm">Print Settings</Text>
          <Group grow>
            <Select
              label="Print Format"
              data={PRINT_FORMATS}
              value={printFormat}
              onChange={(v) => setPrintFormat(v ?? "a4_portrait")}
            />
            <Select
              label="Default Watermark"
              data={WATERMARKS}
              value={defaultWatermark}
              onChange={(v) => setDefaultWatermark(v ?? "none")}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Font Family"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.currentTarget.value)}
            />
            <NumberInput
              label="Font Size (pt)"
              value={fontSize}
              onChange={(v) => setFontSize(typeof v === "number" ? v : 10)}
              min={6}
              max={24}
            />
          </Group>

          <Text size="sm" fw={600} mt="sm">Margins (mm)</Text>
          <Group grow>
            <NumberInput label="Top" value={marginTop} onChange={(v) => setMarginTop(typeof v === "number" ? v : 15)} min={0} max={50} />
            <NumberInput label="Bottom" value={marginBottom} onChange={(v) => setMarginBottom(typeof v === "number" ? v : 15)} min={0} max={50} />
            <NumberInput label="Left" value={marginLeft} onChange={(v) => setMarginLeft(typeof v === "number" ? v : 15)} min={0} max={50} />
            <NumberInput label="Right" value={marginRight} onChange={(v) => setMarginRight(typeof v === "number" ? v : 15)} min={0} max={50} />
          </Group>

          <Text size="sm" fw={600} mt="sm">Branding</Text>
          <Group>
            <Checkbox label="Show Logo" checked={showLogo} onChange={(e) => setShowLogo(e.currentTarget.checked)} />
            <Checkbox label="Hospital Name" checked={showHospitalName} onChange={(e) => setShowHospitalName(e.currentTarget.checked)} />
            <Checkbox label="Address" checked={showHospitalAddress} onChange={(e) => setShowHospitalAddress(e.currentTarget.checked)} />
          </Group>
          <Group>
            <Checkbox label="Page Numbers" checked={showPageNumbers} onChange={(e) => setShowPageNumbers(e.currentTarget.checked)} />
            <Checkbox label="QR Code" checked={showQrCode} onChange={(e) => setShowQrCode(e.currentTarget.checked)} />
            <Checkbox label="Print Metadata" checked={showPrintMetadata} onChange={(e) => setShowPrintMetadata(e.currentTarget.checked)} />
          </Group>

          <Text size="sm" fw={600} mt="sm">Layout (JSON)</Text>
          <JsonInput
            label="Header Layout"
            value={headerLayout}
            onChange={setHeaderLayout}
            formatOnBlur
            autosize
            minRows={2}
            maxRows={6}
          />
          <JsonInput
            label="Body Layout"
            value={bodyLayout}
            onChange={setBodyLayout}
            formatOnBlur
            autosize
            minRows={3}
            maxRows={8}
          />
          <JsonInput
            label="Footer Layout"
            value={footerLayout}
            onChange={setFooterLayout}
            formatOnBlur
            autosize
            minRows={2}
            maxRows={4}
          />
          <JsonInput
            label="Signature Blocks"
            value={signatureBlocks}
            onChange={setSignatureBlocks}
            formatOnBlur
            autosize
            minRows={2}
            maxRows={6}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!name || (!editingTemplate && !code)}
            >
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Generated Documents Tab ──────────────────────────────

function OutputsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const canVoid = useHasPermission(P.DOCUMENTS.VOID);

  const { data: outputs = [], isLoading } = useQuery({
    queryKey: ["document-outputs", filterCategory, filterStatus],
    queryFn: () =>
      api.listDocumentOutputs({
        category: filterCategory ?? undefined,
        status: filterStatus ?? undefined,
      }),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => api.voidDocumentOutput(id, { reason: "Voided by user" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-outputs"] });
      notifications.show({ title: "Document Voided", message: "Document has been voided", color: "orange" });
    },
  });

  const filtered = outputs.filter(
    (o) =>
      !search ||
      o.document_number?.toLowerCase().includes(search.toLowerCase()) ||
      o.title?.toLowerCase().includes(search.toLowerCase()),
  );

  const columns = [
    {
      key: "document_number",
      label: "Doc #",
      render: (row: DocumentOutput) => (
        <Text size="sm" fw={500}>{row.document_number}</Text>
      ),
    },
    {
      key: "title",
      label: "Title",
      render: (row: DocumentOutput) => (
        <Text size="sm">{row.title}</Text>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: DocumentOutput) => (
        <Badge size="sm" variant="light">
          {row.category?.replace(/_/g, " ") ?? "—"}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: DocumentOutput) => (
        <Badge size="sm" color={statusColors[row.status] ?? "slate"} variant="light">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "print_count",
      label: "Prints",
      render: (row: DocumentOutput) => (
        <Group gap={4}>
          <Text size="sm">{row.print_count}</Text>
          {row.watermark && row.watermark !== "none" && (
            <Badge size="xs" color="orange" variant="light">{row.watermark}</Badge>
          )}
        </Group>
      ),
    },
    {
      key: "module_code",
      label: "Module",
      render: (row: DocumentOutput) => (
        <Text size="sm">{row.module_code ?? "—"}</Text>
      ),
    },
    {
      key: "created_at",
      label: "Generated",
      render: (row: DocumentOutput) => (
        <Text size="sm">
          {new Date(row.created_at).toLocaleString()}
        </Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DocumentOutput) => (
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => setPreviewDocId(row.id)}
            aria-label="View details"
          >
            <IconEye size={14} />
          </ActionIcon>
          {canVoid && row.status !== "voided" && (
            <ActionIcon
              variant="subtle"
              size="sm"
              color="danger"
              onClick={() => voidMutation.mutate(row.id)}
              loading={voidMutation.isPending}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Stack gap="md">
        <Group>
          <TextInput
            placeholder="Search documents..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Category"
            data={TEMPLATE_CATEGORIES}
            value={filterCategory}
            onChange={setFilterCategory}
            clearable
            w={180}
          />
          <Select
            placeholder="Status"
            data={[
              { value: "draft", label: "Draft" },
              { value: "generated", label: "Generated" },
              { value: "printed", label: "Printed" },
              { value: "downloaded", label: "Downloaded" },
              { value: "voided", label: "Voided" },
              { value: "superseded", label: "Superseded" },
            ]}
            value={filterStatus}
            onChange={setFilterStatus}
            clearable
            w={150}
          />
        </Group>

        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          rowKey={(r) => r.id}
        />
      </Stack>

      {previewDocId && (
        <DocumentPreviewModal
          opened={!!previewDocId}
          onClose={() => setPreviewDocId(null)}
          documentOutputId={previewDocId}
          title="Document Preview"
        />
      )}
    </>
  );
}

// ── Review Schedule Tab ──────────────────────────────────

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
    queryFn: () => api.listReviewSchedule(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["document-templates-for-select"],
    queryFn: () => api.listDocumentTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateReviewScheduleRequest) => api.createReviewSchedule(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-review-schedule"] });
      notifications.show({ title: "Schedule Created", message: "Review schedule added", color: "success" });
      closeDrawer();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create schedule", color: "danger" });
    },
  });

  const markReviewedMutation = useMutation({
    mutationFn: (id: string) => api.markReviewed(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-review-schedule"] });
      notifications.show({ title: "Reviewed", message: "Schedule marked as reviewed", color: "success" });
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
        <Badge
          size="sm"
          color={reviewStatusColors[row.review_status ?? "pending"] ?? "slate"}
          variant="light"
        >
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
              variant="subtle"
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
            <Button leftSection={<IconPlus size={16} />} onClick={openDrawer}>
              Add Schedule
            </Button>
          )}
        </Group>

        <DataTable
          columns={columns}
          data={schedules}
          loading={isLoading}
          rowKey={(r) => r.id}
        />
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
            <Button variant="subtle" onClick={closeDrawer}>Cancel</Button>
            <Button
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

// ── Print Queue Tab (Phase 2 placeholder) ────────────────

function PrintQueueTab() {
  return (
    <Stack align="center" py="xl">
      <IconPrinter size={48} color="var(--mantine-color-gray-5)" />
      <Text size="lg" fw={500} c="dimmed">
        Print Queue Management
      </Text>
      <Text size="sm" c="dimmed" ta="center" maw={400}>
        Direct printer dispatch and print job queue management will be available
        in Phase 2. Currently, documents are printed via browser print dialog.
      </Text>
    </Stack>
  );
}

// ── Printers Tab (Phase 2 placeholder) ───────────────────

function PrintersTab() {
  return (
    <Stack align="center" py="xl">
      <IconSettings size={48} color="var(--mantine-color-gray-5)" />
      <Text size="lg" fw={500} c="dimmed">
        Printer Configuration
      </Text>
      <Text size="sm" c="dimmed" ta="center" maw={400}>
        Department printer mapping and configuration will be available in Phase 2.
        Configure thermal, laser, and label printers per department.
      </Text>
    </Stack>
  );
}

// ── Main Page ────────────────────────────────────────────

export function DocumentsPage() {
  useRequirePermission(P.DOCUMENTS.TEMPLATES_LIST);

  return (
    <div>
      <PageHeader
        title="Documents & Printing"
        subtitle="Manage document templates, generated outputs, and review schedules"
      />
      <Tabs defaultValue="templates">
        <Tabs.List>
          <Tabs.Tab value="templates" leftSection={<IconFileText size={16} />}>
            Templates
          </Tabs.Tab>
          <Tabs.Tab value="outputs" leftSection={<IconFileDescription size={16} />}>
            Generated Documents
          </Tabs.Tab>
          <Tabs.Tab value="review" leftSection={<IconCalendarEvent size={16} />}>
            Review Schedule
          </Tabs.Tab>
          <Tabs.Tab value="queue" leftSection={<IconPrinter size={16} />}>
            Print Queue
          </Tabs.Tab>
          <Tabs.Tab value="printers" leftSection={<IconSettings size={16} />}>
            Printers
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab />
        </Tabs.Panel>
        <Tabs.Panel value="outputs" pt="md">
          <OutputsTab />
        </Tabs.Panel>
        <Tabs.Panel value="review" pt="md">
          <ReviewScheduleTab />
        </Tabs.Panel>
        <Tabs.Panel value="queue" pt="md">
          <PrintQueueTab />
        </Tabs.Panel>
        <Tabs.Panel value="printers" pt="md">
          <PrintersTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
