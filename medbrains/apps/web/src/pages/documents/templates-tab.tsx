// IPD TemplatesTab — split from documents.tsx (pure move).

import {
  Checkbox,
  Drawer,
  Group,
  JsonInput,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateDocumentTemplateRequest,
  DocumentPrintFormat,
  DocumentTemplate,
  DocumentTemplateCategory,
  DocumentWatermark,
  UpdateDocumentTemplateRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { documentsService } from "@/services/documents.service";
import { PRINT_FORMATS, TEMPLATE_CATEGORIES } from "./shared";

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

export function TemplatesTab() {
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
      toast.success("Document template created", { title: "Template Created" });
      closeDrawer();
      resetForm();
    },
    onError: () => {
      toast.error("Failed to create template", { title: "Error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentTemplateRequest }) =>
      documentsService.updateDocumentTemplate(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Document template updated", { title: "Template Updated" });
      closeDrawer();
      resetForm();
    },
    onError: () => {
      toast.error("Failed to update template", { title: "Error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsService.deleteDocumentTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.warning("Document template deleted", { title: "Template Deleted" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => documentsService.setDefaultTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Template set as default", { title: "Default Set" });
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
      render: (row: DocumentTemplate) => <Badge size="sm">{row.category.replace(/_/g, " ")}</Badge>,
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
          <Badge size="sm" tone="success">
            Default
          </Badge>
        ) : (
          <Button tone="ghost" size="compact-xs" onClick={() => setDefaultMutation.mutate(row.id)}>
            Set Default
          </Button>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (row: DocumentTemplate) => (
        <Badge size="sm" tone={row.is_active ? "success" : "neutral"}>
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
            <IconButton size="sm" onClick={() => openEdit(row)} aria-label="Edit">
              <IconPencil size={14} />
            </IconButton>
          )}
          {canDelete && (
            <IconButton
              size="sm"
              tone="danger"
              onClick={() =>
                confirmDestructive({
                  title: "Delete document",
                  message: "Permanently delete this document? This cannot be undone.",
                  onConfirm: () => deleteMutation.mutate(row.id),
                })
              }
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </IconButton>
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
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
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
            <Button tone="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button
              tone="primary"
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
