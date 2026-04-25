import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  ColorSwatch,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCopy,
  IconFilter,
  IconSettings,
  IconTrash,
} from "@tabler/icons-react";
import { useDashboardBuilderStore } from "@medbrains/stores";
import { useHasPermission } from "@medbrains/stores";
import type { DataFilterScope, WidgetDataFilters, WidgetType } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@medbrains/api";
import { SectionIcon } from "../DynamicForm/SectionIcon";

// ── Widget type options ──────────────────────────────────

const WIDGET_TYPE_OPTIONS: { value: WidgetType; label: string }[] = [
  { value: "stat_card", label: "Stat Card" },
  { value: "data_table", label: "Data Table" },
  { value: "list", label: "List" },
  { value: "chart", label: "Chart" },
  { value: "quick_actions", label: "Quick Actions" },
  { value: "module_embed", label: "Module Embed" },
  { value: "system_health", label: "System Health" },
  { value: "custom_html", label: "Custom HTML" },
];

// ── Module / Query options ───────────────────────────────

const MODULE_OPTIONS = [
  { value: "patients", label: "Patients" },
  { value: "opd", label: "OPD" },
  { value: "lab", label: "Lab" },
  { value: "billing", label: "Billing" },
  { value: "ipd", label: "IPD" },
  { value: "system", label: "System" },
];

const QUERY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  patients: [
    { value: "count", label: "Patient Count" },
    { value: "today_count", label: "Today's Registrations" },
    { value: "recent_registrations", label: "Recent Registrations" },
  ],
  opd: [
    { value: "queue_count", label: "Queue Count" },
    { value: "today_visits", label: "Today's Visits" },
    { value: "active_tokens", label: "Active Tokens" },
  ],
  lab: [
    { value: "pending_count", label: "Pending Count" },
    { value: "today_completed", label: "Completed Today" },
    { value: "recent_results", label: "Recent Results" },
  ],
  billing: [
    { value: "today_revenue", label: "Today's Revenue" },
    { value: "pending_invoices", label: "Pending Invoices" },
    { value: "revenue_summary", label: "Revenue Summary" },
  ],
  ipd: [
    { value: "occupied_beds", label: "Occupied Beds" },
    { value: "today_admissions", label: "Today's Admissions" },
    { value: "today_discharges", label: "Today's Discharges" },
  ],
  system: [{ value: "health_check", label: "Health Check" }],
};

// ── Color picker palette ─────────────────────────────────

const COLOR_OPTIONS = [
  { value: "primary", label: "Primary", hex: "#228be6" },
  { value: "teal", label: "Teal", hex: "#12b886" },
  { value: "orange", label: "Orange", hex: "#fd7e14" },
  { value: "violet", label: "Violet", hex: "#7950f2" },
  { value: "danger", label: "Red", hex: "#fa5252" },
  { value: "danger", label: "Pink", hex: "#e64980" },
  { value: "success", label: "Green", hex: "#40c057" },
  { value: "info", label: "Cyan", hex: "#15aabf" },
  { value: "warning", label: "Yellow", hex: "#fab005" },
  { value: "primary", label: "Forest", hex: "#1F4332" },
  { value: "violet", label: "Grape", hex: "#be4bdb" },
  { value: "slate", label: "Gray", hex: "#868e96" },
];

// ── Icon picker categories ───────────────────────────────

const ICON_OPTIONS = [
  { value: "users", label: "Users" },
  { value: "stethoscope", label: "Stethoscope" },
  { value: "heart", label: "Heart" },
  { value: "microscope", label: "Microscope" },
  { value: "test-pipe", label: "Test Tube" },
  { value: "pill", label: "Pill" },
  { value: "receipt", label: "Receipt" },
  { value: "bed", label: "Bed" },
  { value: "activity", label: "Activity" },
  { value: "calendar", label: "Calendar" },
  { value: "clock", label: "Clock" },
  { value: "settings", label: "Settings" },
  { value: "shield", label: "Shield" },
  { value: "hospital", label: "Hospital" },
  { value: "ambulance", label: "Ambulance" },
  { value: "droplet", label: "Droplet" },
  { value: "brain", label: "Brain" },
  { value: "lungs", label: "Lungs" },
  { value: "eye", label: "Eye" },
  { value: "currency-rupee", label: "Rupee" },
  { value: "list-check", label: "Checklist" },
  { value: "clipboard", label: "Clipboard" },
  { value: "file-text", label: "Document" },
  { value: "notes", label: "Notes" },
];

// ── Main Component ───────────────────────────────────────

export function WidgetPropertyPanel() {
  const selectedWidgetId = useDashboardBuilderStore((s) => s.selectedWidgetId);
  const widgets = useDashboardBuilderStore((s) => s.widgets);
  const updateWidget = useDashboardBuilderStore((s) => s.updateWidget);
  const removeWidget = useDashboardBuilderStore((s) => s.removeWidget);
  const duplicateWidget = useDashboardBuilderStore((s) => s.duplicateWidget);

  const widget = selectedWidgetId ? widgets[selectedWidgetId] : null;

  if (!widget) {
    return (
      <Stack gap="sm" h="100%" justify="center" align="center" py="xl">
        <ThemeIcon variant="light" color="slate" size={48} radius="xl">
          <IconSettings size={24} />
        </ThemeIcon>
        <Text size="sm" fw={500} c="dimmed">
          No widget selected
        </Text>
        <Text size="xs" c="dimmed" ta="center" maw={200}>
          Click a widget on the canvas to edit its properties
        </Text>
      </Stack>
    );
  }

  const dataSource = widget.data_source;
  const currentModule = dataSource.module ?? "";

  return (
    <ScrollArea h="100%" offsetScrollbars scrollbarSize={4}>
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            {widget.icon && (
              <ThemeIcon
                variant="light"
                color={widget.color ?? "slate"}
                size={24}
                radius="md"
              >
                <SectionIcon icon={widget.icon} size={13} />
              </ThemeIcon>
            )}
            <Text size="sm" fw={700} c="var(--mb-text-primary)">
              Properties
            </Text>
          </Group>
          <Group gap={4}>
            <Tooltip label="Duplicate widget">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => duplicateWidget(widget.clientId)}
                aria-label="Copy"
              >
                <IconCopy size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete widget">
              <ActionIcon
                color="danger"
                variant="subtle"
                size="sm"
                onClick={() => removeWidget(widget.clientId)}
                aria-label="Delete"
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* ── Widget Type ──────────────────────────────── */}
        <SectionDivider label="Widget Type" />

        <Select
          size="xs"
          data={WIDGET_TYPE_OPTIONS}
          value={widget.widget_type}
          onChange={(v) => {
            if (v) updateWidget(widget.clientId, { widget_type: v as WidgetType });
          }}
        />

        {/* ── General ──────────────────────────────────── */}
        <SectionDivider label="General" />

        <TextInput
          label="Title"
          size="xs"
          value={widget.title}
          onChange={(e) =>
            updateWidget(widget.clientId, { title: e.currentTarget.value })
          }
        />

        <TextInput
          label="Subtitle"
          size="xs"
          value={widget.subtitle ?? ""}
          onChange={(e) =>
            updateWidget(widget.clientId, {
              subtitle: e.currentTarget.value || null,
            })
          }
        />

        {/* Icon Picker */}
        <Box>
          <Text size="xs" fw={500} mb={4}>
            Icon
          </Text>
          <IconPicker
            value={widget.icon}
            onChange={(v) => updateWidget(widget.clientId, { icon: v })}
          />
        </Box>

        {/* Color Picker */}
        <Box>
          <Text size="xs" fw={500} mb={4}>
            Color
          </Text>
          <ColorPicker
            value={widget.color}
            onChange={(v) => updateWidget(widget.clientId, { color: v })}
          />
        </Box>

        {/* ── Position & Size ──────────────────────────── */}
        <SectionDivider label="Position & Size" />

        <Group grow>
          <NumberInput
            label="Col (X)"
            size="xs"
            min={0}
            max={11}
            value={widget.position_x}
            onChange={(v) =>
              updateWidget(widget.clientId, { position_x: Number(v) })
            }
          />
          <NumberInput
            label="Row (Y)"
            size="xs"
            min={0}
            value={widget.position_y}
            onChange={(v) =>
              updateWidget(widget.clientId, { position_y: Number(v) })
            }
          />
        </Group>

        <Group grow>
          <NumberInput
            label="Width"
            size="xs"
            min={widget.min_width}
            max={12}
            value={widget.width}
            onChange={(v) =>
              updateWidget(widget.clientId, { width: Number(v) })
            }
          />
          <NumberInput
            label="Height"
            size="xs"
            min={widget.min_height}
            max={8}
            value={widget.height}
            onChange={(v) =>
              updateWidget(widget.clientId, { height: Number(v) })
            }
          />
        </Group>

        {/* ── Data Source ──────────────────────────────── */}
        <SectionDivider label="Data Source" />

        <Select
          label="Source Type"
          size="xs"
          data={[
            { value: "module_query", label: "Module Query" },
            { value: "static", label: "Static" },
          ]}
          value={dataSource.type}
          onChange={(v) =>
            updateWidget(widget.clientId, {
              data_source: {
                ...dataSource,
                type: (v ?? "static") as "module_query" | "static",
              },
            })
          }
        />

        {dataSource.type === "module_query" && (
          <>
            <Select
              label="Module"
              size="xs"
              data={MODULE_OPTIONS}
              value={currentModule}
              onChange={(v) =>
                updateWidget(widget.clientId, {
                  data_source: {
                    ...dataSource,
                    module: v ?? undefined,
                    query: undefined,
                  },
                })
              }
            />
            {currentModule && QUERY_OPTIONS[currentModule] && (
              <Select
                label="Query"
                size="xs"
                data={QUERY_OPTIONS[currentModule]}
                value={dataSource.query ?? ""}
                onChange={(v) =>
                  updateWidget(widget.clientId, {
                    data_source: { ...dataSource, query: v ?? undefined },
                  })
                }
              />
            )}

            {/* Data source preview badge */}
            {currentModule && dataSource.query && (
              <Box
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "var(--mantine-color-primary-0)",
                  border: "1px solid var(--mantine-color-primary-2)",
                }}
              >
                <Text size="xs" fw={500} c="var(--mantine-color-primary-7)">
                  Endpoint Preview
                </Text>
                <Code
                  style={{ fontSize: 10, background: "transparent", padding: 0 }}
                >
                  GET /api/dashboard/widget-data/&#123;id&#125;
                </Code>
                <Text fz={10} c="dimmed" mt={2}>
                  Module: {currentModule} / Query: {dataSource.query}
                </Text>
              </Box>
            )}
          </>
        )}

        {/* ── Data Scope (only for module_query widgets) ── */}
        {dataSource.type === "module_query" && (
          <DataScopeSection
            filters={widget.data_filters ?? {}}
            onChange={(data_filters) =>
              updateWidget(widget.clientId, { data_filters })
            }
          />
        )}

        {/* ── Type-Specific Config ─────────────────────── */}
        <TypeSpecificConfig
          widgetType={widget.widget_type}
          config={widget.config}
          onChange={(config) => updateWidget(widget.clientId, { config })}
        />

        {/* ── Behavior ─────────────────────────────────── */}
        <SectionDivider label="Behavior" />

        <NumberInput
          label="Auto-refresh (seconds)"
          size="xs"
          min={0}
          placeholder="0 = disabled"
          value={widget.refresh_interval ?? 0}
          onChange={(v) =>
            updateWidget(widget.clientId, {
              refresh_interval: Number(v) || null,
            })
          }
        />

        <Switch
          label="Visible"
          size="xs"
          checked={widget.is_visible}
          onChange={(e) =>
            updateWidget(widget.clientId, {
              is_visible: e.currentTarget.checked,
            })
          }
        />

        {/* ── Gating Rules ─────────────────────────────── */}
        <SectionDivider label="Gating Rules" />

        <Box
          style={{
            padding: "8px",
            borderRadius: 6,
            background: "var(--mantine-color-orange-0)",
            border: "1px solid var(--mantine-color-orange-2)",
          }}
        >
          <Text fz={10} c="var(--mantine-color-orange-7)" fw={500}>
            Widget-level permission gate. Users without this permission won't see
            this widget even if the dashboard is visible to them.
          </Text>
        </Box>

        <TextInput
          label="Required Permission"
          size="xs"
          placeholder="e.g., patients.list"
          description="Dot-notation permission code"
          value={widget.permission_code ?? ""}
          onChange={(e) =>
            updateWidget(widget.clientId, {
              permission_code: e.currentTarget.value || null,
            })
          }
        />

        <Box
          style={{
            padding: "8px",
            borderRadius: 6,
            background: "var(--mantine-color-gray-0)",
          }}
        >
          <Text fz={10} c="dimmed">
            Dashboard-level gating (role, department, user) is configured in the
            dashboard metadata panel. Widget-level permission provides an additional
            fine-grained gate within a dashboard.
          </Text>
        </Box>

        <Divider my="xs" />

        <Button
          color="danger"
          variant="light"
          size="xs"
          leftSection={<IconTrash size={14} />}
          onClick={() => removeWidget(widget.clientId)}
          fullWidth
        >
          Delete Widget
        </Button>
      </Stack>
    </ScrollArea>
  );
}

// ── Section Divider ──────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <Divider
      label={
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          {label}
        </Text>
      }
      labelPosition="left"
      my={2}
    />
  );
}

// ── Icon Picker ──────────────────────────────────────────

function IconPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={280}
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened(!opened)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid var(--mantine-color-gray-3)",
            width: "100%",
            minHeight: 30,
          }}
        >
          {value ? (
            <>
              <ThemeIcon variant="light" size={20} radius="md">
                <SectionIcon icon={value} size={12} />
              </ThemeIcon>
              <Text size="xs">{value}</Text>
            </>
          ) : (
            <Text size="xs" c="dimmed">
              Choose icon...
            </Text>
          )}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <SimpleGrid cols={6} spacing={4}>
          {ICON_OPTIONS.map((opt) => (
            <Tooltip key={opt.value} label={opt.label} position="top">
              <UnstyledButton
                onClick={() => {
                  onChange(opt.value);
                  setOpened(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border:
                    value === opt.value
                      ? "2px solid var(--mantine-color-primary-5)"
                      : "1px solid var(--mantine-color-gray-2)",
                  background:
                    value === opt.value
                      ? "var(--mantine-color-primary-0)"
                      : undefined,
                }}
              >
                <SectionIcon icon={opt.value} size={16} />
              </UnstyledButton>
            </Tooltip>
          ))}
        </SimpleGrid>
        {value && (
          <Button
            variant="subtle"
            size="xs"
            fullWidth
            mt="xs"
            onClick={() => {
              onChange(null);
              setOpened(false);
            }}
          >
            Clear icon
          </Button>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

// ── Color Picker ─────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [opened, setOpened] = useState(false);
  const current = COLOR_OPTIONS.find((c) => c.value === value);

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={240}
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened(!opened)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid var(--mantine-color-gray-3)",
            width: "100%",
            minHeight: 30,
          }}
        >
          {current ? (
            <>
              <ColorSwatch color={current.hex} size={16} />
              <Text size="xs">{current.label}</Text>
            </>
          ) : (
            <Text size="xs" c="dimmed">
              Choose color...
            </Text>
          )}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <SimpleGrid cols={4} spacing={4}>
          {COLOR_OPTIONS.map((opt) => (
            <UnstyledButton
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpened(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 6px",
                borderRadius: 6,
                border:
                  value === opt.value
                    ? "2px solid var(--mantine-color-primary-5)"
                    : "1px solid var(--mantine-color-gray-2)",
                background:
                  value === opt.value
                    ? "var(--mantine-color-primary-0)"
                    : undefined,
              }}
            >
              <ColorSwatch color={opt.hex} size={14} />
              <Text fz={10}>{opt.label}</Text>
            </UnstyledButton>
          ))}
        </SimpleGrid>
        {value && (
          <Button
            variant="subtle"
            size="xs"
            fullWidth
            mt="xs"
            onClick={() => {
              onChange(null);
              setOpened(false);
            }}
          >
            Clear color
          </Button>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

// ── Type-Specific Config Sections ────────────────────────

function TypeSpecificConfig({
  widgetType,
  config,
  onChange,
}: {
  widgetType: WidgetType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  switch (widgetType) {
    case "stat_card":
      return <StatCardConfigEditor config={config} onChange={onChange} />;
    case "data_table":
      return <DataTableConfigEditor config={config} onChange={onChange} />;
    case "list":
      return <ListConfigEditor config={config} onChange={onChange} />;
    case "custom_html":
      return <CustomHtmlConfigEditor config={config} onChange={onChange} />;
    case "quick_actions":
      return <QuickActionsConfigInfo />;
    default:
      return null;
  }
}

function StatCardConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  return (
    <>
      <SectionDivider label="Stat Card Config" />
      <Select
        label="Format"
        size="xs"
        data={[
          { value: "number", label: "Number" },
          { value: "currency", label: "Currency (₹)" },
          { value: "percent", label: "Percentage (%)" },
        ]}
        value={(config.format as string) ?? "number"}
        onChange={(v) => onChange({ ...config, format: v })}
      />
      <TextInput
        label="Suffix"
        size="xs"
        placeholder="e.g., patients"
        value={(config.suffix as string) ?? ""}
        onChange={(e) =>
          onChange({ ...config, suffix: e.currentTarget.value || undefined })
        }
      />
    </>
  );
}

function DataTableConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  return (
    <>
      <SectionDivider label="Table Config" />
      <NumberInput
        label="Page Size"
        size="xs"
        min={1}
        max={50}
        value={(config.page_size as number) ?? 5}
        onChange={(v) => onChange({ ...config, page_size: Number(v) })}
      />
      <TextInput
        label="Row Click Path"
        size="xs"
        placeholder="/patients/{id}"
        value={(config.row_click_path as string) ?? ""}
        onChange={(e) =>
          onChange({
            ...config,
            row_click_path: e.currentTarget.value || undefined,
          })
        }
      />
    </>
  );
}

function ListConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  return (
    <>
      <SectionDivider label="List Config" />
      <NumberInput
        label="Max Items"
        size="xs"
        min={1}
        max={20}
        value={(config.max_items as number) ?? 5}
        onChange={(v) => onChange({ ...config, max_items: Number(v) })}
      />
      <Switch
        label="Show timestamps"
        size="xs"
        checked={(config.show_timestamp as boolean) ?? false}
        onChange={(e) =>
          onChange({ ...config, show_timestamp: e.currentTarget.checked })
        }
      />
      <Switch
        label="Show icons"
        size="xs"
        checked={(config.show_icon as boolean) ?? false}
        onChange={(e) =>
          onChange({ ...config, show_icon: e.currentTarget.checked })
        }
      />
      <TextInput
        label="Empty Message"
        size="xs"
        value={(config.empty_message as string) ?? ""}
        onChange={(e) =>
          onChange({
            ...config,
            empty_message: e.currentTarget.value || undefined,
          })
        }
      />
    </>
  );
}

function CustomHtmlConfigEditor({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  return (
    <>
      <SectionDivider label="Content" />
      <Textarea
        label="HTML/Text Content"
        size="xs"
        minRows={3}
        maxRows={8}
        autosize
        value={(config.content as string) ?? ""}
        onChange={(e) =>
          onChange({ ...config, content: e.currentTarget.value })
        }
      />
    </>
  );
}

function QuickActionsConfigInfo() {
  return (
    <>
      <SectionDivider label="Quick Actions" />
      <Box
        style={{
          padding: "8px",
          borderRadius: 6,
          background: "var(--mantine-color-gray-0)",
        }}
      >
        <Text size="xs" c="dimmed">
          Quick actions are configured via the widget template's default config.
          Edit the JSON config directly for advanced customization.
        </Text>
      </Box>
    </>
  );
}

// ── Data Scope Section ───────────────────────────────────

function DataScopeSection({
  filters,
  onChange,
}: {
  filters: WidgetDataFilters;
  onChange: (f: WidgetDataFilters) => void;
}) {
  const canSetAll = useHasPermission("admin.settings.general.manage");
  const scope: DataFilterScope = filters.scope ?? "auto";

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: api.listDepartments,
    staleTime: 5 * 60 * 1000,
  });

  const deptOptions = (departments ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const scopeOptions = [
    { value: "auto", label: "My Depts" },
    ...(canSetAll ? [{ value: "all", label: "All" }] : []),
    { value: "custom", label: "Custom" },
  ];

  return (
    <>
      <SectionDivider label="Data Scope" />

      <Box
        style={{
          padding: "8px",
          borderRadius: 6,
          background: "var(--mantine-color-teal-0)",
          border: "1px solid var(--mantine-color-teal-2)",
        }}
      >
        <Group gap={4} mb={4}>
          <IconFilter size={12} color="var(--mantine-color-teal-7)" />
          <Text fz={10} c="var(--mantine-color-teal-7)" fw={500}>
            Department filtering for this widget's data
          </Text>
        </Group>
        <Text fz={10} c="var(--mantine-color-teal-6)">
          "My Depts" shows data filtered to the viewer's departments.
          {canSetAll && ' "All" shows hospital-wide data.'}
          {' "Custom" lets you pick specific departments.'}
        </Text>
      </Box>

      <Box>
        <Text size="xs" fw={500} mb={4}>
          Scope
        </Text>
        <SegmentedControl
          size="xs"
          fullWidth
          data={scopeOptions}
          value={scope}
          onChange={(v) => {
            const newScope = v as DataFilterScope;
            const updated: WidgetDataFilters = { ...filters, scope: newScope };
            if (newScope !== "custom") {
              delete updated.department_ids;
            }
            onChange(updated);
          }}
        />
      </Box>

      {scope === "custom" && (
        <MultiSelect
          label="Departments"
          size="xs"
          data={deptOptions}
          value={filters.department_ids ?? []}
          onChange={(ids) =>
            onChange({ ...filters, department_ids: ids })
          }
          placeholder="Select departments..."
          searchable
          clearable
        />
      )}

      {scope === "auto" && (
        <Badge size="xs" variant="light" color="teal">
          Filtered to viewer's departments
        </Badge>
      )}
      {scope === "all" && (
        <Badge size="xs" variant="light" color="slate">
          Hospital-wide (no department filter)
        </Badge>
      )}
      {scope === "custom" && (filters.department_ids?.length ?? 0) > 0 && (
        <Badge size="xs" variant="light" color="primary">
          {filters.department_ids?.length} department(s) selected
        </Badge>
      )}
    </>
  );
}
