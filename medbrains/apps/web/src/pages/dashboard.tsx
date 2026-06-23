import { Box, Center, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { IconLayoutDashboard } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { PageHeader } from "@/components";
import { DashboardWidgetCard } from "@/components/dashboard/DashboardWidgetCard";
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

  const widgetIds = useMemo(() => (dashboard?.widgets ?? []).map((w) => w.id), [dashboard]);

  const { data: widgetData, isLoading: dataLoading } = useQuery({
    queryKey: ["my-dashboard", "data", widgetIds],
    queryFn: () => api.batchWidgetData(widgetIds),
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
      />
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
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
