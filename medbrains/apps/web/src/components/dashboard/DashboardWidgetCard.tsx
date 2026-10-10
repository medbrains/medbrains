import { Box, Card, Group, Loader, Stack, Table, Tabs, Text, ThemeIcon } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import type { DashboardWidget } from "@medbrains/types";
import { IconArrowsMaximize } from "@tabler/icons-react";
import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { StatCard } from "@/components";
import { Button, Drawer, IconButton, Tooltip } from "@/components/ui";
import { KpiCompareMenu } from "./KpiCompareMenu";
import { compareKpi, formatKpi, isKpiReading, type KpiBaseline } from "./kpi-reading";
import { SeriesMetrics } from "./SeriesMetrics";
import { columnValues } from "./series-stats";
import { TrendChart, type TrendKind } from "./TrendChart";
import { useWidgetCompare } from "./useWidgetCompare";
import { WidgetExpandedView } from "./WidgetExpandedView";
import { cellText, field, formatValue, rows } from "./widget-data";
import { WidgetIcon } from "./widgetIcons";

const WidgetAskAi = lazy(() => import("./WidgetAskAi"));

interface Props {
  widget: DashboardWidget;
  data: unknown;
  loading: boolean;
  /** What a management KPI is set against; the same weekday unless chosen. */
  compare?: KpiBaseline;
}

interface QuickAction {
  icon?: string;
  label: string;
  route: string;
  permission?: string;
}

function dataUnavailable(data: unknown): boolean {
  return Boolean(field(data, "error"));
}

/** A muted "nothing to show" body shared by data widgets. */
function EmptyBody({ label }: { label: string }) {
  return (
    <Text size="sm" c="dimmed" ta="center" py="md">
      {label}
    </Text>
  );
}

/**
 * A tile whose data could not be fetched.
 *
 * Kept visually distinct from {@link EmptyBody} on purpose. A failed fetch
 * used to render as "No data" and "Nothing to show" — the same words an
 * empty result gets — so a doctor whose appointments query was erroring read
 * it as a clear morning. An outage must never be legible as a fact about the
 * ward.
 */
function UnavailableBody() {
  return (
    <Stack gap={4} align="center" py="md">
      <ThemeIcon variant="light" color="orange" size={28} radius="md">
        <WidgetIcon name="IconAlertTriangle" size={16} />
      </ThemeIcon>
      <Text size="sm" c="dimmed" ta="center">
        Couldn't load
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        This is a failed request, not an empty result. Refresh to try again.
      </Text>
    </Stack>
  );
}

interface ShellProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  /** Opens the widget at full size; absent where there is nothing more to show. */
  onExpand?: () => void;
}

function WidgetShell({ widget, children, onExpand }: ShellProps) {
  return (
    <Card withBorder padding="md" h="100%">
      <Group gap="xs" mb="sm" wrap="nowrap">
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
        {onExpand && (
          <Tooltip label="Expand">
            <IconButton aria-label={`Expand ${widget.title}`} ml="auto" onClick={onExpand}>
              <IconArrowsMaximize size={16} />
            </IconButton>
          </Tooltip>
        )}
      </Group>
      {children}
    </Card>
  );
}

/** Widget types with a larger view: a trend, a full table, a history. */
const EXPANDABLE = new Set(["stat_card", "chart", "data_table", "list"]);

/** A dashboard widget, with its expanded view one click away. */
export function DashboardWidgetCard(props: Props) {
  const { widget, data, loading } = props;
  const [expanded, setExpanded] = useState(false);
  const [compare, setCompare] = useWidgetCompare(widget.id, props.compare ?? "weekday");
  const canExpand = EXPANDABLE.has(widget.widget_type) && !loading && !dataUnavailable(data);
  return (
    <>
      <WidgetBody
        {...props}
        compare={compare}
        onCompareChange={setCompare}
        onExpand={canExpand ? () => setExpanded(true) : undefined}
      />
      <Drawer opened={expanded} onClose={() => setExpanded(false)} title={widget.title} size="xl">
        {expanded && (
          <Tabs defaultValue="details" keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab value="details">Details</Tabs.Tab>
              <Tabs.Tab value="ask">Ask AI</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="details">
              <WidgetExpandedView
                widget={widget}
                data={data}
                compare={compare}
                onCompareChange={setCompare}
              />
            </Tabs.Panel>
            <Tabs.Panel value="ask">
              <Suspense fallback={<Loader size="sm" />}>
                <WidgetAskAi widget={widget} data={data} compare={compare} />
              </Suspense>
            </Tabs.Panel>
          </Tabs>
        )}
      </Drawer>
    </>
  );
}

/** Renders a single dashboard widget by its type, from resolved `data`. */
function WidgetBody({
  widget,
  data,
  loading,
  compare = "weekday",
  onExpand,
  onCompareChange,
}: Props & { onExpand?: () => void; onCompareChange: (next: KpiBaseline) => void }) {
  const navigate = useNavigate();
  const hasPermission = usePermissionStore((s) => s.hasPermission);

  // Every data-backed tile answers the same way when its query failed, and it
  // is checked before any of them — including stat_card, which otherwise
  // renders a bare em-dash indistinguishable from a real zero.
  //
  // `quick_actions` is exempt: it is driven entirely by widget.config and
  // never asks the server for data, so it has nothing to fail.
  if (dataUnavailable(data) && widget.widget_type !== "quick_actions") {
    return (
      <WidgetShell widget={widget}>
        <UnavailableBody />
      </WidgetShell>
    );
  }

  if (widget.widget_type === "stat_card" && isKpiReading(data)) {
    return (
      <StatCard
        label={widget.title}
        value={formatKpi(data.value, data.unit)}
        icon={<WidgetIcon name={widget.icon} />}
        color={widget.color ?? "primary"}
        comparison={compareKpi(data, compare) ?? undefined}
        sparkline={data.series.map((d) => d.value)}
        actions={
          <>
            <KpiCompareMenu title={widget.title} value={compare} onChange={onCompareChange} />
            {onExpand && (
              <IconButton aria-label={`Expand ${widget.title}`} onClick={onExpand}>
                <IconArrowsMaximize size={16} />
              </IconButton>
            )}
          </>
        }
      />
    );
  }

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
        onClick={onExpand}
        actionLabel={`Expand ${widget.title}`}
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
      <WidgetShell widget={widget} onExpand={onExpand}>
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
    const labels = (field(widget.config, "labels") as Record<string, string> | undefined) ?? {};
    const maxRows = Number(field(widget.config, "max_rows") ?? 10);
    const items = rows(data);
    return (
      <WidgetShell widget={widget} onExpand={onExpand}>
        {items.length === 0 || cols.length === 0 ? (
          <EmptyBody label="Nothing to show" />
        ) : (
          <Table striped highlightOnHover withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                {cols.map((c) => (
                  <Table.Th key={c}>{labels[c] ?? c.replace(/_/g, " ")}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.slice(0, maxRows).map((row, i) => (
                <Table.Tr key={String(row.id ?? i)}>
                  {cols.map((c) => (
                    <Table.Td key={c}>{cellText(row[c])}</Table.Td>
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
    const kind = String(field(widget.config, "chart_type") ?? "bar") as TrendKind;
    return (
      <WidgetShell widget={widget} onExpand={onExpand}>
        {series.length === 0 ? (
          <EmptyBody label="Nothing to show" />
        ) : (
          <Stack gap="xs">
            <SeriesMetrics values={columnValues(series, y)} compact />
            <TrendChart data={series} xKey={x} yKey={y} kind={kind} />
          </Stack>
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
