import { Box, Center, Group, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { IconLayoutDashboard, IconLayoutGridAdd } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components";
import { AwaitingRoleNotice } from "@/components/dashboard/AwaitingRoleNotice";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
import { KpiPeriodControls } from "@/components/dashboard/KpiPeriodControls";
import type { KpiBaseline } from "@/components/dashboard/kpi-reading";
import { WidgetPicker } from "@/components/dashboard/WidgetPicker";
import { useWidgetFilterStore } from "@/components/dashboard/widget-filter-store";
import { GettingStartedWidget } from "@/components/GettingStartedWidget";
import { IconButton } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import styles from "./dashboard.module.scss";

export function DashboardPage() {
  useRequirePermission(P.DASHBOARD.VIEW);

  const {
    data: dashboard,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-dashboard"],
    queryFn: () => api.getMyDashboard(),
    staleTime: 120_000,
  });

  const [asOf, setAsOf] = useState<string | null>(null);
  const [compare, setCompare] = useState<KpiBaseline>("weekday");
  const [pickerOpen, setPickerOpen] = useState(false);
  const widgetIds = useMemo(() => (dashboard?.widgets ?? []).map((w) => w.id), [dashboard]);
  // The period controls only mean something on a dashboard with management KPIs.
  const hasKpis = useMemo(
    () => (dashboard?.widgets ?? []).some((w) => w.data_source?.module === "management"),
    [dashboard],
  );

  // Each tile's own narrowing (a department), sent with the one data call.
  const allFilters = useWidgetFilterStore((s) => s.filters);
  const filters = useMemo(
    () =>
      Object.fromEntries(widgetIds.flatMap((id) => (allFilters[id] ? [[id, allFilters[id]]] : []))),
    [widgetIds, allFilters],
  );
  const { data: widgetData, isLoading: dataLoading } = useQuery({
    queryKey: ["my-dashboard", "data", widgetIds, asOf, filters],
    queryFn: () => api.batchWidgetData(widgetIds, asOf ?? undefined, filters),
    placeholderData: (previous) => previous,
    enabled: widgetIds.length > 0,
    staleTime: 60_000,
  });

  const dataById = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const r of widgetData ?? []) map.set(r.widget_id, r.data);
    return map;
  }, [widgetData]);

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (isError || !dashboard) {
    return (
      <Stack align="center" gap="xs" py={64}>
        <ThemeIcon variant="light" color="gray" size={48} radius="xl">
          <IconLayoutDashboard size={24} />
        </ThemeIcon>
        <Text fw={600}>No dashboard configured</Text>
        <Text size="sm" c="dimmed" ta="center" maw={360}>
          An administrator hasn't set up a dashboard for your role yet. Once they do, your widgets
          will appear here.
        </Text>
      </Stack>
    );
  }

  const columns = dashboard.dashboard.layout_config?.columns ?? 12;
  const rowHeight = dashboard.dashboard.layout_config?.row_height ?? 80;

  return (
    <Box>
      <PageHeader
        title={dashboard.dashboard.name}
        subtitle={dashboard.dashboard.description ?? undefined}
        actions={
          <Group gap="sm" align="flex-end">
            {hasKpis && (
              <KpiPeriodControls
                asOf={asOf}
                onAsOfChange={setAsOf}
                compare={compare}
                onCompareChange={setCompare}
              />
            )}
            <IconButton
              tone="default"
              size="lg"
              aria-label="Choose dashboard widgets"
              onClick={() => setPickerOpen(true)}
            >
              <IconLayoutGridAdd size={20} />
            </IconButton>
          </Group>
        }
      />
      <WidgetPicker
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        widgets={dashboard.widgets}
      />
      <AwaitingRoleNotice />
      <GettingStartedWidget />
      {dashboard.widgets.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="xl">
          This dashboard has no widgets yet.
        </Text>
      ) : (
        <Box className={styles.grid}>
          {dashboard.widgets.map((widget) => (
            <Box
              key={widget.id}
              className={styles.cell}
              style={{
                gridColumn: `span ${Math.min(widget.width || 4, columns)}`,
                minHeight: (widget.height || 2) * rowHeight,
              }}
            >
              <DashboardWidgetCard
                widget={widget}
                data={dataById.get(widget.id)}
                loading={dataLoading}
                compare={compare}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
