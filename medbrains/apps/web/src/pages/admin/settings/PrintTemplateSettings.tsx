import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
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
import {
  type PrintTemplateLogoPositionFormValue,
  type PrintTemplateSettingsFormInput,
  type PrintTemplateTypeFormValue,
  printTemplateSettingsFormSchema,
  printTemplateTypeFormSchema,
} from "@medbrains/schemas";
import type { TenantSettingsRow } from "@medbrains/types";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

// ── Constants ──────────────────────────────────────────────

const TEMPLATE_TYPES: Array<{ value: PrintTemplateTypeFormValue; label: string }> = [
  { value: "letterhead", label: "Letterhead" },
  { value: "prescription_pad", label: "Prescription Pad" },
  { value: "invoice", label: "Invoice" },
  { value: "lab_report", label: "Lab Report" },
  { value: "discharge_summary", label: "Discharge Summary" },
];

const LOGO_POSITIONS: Array<{ value: PrintTemplateLogoPositionFormValue; label: string }> = [
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

const DEFAULT_FORM: PrintTemplateSettingsFormInput = {
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

// ── Helpers ────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTemplateFromRow(
  rows: TenantSettingsRow[],
  templateType: string,
): PrintTemplateSettingsFormInput {
  const row = rows.find((r) => r.key === templateType);
  if (!isRecord(row?.value)) return { ...DEFAULT_FORM };

  const v = row.value;
  return {
    header_text: typeof v.header_text === "string" ? v.header_text : "",
    footer_text: typeof v.footer_text === "string" ? v.footer_text : "",
    logo_position:
      typeof v.logo_position === "string"
        ? printTemplateSettingsFormSchema.shape.logo_position.catch("left").parse(v.logo_position)
        : "left",
    font_family: typeof v.font_family === "string" ? v.font_family : "Arial, sans-serif",
    font_size: typeof v.font_size === "number" ? v.font_size : 12,
    margin_top: typeof v.margin_top === "number" ? v.margin_top : 20,
    margin_bottom: typeof v.margin_bottom === "number" ? v.margin_bottom : 20,
    margin_left: typeof v.margin_left === "number" ? v.margin_left : 15,
    margin_right: typeof v.margin_right === "number" ? v.margin_right : 15,
    show_logo: typeof v.show_logo === "boolean" ? v.show_logo : true,
    show_hospital_name: typeof v.show_hospital_name === "boolean" ? v.show_hospital_name : true,
    show_hospital_address:
      typeof v.show_hospital_address === "boolean" ? v.show_hospital_address : true,
    show_hospital_phone: typeof v.show_hospital_phone === "boolean" ? v.show_hospital_phone : true,
    show_registration_no:
      typeof v.show_registration_no === "boolean" ? v.show_registration_no : false,
    custom_css: typeof v.custom_css === "string" ? v.custom_css : "",
  };
}

function formToPayload(
  selectedType: PrintTemplateTypeFormValue,
  form: PrintTemplateSettingsFormInput,
) {
  return {
    template_type: selectedType,
    header_text: form.header_text.trim() || undefined,
    footer_text: form.footer_text.trim() || undefined,
    logo_position: form.logo_position,
    font_family: form.font_family,
    font_size: Number(form.font_size),
    margin_top: Number(form.margin_top),
    margin_bottom: Number(form.margin_bottom),
    margin_left: Number(form.margin_left),
    margin_right: Number(form.margin_right),
    show_logo: form.show_logo,
    show_hospital_name: form.show_hospital_name,
    show_hospital_address: form.show_hospital_address,
    show_hospital_phone: form.show_hospital_phone,
    show_registration_no: form.show_registration_no,
    custom_css: form.custom_css.trim() || undefined,
  };
}

// ── Component ──────────────────────────────────────────────

export function PrintTemplateSettings() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<PrintTemplateTypeFormValue>("letterhead");

  const {
    data: templates,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-print-templates"],
    queryFn: () => tenantSettingsService.getPrintTemplates(),
  });
  const formValues = useMemo(
    () => parseTemplateFromRow(templates ?? [], selectedType),
    [templates, selectedType],
  );
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    watch,
  } = useForm<PrintTemplateSettingsFormInput>({
    resolver: zodResolver(printTemplateSettingsFormSchema),
    defaultValues: DEFAULT_FORM,
    values: formValues,
  });

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) =>
      tenantSettingsService.upsertPrintTemplate(payload),
    onSuccess: (_row, payload) => {
      void queryClient.invalidateQueries({ queryKey: ["setup-print-templates"] });
      notifications.show({
        title: "Template saved",
        message: `${TEMPLATE_TYPES.find((t) => t.value === payload.template_type)?.label ?? payload.template_type} template has been updated.`,
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
    setSelectedType(printTemplateTypeFormSchema.catch("letterhead").parse(type));
  };

  const submitTemplate = handleSubmit((form) => {
    mutation.mutate(formToPayload(selectedType, form));
  });
  const preview = watch();

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
            <Text fw={600} size="lg">
              Header & Footer
            </Text>
            <Textarea
              label="Header Text"
              description="Text displayed at the top of printed pages."
              placeholder="Hospital Name / Department / etc."
              minRows={2}
              error={errors.header_text?.message}
              {...register("header_text")}
            />
            <Textarea
              label="Footer Text"
              description="Text displayed at the bottom of printed pages."
              placeholder="Address, phone, disclaimer, etc."
              minRows={2}
              error={errors.footer_text?.message}
              {...register("footer_text")}
            />

            <Divider mt="sm" />

            <Text fw={600} size="lg">
              Typography
            </Text>
            <Group grow>
              <Controller
                control={control}
                name="font_family"
                render={({ field }) => (
                  <Select
                    label="Font Family"
                    data={FONT_FAMILIES}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "Arial, sans-serif")}
                    error={errors.font_family?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="font_size"
                render={({ field }) => (
                  <NumberInput
                    label="Font Size (pt)"
                    min={8}
                    max={24}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.font_size?.message}
                  />
                )}
              />
            </Group>

            <Divider mt="sm" />

            <Text fw={600} size="lg">
              Logo & Branding
            </Text>
            <Controller
              control={control}
              name="logo_position"
              render={({ field }) => (
                <Select
                  label="Logo Position"
                  data={LOGO_POSITIONS}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "left")}
                  error={errors.logo_position?.message}
                  maw={200}
                />
              )}
            />
            <Group gap="xl">
              <Controller
                control={control}
                name="show_logo"
                render={({ field }) => (
                  <Checkbox
                    label="Show logo"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={control}
                name="show_hospital_name"
                render={({ field }) => (
                  <Checkbox
                    label="Show hospital name"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={control}
                name="show_hospital_address"
                render={({ field }) => (
                  <Checkbox
                    label="Show address"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={control}
                name="show_hospital_phone"
                render={({ field }) => (
                  <Checkbox
                    label="Show phone"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Controller
                control={control}
                name="show_registration_no"
                render={({ field }) => (
                  <Checkbox
                    label="Show registration no."
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
            </Group>

            <Divider mt="sm" />

            <Text fw={600} size="lg">
              Margins (mm)
            </Text>
            <Grid gap="sm">
              <Grid.Col span={3}>
                <Controller
                  control={control}
                  name="margin_top"
                  render={({ field }) => (
                    <NumberInput
                      label="Top"
                      min={0}
                      max={50}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.margin_top?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Controller
                  control={control}
                  name="margin_bottom"
                  render={({ field }) => (
                    <NumberInput
                      label="Bottom"
                      min={0}
                      max={50}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.margin_bottom?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Controller
                  control={control}
                  name="margin_left"
                  render={({ field }) => (
                    <NumberInput
                      label="Left"
                      min={0}
                      max={50}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.margin_left?.message}
                    />
                  )}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Controller
                  control={control}
                  name="margin_right"
                  render={({ field }) => (
                    <NumberInput
                      label="Right"
                      min={0}
                      max={50}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.margin_right?.message}
                    />
                  )}
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Custom CSS"
              description="Advanced: additional CSS for this template."
              placeholder="e.g. .header { border-bottom: 1px solid #ccc; }"
              minRows={3}
              error={errors.custom_css?.message}
              {...register("custom_css")}
            />
          </Stack>
        </Grid.Col>

        {/* Right: Preview */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Text fw={600} size="lg" mb="sm">
            Preview
          </Text>
          <Paper
            withBorder
            shadow="xs"
            p={0}
            style={{
              minHeight: 500,
              fontFamily: preview.font_family ?? "Arial, sans-serif",
              fontSize: `${preview.font_size ?? 12}pt`,
              position: "relative",
            }}
          >
            {/* Header */}
            <Box
              p="sm"
              style={{
                borderBottom: "1px solid #dee2e6",
                textAlign:
                  preview.logo_position === "center"
                    ? "center"
                    : preview.logo_position === "right"
                      ? "right"
                      : "left",
              }}
            >
              {preview.show_logo && (
                <Box
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: "#e9ecef",
                    borderRadius: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <Text size="xs" c="dimmed">
                    Logo
                  </Text>
                </Box>
              )}
              {preview.show_hospital_name && (
                <Text fw={700} size="sm">
                  Hospital Name
                </Text>
              )}
              {preview.show_hospital_address && (
                <Text size="xs" c="dimmed">
                  123 Medical Street, City
                </Text>
              )}
              {preview.show_hospital_phone && (
                <Text size="xs" c="dimmed">
                  Phone: +91 12345 67890
                </Text>
              )}
              {preview.show_registration_no && (
                <Text size="xs" c="dimmed">
                  Reg. No: HOSP-12345
                </Text>
              )}
              {preview.header_text && (
                <Text size="xs" mt={4}>
                  {preview.header_text}
                </Text>
              )}
            </Box>

            {/* Body placeholder */}
            <Box
              p="sm"
              style={{
                minHeight: 300,
                paddingTop: `${preview.margin_top ?? 20}px`,
                paddingBottom: `${preview.margin_bottom ?? 20}px`,
                paddingLeft: `${preview.margin_left ?? 15}px`,
                paddingRight: `${preview.margin_right ?? 15}px`,
              }}
            >
              <Text size="xs" c="dimmed" fs="italic">
                [{TEMPLATE_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType}{" "}
                content area]
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
              {preview.footer_text && (
                <Text size="xs" c="dimmed">
                  {preview.footer_text}
                </Text>
              )}
            </Box>
          </Paper>
        </Grid.Col>
      </Grid>

      <Group mt="md">
        <Button
          tone="primary"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={() => void submitTemplate()}
          loading={mutation.isPending}
        >
          Save Template
        </Button>
      </Group>
    </Stack>
  );
}
