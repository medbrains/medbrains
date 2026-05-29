import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Group,
  JsonInput,
  MultiSelect,
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
import { notifications } from "@mantine/notifications";
import {
  type CreatePrinterFormInput,
  createPrinterFormSchema,
  documentPrintFormatValues,
  logicalPrinterProfileValues,
  printCopyModeValues,
  printerConnectionTypeValues,
  printerTypeValues,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateDocumentTemplateRequest,
  CreatePrinterRequest,
  CreateReviewScheduleRequest,
  DocumentFormReviewSchedule,
  DocumentOutput,
  DocumentPrintFormat,
  DocumentTemplate,
  DocumentTemplateCategory,
  DocumentWatermark,
  PrinterConfig,
  PrintJob,
  UpdateDocumentTemplateRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCalendarEvent,
  IconCheck,
  IconEye,
  IconFileDescription,
  IconFileText,
  IconPencil,
  IconPlus,
  IconPrinter,
  IconRoute,
  IconSearch,
  IconSettings,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import { DocumentPreviewModal } from "@/components/DocumentPreview/DocumentPreviewModal";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { documentsService } from "@/services/documents.service";

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

const PRINT_FORMAT_LABELS: Record<(typeof documentPrintFormatValues)[number], string> = {
  a4_portrait: "A4 Portrait",
  a4_landscape: "A4 Landscape",
  a5_portrait: "A5 Portrait",
  a5_landscape: "A5 Landscape",
  thermal_80mm: "Thermal 80mm",
  thermal_58mm: "Thermal 58mm",
  label_50x25mm: "Label 50x25mm",
  wristband: "Wristband",
  custom: "Custom",
};

const PRINTER_TYPE_LABELS: Record<(typeof printerTypeValues)[number], string> = {
  laser: "Laser / Inkjet",
  thermal: "Thermal receipt",
  label: "Label",
  wristband: "Wristband",
  virtual: "Virtual / browser",
};

const CONNECTION_TYPE_LABELS: Record<(typeof printerConnectionTypeValues)[number], string> = {
  network: "Network / IP",
  usb: "USB",
  agent: "Local print agent",
  browser: "Browser dialog",
};

const LOGICAL_PRINTER_PROFILE_LABELS: Record<(typeof logicalPrinterProfileValues)[number], string> =
  {
    "registration-a4": "Registration A4",
    "patient-card": "Patient card",
    "opd-token-thermal": "OPD token thermal",
    "opd-a4": "OPD A4 summary",
    "opd-summary": "OPD visit summary",
    "opd-certificate-a4": "OPD certificate A4",
    "consent-a4": "Consent form A4",
    "ipd-a4": "IPD A4 case sheet",
    "ipd-discharge-a4": "IPD discharge A4",
    "wristband-label": "Wristband label",
    "emergency-a4": "Emergency A4",
    "mlc-secure-printer": "MLC secure printer",
    "camp-token-thermal": "Camp token thermal",
    "camp-a4": "Camp A4",
    "pharmacy-receipt-80mm": "Pharmacy receipt 80mm",
    "pharmacy-drug-label": "Pharmacy drug label",
    "lab-report-a4": "Lab report A4",
    "radiology-report-a4": "Radiology report A4",
    "billing-receipt-80mm": "Billing receipt 80mm",
    "billing-a4": "Billing A4",
    "mrd-a4": "MRD A4",
    "mrd-record-room": "MRD record room",
  };

const PRINT_COPY_MODE_LABELS: Record<(typeof printCopyModeValues)[number], string> = {
  customer: "Customer copy",
  office: "Office copy",
  clinical: "Clinical copy",
  mrd: "MRD copy",
  lab: "Lab copy",
  pharmacy: "Pharmacy copy",
  police: "Police copy",
  duplicate: "Duplicate/reprint",
};

const PRINT_FORMATS = documentPrintFormatValues.map((value) => ({
  value,
  label: PRINT_FORMAT_LABELS[value],
}));

const PRINTER_TYPES = printerTypeValues.map((value) => ({
  value,
  label: PRINTER_TYPE_LABELS[value],
}));

const CONNECTION_TYPES = printerConnectionTypeValues.map((value) => ({
  value,
  label: CONNECTION_TYPE_LABELS[value],
}));

const LOGICAL_PRINTER_PROFILES = logicalPrinterProfileValues.map((value) => ({
  value,
  label: LOGICAL_PRINTER_PROFILE_LABELS[value],
}));

const PRINT_COPY_MODES = printCopyModeValues.map((value) => ({
  value,
  label: PRINT_COPY_MODE_LABELS[value],
}));

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

const printJobStatusColors: Record<PrintJob["status"], string> = {
  queued: "warning",
  printing: "primary",
  completed: "success",
  failed: "danger",
  cancelled: "slate",
};

const DEFAULT_PRINTER_FORM: CreatePrinterFormInput = {
  name: "",
  printer_type: "laser",
  connection_type: "network",
  connection_string: "",
  default_format: "a4_portrait",
  profile_code: "opd-a4",
  copy_modes: ["customer", "office"],
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

function printerCapabilities(form: CreatePrinterFormInput) {
  return {
    copy_modes: form.copy_modes,
    profile_code: form.profile_code,
  };
}

function capabilityString(
  capabilities: Record<string, unknown> | null | undefined,
  key: "copy_modes" | "profile_code",
) {
  const value = capabilities?.[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

function optionLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
) {
  if (!value) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
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
    queryFn: () =>
      documentsService.listDocumentTemplates({ category: filterCategory ?? undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentTemplateRequest) =>
      documentsService.createDocumentTemplate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({
        title: "Template Created",
        message: "Document template created",
        color: "success",
      });
      closeDrawer();
      resetForm();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create template", color: "danger" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentTemplateRequest }) =>
      documentsService.updateDocumentTemplate(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({
        title: "Template Updated",
        message: "Document template updated",
        color: "success",
      });
      closeDrawer();
      resetForm();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to update template", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsService.deleteDocumentTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({
        title: "Template Deleted",
        message: "Document template deleted",
        color: "orange",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => documentsService.setDefaultTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      notifications.show({
        title: "Default Set",
        message: "Template set as default",
        color: "success",
      });
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
        <Text size="sm" fw={500}>
          {row.code}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: DocumentTemplate) => <Text size="sm">{row.name}</Text>,
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
        <Badge size="sm" variant="outline">
          {row.version}
        </Badge>
      ),
    },
    {
      key: "is_default",
      label: "Default",
      render: (row: DocumentTemplate) =>
        row.is_default ? (
          <Badge size="sm" color="success" variant="light">
            Default
          </Badge>
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
        <Badge size="sm" color={row.is_active ? "success" : "slate"} variant="light">
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

        <DataTable columns={columns} data={filtered} loading={isLoading} rowKey={(r) => r.id} />
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

          <Text size="sm" fw={600} mt="sm">
            Print Settings
          </Text>
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

          <Text size="sm" fw={600} mt="sm">
            Margins (mm)
          </Text>
          <Group grow>
            <NumberInput
              label="Top"
              value={marginTop}
              onChange={(v) => setMarginTop(typeof v === "number" ? v : 15)}
              min={0}
              max={50}
            />
            <NumberInput
              label="Bottom"
              value={marginBottom}
              onChange={(v) => setMarginBottom(typeof v === "number" ? v : 15)}
              min={0}
              max={50}
            />
            <NumberInput
              label="Left"
              value={marginLeft}
              onChange={(v) => setMarginLeft(typeof v === "number" ? v : 15)}
              min={0}
              max={50}
            />
            <NumberInput
              label="Right"
              value={marginRight}
              onChange={(v) => setMarginRight(typeof v === "number" ? v : 15)}
              min={0}
              max={50}
            />
          </Group>

          <Text size="sm" fw={600} mt="sm">
            Branding
          </Text>
          <Group>
            <Checkbox
              label="Show Logo"
              checked={showLogo}
              onChange={(e) => setShowLogo(e.currentTarget.checked)}
            />
            <Checkbox
              label="Hospital Name"
              checked={showHospitalName}
              onChange={(e) => setShowHospitalName(e.currentTarget.checked)}
            />
            <Checkbox
              label="Address"
              checked={showHospitalAddress}
              onChange={(e) => setShowHospitalAddress(e.currentTarget.checked)}
            />
          </Group>
          <Group>
            <Checkbox
              label="Page Numbers"
              checked={showPageNumbers}
              onChange={(e) => setShowPageNumbers(e.currentTarget.checked)}
            />
            <Checkbox
              label="QR Code"
              checked={showQrCode}
              onChange={(e) => setShowQrCode(e.currentTarget.checked)}
            />
            <Checkbox
              label="Print Metadata"
              checked={showPrintMetadata}
              onChange={(e) => setShowPrintMetadata(e.currentTarget.checked)}
            />
          </Group>

          <Text size="sm" fw={600} mt="sm">
            Layout (JSON)
          </Text>
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
      documentsService.listDocumentOutputs({
        category: filterCategory ?? undefined,
        status: filterStatus ?? undefined,
      }),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) =>
      documentsService.voidDocumentOutput(id, { reason: "Voided by user" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-outputs"] });
      notifications.show({
        title: "Document Voided",
        message: "Document has been voided",
        color: "orange",
      });
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
        <Text size="sm" fw={500}>
          {row.document_number}
        </Text>
      ),
    },
    {
      key: "title",
      label: "Title",
      render: (row: DocumentOutput) => <Text size="sm">{row.title}</Text>,
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
            <Badge size="xs" color="orange" variant="light">
              {row.watermark}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "module_code",
      label: "Module",
      render: (row: DocumentOutput) => <Text size="sm">{row.module_code ?? "—"}</Text>,
    },
    {
      key: "created_at",
      label: "Generated",
      render: (row: DocumentOutput) => (
        <Text size="sm">{new Date(row.created_at).toLocaleString()}</Text>
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

        <DataTable columns={columns} data={filtered} loading={isLoading} rowKey={(r) => r.id} />
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
      notifications.show({
        title: "Schedule Created",
        message: "Review schedule added",
        color: "success",
      });
      closeDrawer();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create schedule", color: "danger" });
    },
  });

  const markReviewedMutation = useMutation({
    mutationFn: (id: string) => documentsService.markReviewed(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-review-schedule"] });
      notifications.show({
        title: "Reviewed",
        message: "Schedule marked as reviewed",
        color: "success",
      });
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
            <Button variant="subtle" onClick={closeDrawer}>
              Cancel
            </Button>
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
            <Badge variant="light">{row.module}</Badge>
            <Badge color="gray" variant="light">
              {row.trigger}
            </Badge>
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
            <Badge key={copy} color={copy === "customer" || copy === "office" ? "violet" : "teal"}>
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
            <Badge
              key={profile}
              color={activeProfiles.has(profile) ? "blue" : "orange"}
              variant="light"
            >
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
            <Badge color={readiness.color} variant="light">
              {readiness.label}
            </Badge>
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
      notifications.show({
        title: "Print job updated",
        message: "Print job status changed",
        color: "success",
      });
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
        <Badge color={printJobStatusColors[row.status]} variant="light">
          {row.status}
        </Badge>
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
              size="xs"
              variant="subtle"
              leftSection={<IconPrinter size={14} />}
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: row.id, status: "printing" })}
            >
              Start
            </Button>
          )}
          {canManage && row.status === "printing" && (
            <Button
              size="xs"
              variant="subtle"
              color="success"
              leftSection={<IconCheck size={14} />}
              loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ id: row.id, status: "completed" })}
            >
              Complete
            </Button>
          )}
          {canManage && (row.status === "queued" || row.status === "printing") && (
            <Button
              size="xs"
              variant="subtle"
              color="danger"
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

function PrintersTab() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.DOCUMENTS.PRINTERS_MANAGE);
  const [drawerOpened, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);

  const { data: printers = [], isLoading } = useQuery({
    queryKey: ["printers"],
    queryFn: () => documentsService.listPrinters(),
  });

  const {
    control,
    handleSubmit,
    register,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreatePrinterFormInput>({
    defaultValues: DEFAULT_PRINTER_FORM,
    resolver: zodResolver(createPrinterFormSchema),
  });

  const selectedProfile = watch("profile_code");
  const selectedCopyModes = watch("copy_modes");
  const directPrinterCount = printers.filter(
    (printer) => printer.connection_type !== "browser",
  ).length;
  const mappedCopyModeCount = new Set(
    printers.flatMap((printer) => capabilityString(printer.capabilities, "copy_modes")),
  ).size;

  const createMutation = useMutation({
    mutationFn: (payload: CreatePrinterRequest) => documentsService.createPrinter(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["printers"] });
      notifications.show({
        title: "Printer created",
        message: "Printer profile is ready for document routing",
        color: "success",
      });
      reset(DEFAULT_PRINTER_FORM);
      closeDrawer();
    },
  });

  const openCreateDrawer = () => {
    reset(DEFAULT_PRINTER_FORM);
    openDrawer();
  };

  const onSubmit = handleSubmit((values) => {
    const payload: CreatePrinterRequest = {
      name: values.name.trim(),
      printer_type: values.printer_type,
      connection_type: values.connection_type,
      connection_string: values.connection_string.trim() || undefined,
      default_format: values.default_format,
      capabilities: printerCapabilities(values),
    };
    createMutation.mutate(payload);
  });

  const columns = [
    {
      key: "name",
      label: "Printer",
      render: (row: PrinterConfig) => (
        <Stack gap={4}>
          <Group gap="xs">
            <Text size="sm" fw={600}>
              {row.name}
            </Text>
            <Badge color={row.is_active ? "success" : "slate"} variant="light">
              {row.is_active ? "Active" : "Inactive"}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {optionLabel(PRINTER_TYPES, row.printer_type)}
          </Text>
        </Stack>
      ),
    },
    {
      key: "profile",
      label: "Profile",
      render: (row: PrinterConfig) => {
        const profile = capabilityString(row.capabilities, "profile_code")[0];
        return <Text size="sm">{optionLabel(LOGICAL_PRINTER_PROFILES, profile)}</Text>;
      },
    },
    {
      key: "copy_modes",
      label: "Copy Routing",
      render: (row: PrinterConfig) => {
        const copyModes = capabilityString(row.capabilities, "copy_modes");
        if (copyModes.length === 0) return <Text size="sm">—</Text>;
        return (
          <Group gap={4}>
            {copyModes.map((mode) => (
              <Badge key={mode} variant="light" color="teal">
                {optionLabel(PRINT_COPY_MODES, mode)}
              </Badge>
            ))}
          </Group>
        );
      },
    },
    {
      key: "connection",
      label: "Connection",
      render: (row: PrinterConfig) => (
        <Stack gap={2}>
          <Text size="sm">{optionLabel(CONNECTION_TYPES, row.connection_type)}</Text>
          <Text size="xs" c="dimmed">
            {row.connection_string ?? "Browser/default dialog"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "default_format",
      label: "Format",
      render: (row: PrinterConfig) => (
        <Text size="sm">{optionLabel(PRINT_FORMATS, row.default_format)}</Text>
      ),
    },
  ];

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <SimpleGrid cols={{ base: 1, sm: 3 }} style={{ flex: 1 }}>
            <Card withBorder radius="sm">
              <Text size="xs" c="dimmed" tt="uppercase">
                Profiles
              </Text>
              <Text size="xl" fw={700}>
                {printers.length}
              </Text>
            </Card>
            <Card withBorder radius="sm">
              <Text size="xs" c="dimmed" tt="uppercase">
                Direct Printers
              </Text>
              <Text size="xl" fw={700}>
                {directPrinterCount}
              </Text>
            </Card>
            <Card withBorder radius="sm">
              <Text size="xs" c="dimmed" tt="uppercase">
                Copy Types
              </Text>
              <Text size="xl" fw={700}>
                {mappedCopyModeCount}
              </Text>
            </Card>
          </SimpleGrid>
          {canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateDrawer}>
              Add Printer
            </Button>
          )}
        </Group>

        <DataTable
          columns={columns}
          data={printers}
          loading={isLoading}
          rowKey={(printer) => printer.id}
          virtualized="auto"
          tableMaxHeight="62vh"
          emptyIcon={<IconSettings size={36} />}
          emptyTitle="No printer profiles"
          emptyDescription="Add printer profiles for customer, office, clinical, MRD, and department copies."
        />
      </Stack>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        title="Add Printer Profile"
        position="right"
        size="lg"
      >
        <Stack component="form" gap="sm" onSubmit={onSubmit}>
          <TextInput
            label="Printer name"
            required
            {...register("name")}
            error={errors.name?.message}
          />
          <Controller
            name="printer_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Printer type"
                data={PRINTER_TYPES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.printer_type)}
                error={errors.printer_type?.message}
                required
              />
            )}
          />
          <Controller
            name="connection_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Connection"
                data={CONNECTION_TYPES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.connection_type)}
                error={errors.connection_type?.message}
                required
              />
            )}
          />
          <TextInput
            label="Connection string"
            placeholder="10.10.12.25:9100"
            {...register("connection_string")}
            error={errors.connection_string?.message}
          />
          <Controller
            name="default_format"
            control={control}
            render={({ field }) => (
              <Select
                label="Default print format"
                data={PRINT_FORMATS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.default_format)}
                error={errors.default_format?.message}
                required
              />
            )}
          />
          <Controller
            name="profile_code"
            control={control}
            render={({ field }) => (
              <Select
                label="Logical profile"
                data={LOGICAL_PRINTER_PROFILES}
                value={field.value}
                onChange={(value) => field.onChange(value ?? DEFAULT_PRINTER_FORM.profile_code)}
                error={errors.profile_code?.message}
                searchable
                required
              />
            )}
          />
          <Controller
            name="copy_modes"
            control={control}
            render={({ field }) => (
              <MultiSelect
                label="Copy routing"
                data={PRINT_COPY_MODES}
                value={field.value}
                onChange={field.onChange}
                error={errors.copy_modes?.message}
                required
              />
            )}
          />
          <Card withBorder radius="sm">
            <Stack gap="xs">
              <Group gap="xs">
                <Badge variant="light">
                  {optionLabel(LOGICAL_PRINTER_PROFILES, selectedProfile)}
                </Badge>
                {selectedCopyModes.map((mode) => (
                  <Badge key={mode} color="teal" variant="light">
                    {optionLabel(PRINT_COPY_MODES, mode)}
                  </Badge>
                ))}
              </Group>
            </Stack>
          </Card>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={closeDrawer} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────

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
