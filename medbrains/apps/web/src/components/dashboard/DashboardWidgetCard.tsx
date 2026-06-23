import { BarChart, LineChart } from "@mantine/charts";
import { Box, Card, Group, Loader, Stack, Table, Text, ThemeIcon } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { DashboardWidget } from "@medbrains/types";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components";
import { Button } from "@/components/ui";
import { WidgetIcon } from "./widgetIcons";

interface Props {
  widget: DashboardWidget;
  data: unknown;
  loading: boolean;
}

interface QuickAction {
  icon?: string;
  label: string;
  route: string;
  permission?: string;
}

/** Read a JSON-ish value from an unknown record. */
function field(obj: unknown, key: string): unknown {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;
}

function formatValue(value: unknown, format?: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return typeof value === "string" ? value : "—";
  if (format === "currency") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  }
  return new Intl.NumberFormat().format(n);
}

function rows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const items = field(data, "items") ?? field(data, "rows") ?? field(data, "data");
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

function dataUnavailable(data: unknown): boolean {
  return Boolean(field(data, "error"));
}

/** A muted "no data / unavailable" body shared by data widgets. */
function EmptyBody({ label }: { label: string }) {
  return (
    <Text size="sm" c="dimmed" ta="center" py="md">
      {label}
    </Text>
  );
}

function WidgetShell({ widget, children }: { widget: DashboardWidget; children: React.ReactNode }) {
  return (
    <Card withBorder padding="md" h="100%">
      <Group gap="xs" mb="sm">
        <ThemeIcon variant="light" color={widget.color ?? "primary"} size={28} radius="md">
          <WidgetIcon name={widget.icon} size={16} />
        </ThemeIcon>
        <Box style={{ minWidth: 0 }}>
          <Text fw={600} size="sm" truncate>
            {widget.title}
          </Text>
          {widget.subtitle && (
            <Text size="xs" c="dimmed" truncate>
              {widget.subtitle}
            </Text>
          )}
        </Box>
      </Group>
      {children}
    </Card>
  );
}

/** Renders a single dashboard widget by its type, from resolved `data`. */
export function DashboardWidgetCard({ widget, data, loading }: Props) {
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  if (widget.widget_type === "stat_card") {
    return (
      <StatCard
        label={widget.title}
        value={
          loading
            ? "…"
            : formatValue(field(data, "value"), String(field(widget.config, "format") ?? ""))
        }
        icon={<WidgetIcon name={widget.icon} />}
        color={widget.color ?? "primary"}
      />
    );
  }

  if (loading) {
    return (
      <WidgetShell widget={widget}>
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      </WidgetShell>
    );
  }

  if (widget.widget_type === "quick_actions") {
    const actions = (field(widget.config, "actions") as QuickAction[] | undefined) ?? [];
    const visible = actions.filter((a) => !a.permission || hasPermission(a.permission));
    return (
      <WidgetShell widget={widget}>
        <Stack gap={6}>
          {visible.length === 0 && <EmptyBody label="No actions available" />}
          {visible.map((a) => (
            <Button
              key={a.label}
              tone="ghost"
              justify="flex-start"
              leftSection={<WidgetIcon name={a.icon} size={16} />}
              onClick={() => navigate(a.route)}
            >
              {a.label}
            </Button>
          ))}
        </Stack>
      </WidgetShell>
    );
  }

  if (widget.widget_type === "list") {
    const items = rows(data);
    return (
      <WidgetShell widget={widget}>
        {items.length === 0 ? (
          <EmptyBody label="Nothing to show" />
        ) : (
          <Stack gap={4}>
            {items.slice(0, 8).map((item, i) => (
              <Text key={String(item.id ?? i)} size="sm" truncate>
                {String(item.title ?? item.name ?? item.label ?? item.patient_name ?? "—")}
              </Text>
            ))}
          </Stack>
        )}
      </WidgetShell>
    );
  }

  if (widget.widget_type === "data_table") {
    const cols = (field(widget.config, "columns") as string[] | undefined) ?? [];
    const items = rows(data);
    return (
      <WidgetShell widget={widget}>
        {dataUnavailable(data) || items.length === 0 || cols.length === 0 ? (
          <EmptyBody label="No data" />
        ) : (
          <Table striped highlightOnHover withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                {cols.map((c) => (
                  <Table.Th key={c}>{c.replace(/_/g, " ")}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.slice(0, 10).map((row, i) => (
                <Table.Tr key={String(row.id ?? i)}>
                  {cols.map((c) => (
                    <Table.Td key={c}>{String(row[c] ?? "—")}</Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </WidgetShell>
    );
  }

  if (widget.widget_type === "chart") {
    const series = rows(data);
    const x = String(field(widget.config, "x_axis") ?? "date");
    const y = String(field(widget.config, "y_axis") ?? "value");
    const kind = String(field(widget.config, "chart_type") ?? "bar");
    return (
      <WidgetShell widget={widget}>
        {dataUnavailable(data) || series.length === 0 ? (
          <EmptyBody label="Chart data unavailable" />
        ) : kind === "line" ? (
          <LineChart h={160} data={series} dataKey={x} series={[{ name: y, color: "indigo.6" }]} />
        ) : (
          <BarChart h={160} data={series} dataKey={x} series={[{ name: y, color: "indigo.6" }]} />
        )}
      </WidgetShell>
    );
  }

  if (widget.widget_type === "system_health") {
    const status = String(field(data, "status") ?? "ok");
    return (
      <WidgetShell widget={widget}>
        <Group gap="xs">
          <ThemeIcon variant="light" color={status === "ok" ? "teal" : "red"} size={20} radius="xl">
            <WidgetIcon name="IconServer" size={12} />
          </ThemeIcon>
          <Text size="sm">{status === "ok" ? "All systems operational" : "Degraded"}</Text>
        </Group>
      </WidgetShell>
    );
  }

  // module_embed / form_embed / custom_html — not yet rendered inline.
  return (
    <WidgetShell widget={widget}>
      <EmptyBody label="Not available here" />
    </WidgetShell>
  );
}
