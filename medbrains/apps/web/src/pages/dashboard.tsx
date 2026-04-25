import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Drawer,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import type {
  DashboardWithWidgets,
  RecentActivity,
  WidgetTemplate,
} from "@medbrains/types";
import { useHasPermission } from "@medbrains/stores";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useRequirePermission } from "../hooks/useRequirePermission";
import {
  IconActivity,
  IconArrowRight,
  IconBed,
  IconCalendar,
  IconClock,
  IconDashboard,
  IconFlask,
  IconHeartbeat,
  IconPlus,
  IconReceipt,
  IconServer,
  IconSettings,
  IconStethoscope,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { PageHeader, StatCard } from "../components";
import { WidgetRenderer } from "../components/Dashboard/WidgetRenderer";

export function DashboardPage() {
  useRequirePermission(P.DASHBOARD.VIEW);
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);

  // Try to load the user's configured dashboard
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["my-dashboard"],
    queryFn: () => api.getMyDashboard(),
    retry: 1,
  });

  // Show configured dashboard if available
  if (isLoading) {
    return (
      <div>
        <PageHeader title={t("title")} subtitle={t("loading")} icon={<IconDashboard size={20} stroke={1.5} />} color="primary" />
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </div>
    );
  }

  // If we have a configured dashboard with widgets, render it dynamically
  if (dashboardData && dashboardData.widgets.length > 0) {
    return (
      <ConfiguredDashboard
        data={dashboardData}
        canManage={canManage}
        navigate={navigate}
        t={t}
      />
    );
  }

  // Fallback: render the default hardcoded dashboard
  return <DefaultDashboard navigate={navigate} canManage={canManage} t={t} />;
}

// ── Configured Dashboard (Dynamic) ──────────────────────

function ConfiguredDashboard({
  data,
  canManage,
  navigate,
  t,
}: {
  data: DashboardWithWidgets;
  canManage: boolean;
  navigate: ReturnType<typeof useNavigate>;
  t: (key: string) => string;
}) {
  const { dashboard, widgets } = data;
  const columns = (dashboard.layout_config as { columns?: number })?.columns ?? 12;
  const [drawerOpen, { open: openDrawer, close: closeDrawer }] = useDisclosure(false);
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ["widget-templates"],
    queryFn: () => api.listWidgetTemplates(),
    enabled: drawerOpen,
  });

  const handleAddWidget = async (tmpl: WidgetTemplate) => {
    const maxY = widgets.reduce((m, w) => Math.max(m, w.position_y + w.height), 0);
    await api.myAddWidget({
      widget_type: tmpl.widget_type,
      title: tmpl.name,
      subtitle: tmpl.description ?? undefined,
      icon: tmpl.icon ?? undefined,
      color: tmpl.color ?? undefined,
      config: (tmpl.default_config as Record<string, unknown>) ?? {},
      data_source: (tmpl.default_source as Record<string, unknown>) ?? {},
      width: tmpl.default_width ?? 4,
      height: tmpl.default_height ?? 2,
      position_x: 0,
      position_y: maxY,
    });
    await queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
    closeDrawer();
  };

  return (
    <div>
      <PageHeader
        title={dashboard.name || "Dashboard"}
        subtitle={dashboard.description || "Overview of today's activity"}
        icon={<IconDashboard size={20} stroke={1.5} />}
        color="primary"
        actions={
          <Group gap="xs">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={openDrawer}
            >
              {t("addWidget")}
            </Button>
            {canManage && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconSettings size={14} />}
                onClick={() =>
                  navigate(`/admin/dashboard-builder/${dashboard.id}`)
                }
              >
                Customize
              </Button>
            )}
          </Group>
        }
      />

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 16,
        }}
      >
        {widgets.map((widget) => (
          <Box
            key={widget.id}
            style={{
              gridColumn: `${widget.position_x + 1} / span ${widget.width}`,
              gridRow: `${widget.position_y + 1} / span ${widget.height}`,
            }}
          >
            <WidgetRenderer widget={widget} />
          </Box>
        ))}
      </Box>

      <Drawer
        opened={drawerOpen}
        onClose={closeDrawer}
        title={t("addWidget")}
        position="right"
        size="sm"
      >
        <Stack gap="xs">
          {templates?.map((tmpl) => (
            <Card
              key={tmpl.id}
              withBorder
              padding="sm"
              style={{ cursor: "pointer" }}
              onClick={() => handleAddWidget(tmpl)}
            >
              <Group gap="sm">
                <ThemeIcon
                  variant="light"
                  color={tmpl.color ?? "blue"}
                  size="md"
                >
                  <IconDashboard size={16} />
                </ThemeIcon>
                <div>
                  <Text size="sm" fw={500}>
                    {tmpl.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {tmpl.description}
                  </Text>
                </div>
              </Group>
            </Card>
          ))}
          {templates?.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {t("noWidgets")}
            </Text>
          )}
        </Stack>
      </Drawer>
    </div>
  );
}

// ── Default Dashboard (Fallback) ────────────────────────

const quickActions = [
  {
    label: "Register Patient",
    description: "Add a new patient record",
    icon: IconUserPlus,
    color: "primary",
    path: "/patients",
  },
  {
    label: "New OPD Visit",
    description: "Create outpatient visit",
    icon: IconStethoscope,
    color: "teal",
    path: "/opd",
  },
  {
    label: "Lab Order",
    description: "Request lab investigation",
    icon: IconFlask,
    color: "orange",
    path: "/lab",
  },
  {
    label: "Generate Invoice",
    description: "Create billing invoice",
    icon: IconReceipt,
    color: "violet",
    path: "/billing",
  },
];

const ACTIVITY_ICON_MAP: Record<string, { icon: typeof IconActivity; color: string }> = {
  patient: { icon: IconUserPlus, color: "info" },
  opd: { icon: IconStethoscope, color: "teal" },
  lab: { icon: IconFlask, color: "success" },
  billing: { icon: IconReceipt, color: "violet" },
  appointment: { icon: IconCalendar, color: "primary" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CardHeader({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <>
      <Group justify="space-between" px="lg" py="sm">
        <Text size="sm" fw={600} c="var(--mb-text-primary)">{title}</Text>
        {action && (
          <Text
            size="xs"
            c="var(--mantine-color-primary-5)"
            fw={500}
            style={{ cursor: "pointer" }}
            onClick={action.onClick}
          >
            {action.label}
          </Text>
        )}
      </Group>
      <Divider />
    </>
  );
}

function DefaultDashboard({
  navigate,
  canManage,
  t,
}: {
  navigate: ReturnType<typeof useNavigate>;
  canManage: boolean;
  t: (key: string) => string;
}) {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 30_000, // refresh every 30s
  });

  const formatRevenue = (val: string) => {
    const num = parseFloat(val);
    if (Number.isNaN(num) || num === 0) return "0";
    if (num >= 100_000) return `${(num / 100_000).toFixed(1)}L`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("overview")}
        icon={<IconDashboard size={20} stroke={1.5} />}
        color="primary"
        actions={
          canManage ? (
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconSettings size={14} />}
              onClick={() => navigate("/admin/settings#dashboards")}
            >
              {t("customize")}
            </Button>
          ) : undefined
        }
      />

      {/* Stat Cards — Row 1 */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <StatCard
          label={t("stats.totalPatients")}
          value={stats?.total_patients ?? 0}
          icon={<IconUsers size={20} stroke={1.5} />}
          color="primary"
          trend={stats?.today_registrations ? { value: stats.today_registrations, label: "new today" } : undefined}
        />
        <StatCard
          label={t("stats.opdQueue")}
          value={stats?.opd_queue_count ?? 0}
          icon={<IconStethoscope size={20} stroke={1.5} />}
          color="teal"
          trend={stats?.today_visits ? { value: stats.today_visits, label: "visits today" } : undefined}
        />
        <StatCard
          label={t("stats.labPending")}
          value={stats?.lab_pending ?? 0}
          icon={<IconFlask size={20} stroke={1.5} />}
          color="orange"
        />
        <StatCard
          label={t("stats.revenueToday")}
          value={stats ? `₹${formatRevenue(stats.today_revenue)}` : "--"}
          icon={<IconReceipt size={20} stroke={1.5} />}
          color="violet"
        />
      </SimpleGrid>

      {/* Stat Cards — Row 2 */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        <StatCard
          label={t("stats.appointments")}
          value={stats?.today_appointments ?? 0}
          icon={<IconCalendar size={20} stroke={1.5} />}
          color="primary"
        />
        <StatCard
          label={t("stats.ipdActive")}
          value={stats?.ipd_active ?? 0}
          icon={<IconBed size={20} stroke={1.5} />}
          color="info"
        />
      </SimpleGrid>

      {/* Quick Actions + Activity */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card padding={0}>
            <CardHeader title={t("quickActions.title")} />
            <SimpleGrid cols={{ base: 1, sm: 2 }} p="lg" spacing="md">
              {quickActions.map((action) => (
                <UnstyledButton
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="clickable-card"
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "var(--mb-card-bg, #ffffff)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <ThemeIcon
                    variant="light"
                    color={action.color}
                    size={40}
                    radius="lg"
                  >
                    <action.icon size={20} stroke={1.5} />
                  </ThemeIcon>
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={600} c="var(--mb-text-primary)">
                      {action.label}
                    </Text>
                    <Text size="xs" c="var(--mb-text-muted)">
                      {action.description}
                    </Text>
                  </div>
                  <IconArrowRight size={16} color="var(--mb-text-muted)" />
                </UnstyledButton>
              ))}
            </SimpleGrid>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card padding={0} h="100%">
            <CardHeader title={t("recentActivity.title")} />
            <Stack gap={0}>
              {stats?.recent_activity && stats.recent_activity.length > 0 ? (
                stats.recent_activity.map((item: RecentActivity, i: number) => {
                  const meta = ACTIVITY_ICON_MAP[item.activity_type] ?? { icon: IconActivity, color: "slate" };
                  const ActivityIcon = meta.icon;
                  return (
                    <Box key={i}>
                      <Group gap="sm" wrap="nowrap" align="flex-start" px="lg" py="sm">
                        <ThemeIcon
                          variant="light"
                          color={meta.color}
                          size={28}
                          radius="lg"
                          mt={2}
                        >
                          <ActivityIcon size={14} stroke={1.5} />
                        </ThemeIcon>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text size="sm" c="var(--mb-text-primary)" lh={1.3}>
                            {item.description}
                          </Text>
                          <Group gap={4} mt={2}>
                            <IconClock size={11} color="var(--mb-text-muted)" />
                            <Text size="xs" c="var(--mb-text-muted)">
                              {timeAgo(item.occurred_at)}
                            </Text>
                          </Group>
                        </div>
                      </Group>
                      {i < stats.recent_activity.length - 1 && <Divider />}
                    </Box>
                  );
                })
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="lg">
                  No recent activity
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Bottom — Module Status + System Health */}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Card padding={0}>
          <CardHeader title={t("moduleStatus.title")} />
          <Stack gap="xs" p="lg">
            {[
              { name: "Patient Management", status: "Active" },
              { name: "OPD", status: "Active" },
              { name: "Appointments", status: "Active" },
              { name: "Laboratory", status: "Active" },
              { name: "Pharmacy", status: "Active" },
              { name: "Billing", status: "Active" },
              { name: "IPD", status: "Active" },
              { name: "Indent & Store", status: "Active" },
            ].map((mod) => (
              <Group key={mod.name} justify="space-between">
                <Text size="sm" c="var(--mb-text-secondary)">{mod.name}</Text>
                <Badge color="success" variant="light" size="sm">{mod.status}</Badge>
              </Group>
            ))}
          </Stack>
        </Card>
        <Card padding={0}>
          <CardHeader title={t("systemHealth.title")} />
          <Stack gap="sm" p="lg">
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon variant="light" color="success" size={24} radius="lg">
                  <IconServer size={14} />
                </ThemeIcon>
                <Text size="sm" c="var(--mb-text-secondary)">{t("systemHealth.apiServer")}</Text>
              </Group>
              <Badge color="success" variant="light" size="sm">Healthy</Badge>
            </Group>
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon variant="light" color="success" size={24} radius="lg">
                  <IconServer size={14} />
                </ThemeIcon>
                <Text size="sm" c="var(--mb-text-secondary)">{t("systemHealth.postgresql")}</Text>
              </Group>
              <Badge color="success" variant="light" size="sm">Connected</Badge>
            </Group>
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon variant="light" color="slate" size={24} radius="lg">
                  <IconServer size={14} />
                </ThemeIcon>
                <Text size="sm" c="var(--mb-text-secondary)">{t("systemHealth.yottadb")}</Text>
              </Group>
              <Badge color="slate" variant="light" size="sm">Deferred</Badge>
            </Group>
            <Group justify="space-between">
              <Group gap="sm">
                <ThemeIcon variant="light" color="success" size={24} radius="lg">
                  <IconHeartbeat size={14} />
                </ThemeIcon>
                <Text size="sm" c="var(--mb-text-secondary)">{t("systemHealth.uptime")}</Text>
              </Group>
              <Text size="xs" c="var(--mb-text-secondary)" fw={500}>99.9%</Text>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>
    </div>
  );
}
