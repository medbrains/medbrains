import { useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { TenantSettingsRow, PrintTemplateRequest, PrintTemplateType } from "@medbrains/types";

// ── Constants ──────────────────────────────────────────────

const TEMPLATE_TYPES: { value: PrintTemplateType; label: string }[] = [
  { value: "letterhead", label: "Letterhead" },
  { value: "prescription_pad", label: "Prescription Pad" },
  { value: "invoice", label: "Invoice" },
  { value: "lab_report", label: "Lab Report" },
  { value: "discharge_summary", label: "Discharge Summary" },
];

const LOGO_POSITIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const FONT_FAMILIES = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "'Noto Sans', sans-serif", label: "Noto Sans" },
];

const DEFAULT_FORM: PrintTemplateForm = {
  header_text: "",
  footer_text: "",
  logo_position: "left",
  font_family: "Arial, sans-serif",
  font_size: 12,
  margin_top: 20,
  margin_bottom: 20,
  margin_left: 15,
  margin_right: 15,
  show_logo: true,
  show_hospital_name: true,
  show_hospital_address: true,
  show_hospital_phone: true,
  show_registration_no: false,
  custom_css: "",
};

// ── Types ──────────────────────────────────────────────────

type PrintTemplateForm = Omit<PrintTemplateRequest, "template_type">;

// ── Helpers ────────────────────────────────────────────────

function parseTemplateFromRow(rows: TenantSettingsRow[], templateType: string): PrintTemplateForm {
  const row = rows.find((r) => r.key === templateType);
  if (!row?.value || typeof row.value !== "object") return { ...DEFAULT_FORM };

  const v = row.value as Record<string, unknown>;
  return {
    header_text: typeof v.header_text === "string" ? v.header_text : "",
    footer_text: typeof v.footer_text === "string" ? v.footer_text : "",
    logo_position: typeof v.logo_position === "string" ? v.logo_position : "left",
    font_family: typeof v.font_family === "string" ? v.font_family : "Arial, sans-serif",
    font_size: typeof v.font_size === "number" ? v.font_size : 12,
    margin_top: typeof v.margin_top === "number" ? v.margin_top : 20,
    margin_bottom: typeof v.margin_bottom === "number" ? v.margin_bottom : 20,
    margin_left: typeof v.margin_left === "number" ? v.margin_left : 15,
    margin_right: typeof v.margin_right === "number" ? v.margin_right : 15,
    show_logo: typeof v.show_logo === "boolean" ? v.show_logo : true,
    show_hospital_name: typeof v.show_hospital_name === "boolean" ? v.show_hospital_name : true,
    show_hospital_address: typeof v.show_hospital_address === "boolean" ? v.show_hospital_address : true,
    show_hospital_phone: typeof v.show_hospital_phone === "boolean" ? v.show_hospital_phone : true,
    show_registration_no: typeof v.show_registration_no === "boolean" ? v.show_registration_no : false,
    custom_css: typeof v.custom_css === "string" ? v.custom_css : "",
  };
}

// ── Component ──────────────────────────────────────────────

export function PrintTemplateSettings() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<PrintTemplateType>("letterhead");
  const [form, setForm] = useState<PrintTemplateForm>({ ...DEFAULT_FORM });
  const [loaded, setLoaded] = useState(false);

  const { data: templates, isLoading, isError, error } = useQuery({
    queryKey: ["setup-print-templates"],
    queryFn: () => api.getPrintTemplates(),
    select: (data: TenantSettingsRow[]) => {
      if (!loaded) {
        setForm(parseTemplateFromRow(data, selectedType));
        setLoaded(true);
      }
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: PrintTemplateRequest) => {
      await api.upsertPrintTemplate(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["setup-print-templates"] });
      notifications.show({
        title: "Template saved",
        message: `${TEMPLATE_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType} template has been updated.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Save failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleTypeChange = (type: string | null) => {
    if (!type) return;
    const t = type as PrintTemplateType;
    setSelectedType(t);
    setForm(parseTemplateFromRow(templates ?? [], t));
  };

  const handleSave = () => {
    mutation.mutate({ template_type: selectedType, ...form });
  };

  const updateField = <K extends keyof PrintTemplateForm>(key: K, value: PrintTemplateForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Loading / Error ─────────────────────────────────────

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading print templates...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load print templates: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <Stack gap="lg">
      <Select
        label="Template Type"
        description="Select a template to configure."
        data={TEMPLATE_TYPES}
        value={selectedType}
        onChange={handleTypeChange}
        maw={300}
      />

      <Divider />

      <Grid gap="xl">
        {/* Left: Form Fields */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack gap="md">
            <Text fw={600} size="lg">Header & Footer</Text>
            <Textarea
              label="Header Text"
              description="Text displayed at the top of printed pages."
              placeholder="Hospital Name / Department / etc."
              minRows={2}
              value={form.header_text ?? ""}
              onChange={(e) => updateField("header_text", e.currentTarget.value)}
            />
            <Textarea
              label="Footer Text"
              description="Text displayed at the bottom of printed pages."
              placeholder="Address, phone, disclaimer, etc."
              minRows={2}
              value={form.footer_text ?? ""}
              onChange={(e) => updateField("footer_text", e.currentTarget.value)}
            />

            <Divider mt="sm" />

            <Text fw={600} size="lg">Typography</Text>
            <Group grow>
              <Select
                label="Font Family"
                data={FONT_FAMILIES}
                value={form.font_family ?? "Arial, sans-serif"}
                onChange={(v) => updateField("font_family", v ?? "Arial, sans-serif")}
              />
              <NumberInput
                label="Font Size (pt)"
                min={8}
                max={24}
                value={form.font_size ?? 12}
                onChange={(v) => updateField("font_size", v === "" ? 12 : Number(v))}
              />
            </Group>

            <Divider mt="sm" />

            <Text fw={600} size="lg">Logo & Branding</Text>
            <Select
              label="Logo Position"
              data={LOGO_POSITIONS}
              value={form.logo_position ?? "left"}
              onChange={(v) => updateField("logo_position", v ?? "left")}
              maw={200}
            />
            <Group gap="xl">
              <Checkbox
                label="Show logo"
                checked={form.show_logo ?? true}
                onChange={(e) => updateField("show_logo", e.currentTarget.checked)}
              />
              <Checkbox
                label="Show hospital name"
                checked={form.show_hospital_name ?? true}
                onChange={(e) => updateField("show_hospital_name", e.currentTarget.checked)}
              />
              <Checkbox
                label="Show address"
                checked={form.show_hospital_address ?? true}
                onChange={(e) => updateField("show_hospital_address", e.currentTarget.checked)}
              />
              <Checkbox
                label="Show phone"
                checked={form.show_hospital_phone ?? true}
                onChange={(e) => updateField("show_hospital_phone", e.currentTarget.checked)}
              />
              <Checkbox
                label="Show registration no."
                checked={form.show_registration_no ?? false}
                onChange={(e) => updateField("show_registration_no", e.currentTarget.checked)}
              />
            </Group>

            <Divider mt="sm" />

            <Text fw={600} size="lg">Margins (mm)</Text>
            <Grid gap="sm">
              <Grid.Col span={3}>
                <NumberInput label="Top" min={0} max={50} value={form.margin_top ?? 20} onChange={(v) => updateField("margin_top", v === "" ? 20 : Number(v))} />
              </Grid.Col>
              <Grid.Col span={3}>
                <NumberInput label="Bottom" min={0} max={50} value={form.margin_bottom ?? 20} onChange={(v) => updateField("margin_bottom", v === "" ? 20 : Number(v))} />
              </Grid.Col>
              <Grid.Col span={3}>
                <NumberInput label="Left" min={0} max={50} value={form.margin_left ?? 15} onChange={(v) => updateField("margin_left", v === "" ? 15 : Number(v))} />
              </Grid.Col>
              <Grid.Col span={3}>
                <NumberInput label="Right" min={0} max={50} value={form.margin_right ?? 15} onChange={(v) => updateField("margin_right", v === "" ? 15 : Number(v))} />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Custom CSS"
              description="Advanced: additional CSS for this template."
              placeholder="e.g. .header { border-bottom: 1px solid #ccc; }"
              minRows={3}
              value={form.custom_css ?? ""}
              onChange={(e) => updateField("custom_css", e.currentTarget.value)}
            />
          </Stack>
        </Grid.Col>

        {/* Right: Preview */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Text fw={600} size="lg" mb="sm">Preview</Text>
          <Paper
            withBorder
            shadow="xs"
            p={0}
            style={{
              minHeight: 500,
              fontFamily: form.font_family ?? "Arial, sans-serif",
              fontSize: `${form.font_size ?? 12}pt`,
              position: "relative",
            }}
          >
            {/* Header */}
            <Box
              p="sm"
              style={{
                borderBottom: "1px solid #dee2e6",
                textAlign: form.logo_position === "center" ? "center" : form.logo_position === "right" ? "right" : "left",
              }}
            >
              {form.show_logo && (
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: "#e9ecef",
                    borderRadius: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <Text size="xs" c="dimmed">Logo</Text>
                </Box>
              )}
              {form.show_hospital_name && <Text fw={700} size="sm">Hospital Name</Text>}
              {form.show_hospital_address && <Text size="xs" c="dimmed">123 Medical Street, City</Text>}
              {form.show_hospital_phone && <Text size="xs" c="dimmed">Phone: +91 12345 67890</Text>}
              {form.show_registration_no && <Text size="xs" c="dimmed">Reg. No: HOSP-12345</Text>}
              {form.header_text && <Text size="xs" mt={4}>{form.header_text}</Text>}
            </Box>

            {/* Body placeholder */}
            <Box
              p="sm"
              style={{
                minHeight: 300,
                paddingTop: `${form.margin_top ?? 20}px`,
                paddingBottom: `${form.margin_bottom ?? 20}px`,
                paddingLeft: `${form.margin_left ?? 15}px`,
                paddingRight: `${form.margin_right ?? 15}px`,
              }}
            >
              <Text size="xs" c="dimmed" fs="italic">
                [{TEMPLATE_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType} content area]
              </Text>
            </Box>

            {/* Footer */}
            <Box
              p="sm"
              style={{
                borderTop: "1px solid #dee2e6",
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
              }}
            >
              {form.footer_text && <Text size="xs" c="dimmed">{form.footer_text}</Text>}
            </Box>
          </Paper>
        </Grid.Col>
      </Grid>

      <Group mt="md">
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={mutation.isPending}
        >
          Save Template
        </Button>
      </Group>
    </Stack>
  );
}
