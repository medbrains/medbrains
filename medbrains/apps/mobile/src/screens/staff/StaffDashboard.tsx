import {
  useAuthStore,
  useFieldAccess,
  useHasAnyPermission,
  useHasPermission,
} from "@medbrains/stores";
import {
  DASHBOARD_STAT_INTENTS,
  type DashboardMobileIntent,
  type DashboardMobileRoute,
  type DashboardStatIntentId,
  type FieldAccessLevel,
  P,
  type QueueEntry,
  TOKEN_BOARD_SURFACE_LIST,
} from "@medbrains/types";
import { useMemo } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Chip,
  FAB,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { QueueItem } from "../../components";
import {
  useCallQueueEntryMutation,
  useCompleteQueueEntryMutation,
  useMarkNoShowMutation,
  useStaffDashboardQueueQuery,
  useStartConsultationMutation,
} from "../../services/queue.queries";
import { MEDBRAINS_COLORS } from "../../theme/paper-theme";
import { mobileQueueActionEnabled, resolveMobileQueueActions } from "../../utils/queue-actions";
import { protectedQueueIdentity, queuePatientNameAccess } from "../../utils/queue-privacy";

type MobileQueueStatus = "waiting" | "called" | "in_consultation" | "completed" | "no_show";
const TOKEN_BOARD_VIEW_PERMISSIONS = TOKEN_BOARD_SURFACE_LIST.flatMap(
  (surface) => surface.requiredAnyPermissions,
);

type StaffDashboardRoute =
  | DashboardMobileRoute
  | "Vitals"
  | "Prescription"
  | "LabOrder"
  | "RadiologyOrder"
  | "PatientDetail";

interface StaffDashboardProps {
  navigation: {
    navigate: (screen: StaffDashboardRoute, params?: Readonly<Record<string, unknown>>) => void;
  };
}

interface StatCard {
  id: string;
  intentId?: DashboardStatIntentId;
  label: string;
  value: number;
  icon: string;
  color: string;
}

interface QuickAction {
  id: string;
  enabled: boolean;
  icon: string;
  label: string;
  route: StaffDashboardRoute;
}

function StatCardItem({
  actionLabel,
  onPress,
  stat,
}: {
  actionLabel?: string;
  onPress?: () => void;
  stat: StatCard;
}) {
  return (
    <TouchableOpacity
      accessibilityLabel={actionLabel}
      accessibilityRole={onPress ? "button" : undefined}
      activeOpacity={onPress ? 0.84 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={styles.statAction}
    >
      <Surface style={[styles.statCard, { borderLeftColor: stat.color }]} elevation={1}>
        <Avatar.Icon
          size={36}
          icon={stat.icon}
          style={{ backgroundColor: `${stat.color}20` }}
          color={stat.color}
        />
        <View style={styles.statContent}>
          <Text variant="headlineMedium" style={styles.statValue}>
            {stat.value}
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            {stat.label}
          </Text>
        </View>
      </Surface>
    </TouchableOpacity>
  );
}

function toMobileQueueStatus(status: string): MobileQueueStatus {
  switch (status) {
    case "waiting":
    case "called":
    case "in_consultation":
    case "completed":
    case "no_show":
      return status;
    default:
      return "waiting";
  }
}

function elapsedMinutesSince(timestamp: string | null | undefined): number | undefined {
  if (!timestamp) return undefined;
  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsed)) return undefined;
  return Math.max(0, Math.floor(elapsed / 60000));
}

function formatRole(role: string | undefined): string {
  if (!role) return "Staff";
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "ST";
}

function queueItemView(
  item: QueueEntry,
  access: { name: FieldAccessLevel; uhid: FieldAccessLevel },
) {
  const identity = protectedQueueIdentity(item, access);

  return {
    id: item.id,
    token_number: item.token_number,
    patient_name: identity.patient_name,
    uhid: identity.uhid,
    status: toMobileQueueStatus(item.status),
    wait_time_minutes: elapsedMinutesSince(item.queue_date),
  };
}

function resolveStatMobileIntent(
  stat: StatCard,
): { intentId: DashboardStatIntentId; mobile: DashboardMobileIntent } | undefined {
  if (!stat.intentId) return undefined;
  const mobile = DASHBOARD_STAT_INTENTS[stat.intentId].mobile;
  if (!mobile) return undefined;
  return { intentId: stat.intentId, mobile };
}

export function StaffDashboard({ navigation }: StaffDashboardProps) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const firstNameAccess = useFieldAccess("patients.first_name");
  const middleNameAccess = useFieldAccess("patients.middle_name");
  const lastNameAccess = useFieldAccess("patients.last_name");
  const uhidAccess = useFieldAccess("patients.uhid");
  const canViewQueue = useHasAnyPermission([P.OPD.QUEUE_LIST, P.OPD.QUEUE_VIEW]);
  const canViewTokenBoards = useHasAnyPermission(TOKEN_BOARD_VIEW_PERMISSIONS);
  const canManageQueue = useHasPermission(P.OPD.TOKEN_MANAGE);
  const canFindPatients = useHasPermission(P.PATIENTS.LIST);
  const canRecordVitals = useHasPermission(P.OPD.VITALS.CREATE);
  const canSignOrders = useHasPermission(P.ORDER_BASKET.SIGN);
  const canCreateRadiologyOrder = useHasPermission(P.RADIOLOGY.ORDERS_CREATE);
  const canListRadiologyOrders = useHasPermission(P.RADIOLOGY.ORDERS_LIST);
  const canCreateRadiologyOrders = canCreateRadiologyOrder && canListRadiologyOrders;
  const canViewLabReports = useHasPermission(P.LAB.REPORTS_VIEW);
  const patientNameAccess = queuePatientNameAccess(
    firstNameAccess,
    middleNameAccess,
    lastNameAccess,
  );

  const { data, isError, isFetching, isLoading, refetch } = useStaffDashboardQueueQuery({
    enabled: canViewQueue,
  });
  const callMutation = useCallQueueEntryMutation();
  const startMutation = useStartConsultationMutation();
  const completeMutation = useCompleteQueueEntryMutation();
  const noShowMutation = useMarkNoShowMutation();

  const queueItems = data ?? [];
  const stats = useMemo(() => {
    const waiting = queueItems.filter((item) => item.status === "waiting").length;
    const called = queueItems.filter((item) => item.status === "called").length;
    const inProgress = queueItems.filter((item) => item.status === "in_consultation").length;
    const completed = queueItems.filter((item) => item.status === "completed").length;

    return {
      active: called + inProgress,
      called,
      completed,
      total: queueItems.length,
      waiting,
    };
  }, [queueItems]);

  const todayStats: StatCard[] = [
    {
      id: "patients",
      intentId: "opdQueue",
      label: "Tokens Today",
      value: stats.total,
      icon: "account-group",
      color: MEDBRAINS_COLORS.brand,
    },
    {
      id: "waiting",
      intentId: "opdQueue",
      label: "Waiting",
      value: stats.waiting,
      icon: "clock-outline",
      color: MEDBRAINS_COLORS.statusWarning,
    },
    {
      id: "active",
      intentId: "opdQueue",
      label: "Active",
      value: stats.active,
      icon: "account-clock",
      color: MEDBRAINS_COLORS.statusInfo,
    },
    {
      id: "completed",
      intentId: "opdQueue",
      label: "Completed",
      value: stats.completed,
      icon: "check-circle",
      color: MEDBRAINS_COLORS.emerald,
    },
  ];

  const activeQueueItems = queueItems
    .filter((item) => ["waiting", "called", "in_consultation"].includes(item.status))
    .slice(0, 6);

  const staffName = user?.full_name ?? user?.username ?? "Staff";
  const roleLabel = formatRole(user?.role);
  const enabledFlowLabels = [
    canFindPatients ? "Patient" : null,
    canViewQueue ? "Queue" : null,
    canViewTokenBoards ? "Boards" : null,
    canRecordVitals ? "Vitals" : null,
    canSignOrders ? "Orders" : null,
    canCreateRadiologyOrders ? "Imaging" : null,
    canViewLabReports ? "Results" : null,
  ].filter((label): label is string => Boolean(label));
  const quickActions: QuickAction[] = [
    {
      id: "queue",
      enabled: canViewQueue,
      icon: "clipboard-list",
      label: "Full Queue",
      route: "Queue",
    },
    {
      id: "token-boards",
      enabled: canViewTokenBoards,
      icon: "monitor-dashboard",
      label: "Token Boards",
      route: "TokenBoards",
    },
    {
      id: "patient-search",
      enabled: canFindPatients,
      icon: "account-search",
      label: "Find Patient",
      route: "PatientSearch",
    },
    {
      id: "vitals",
      enabled: canRecordVitals,
      icon: "heart-pulse",
      label: "Vitals",
      route: "Vitals",
    },
    {
      id: "prescription",
      enabled: canSignOrders,
      icon: "file-document-edit",
      label: "Write Rx",
      route: "Prescription",
    },
    {
      id: "lab-order",
      enabled: canSignOrders,
      icon: "flask-plus",
      label: "Lab Order",
      route: "LabOrder",
    },
    {
      id: "radiology-order",
      enabled: canCreateRadiologyOrders,
      icon: "radioactive",
      label: "Imaging",
      route: "RadiologyOrder",
    },
    {
      id: "lab-results",
      enabled: canViewLabReports,
      icon: "flask",
      label: "Lab Results",
      route: "LabResultsView",
    },
  ];
  const enabledQuickActions = quickActions.filter((action) => action.enabled);

  const handleStartConsultation = (item: QueueEntry) => {
    startMutation.mutate(item.id, {
      onSuccess: () => navigation.navigate("PatientDetail", { patientId: item.patient_id }),
    });
  };

  const handleDashboardStatPress = (intentId: DashboardStatIntentId) => {
    const mobile = DASHBOARD_STAT_INTENTS[intentId].mobile;
    if (!mobile) return;
    navigation.navigate(mobile.route, mobile.params);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text variant="titleLarge" style={styles.greeting}>
              Good Morning,
            </Text>
            <Text variant="headlineSmall" style={styles.staffName}>
              {staffName}
            </Text>
            <Chip compact icon="hospital-building" style={styles.deptChip}>
              {roleLabel}
            </Chip>
          </View>
          <Avatar.Text size={56} label={getInitials(staffName)} />
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Today's Overview</Text>
          {isFetching && <ActivityIndicator size="small" />}
        </View>
        <View style={styles.statsGrid}>
          {todayStats.map((stat) => {
            const action = resolveStatMobileIntent(stat);

            return (
              <StatCardItem
                key={stat.id}
                actionLabel={action?.mobile.actionLabel}
                onPress={action ? () => handleDashboardStatPress(action.intentId) : undefined}
                stat={stat}
              />
            );
          })}
        </View>

        <Surface style={styles.flowPanel} elevation={1}>
          <Text variant="labelSmall" style={styles.flowLabel}>
            Enabled mobile flow
          </Text>
          <View style={styles.flowChips}>
            {enabledFlowLabels.length > 0 ? (
              enabledFlowLabels.map((label) => (
                <Chip key={label} compact mode="outlined" style={styles.flowChip}>
                  {label}
                </Chip>
              ))
            ) : (
              <Text variant="bodySmall" style={styles.stateText}>
                No mobile workflow actions are enabled for this role.
              </Text>
            )}
          </View>
        </Surface>

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Current Queue</Text>
          <Badge size={24}>{stats.waiting}</Badge>
        </View>

        {!canViewQueue ? (
          <Surface style={styles.statePanel} elevation={1}>
            <Avatar.Icon size={48} icon="shield-lock-outline" style={styles.stateIcon} />
            <Text variant="titleSmall">Queue restricted</Text>
            <Text variant="bodySmall" style={styles.stateText}>
              OPD queue visibility is controlled by your permission matrix.
            </Text>
          </Surface>
        ) : isLoading ? (
          <Surface style={styles.statePanel} elevation={1}>
            <ActivityIndicator size="large" />
            <Text variant="bodyMedium" style={styles.stateText}>
              Loading live queue...
            </Text>
          </Surface>
        ) : isError ? (
          <Surface style={styles.statePanel} elevation={1}>
            <Avatar.Icon size={48} icon="wifi-alert" style={styles.stateIcon} />
            <Text variant="titleSmall">Queue unavailable</Text>
            <Text variant="bodySmall" style={styles.stateText}>
              Pull from the queue screen or retry when network is stable.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void refetch()}>
              <Text variant="labelLarge" style={styles.retryText}>
                Retry
              </Text>
            </TouchableOpacity>
          </Surface>
        ) : activeQueueItems.length > 0 ? (
          <View style={styles.queueList}>
            {activeQueueItems.map((item) => {
              const actions = resolveMobileQueueActions(item, { canManageQueue });

              return (
                <QueueItem
                  key={item.id}
                  item={queueItemView(item, { name: patientNameAccess, uhid: uhidAccess })}
                  onCall={
                    mobileQueueActionEnabled(actions, "call")
                      ? () => callMutation.mutate(item.id)
                      : undefined
                  }
                  onStart={
                    mobileQueueActionEnabled(actions, "start")
                      ? () => handleStartConsultation(item)
                      : undefined
                  }
                  onComplete={
                    mobileQueueActionEnabled(actions, "complete")
                      ? () => completeMutation.mutate(item.id)
                      : undefined
                  }
                  onNoShow={
                    mobileQueueActionEnabled(actions, "noShow")
                      ? () => noShowMutation.mutate(item.id)
                      : undefined
                  }
                  compact
                />
              );
            })}
          </View>
        ) : (
          <Surface style={styles.statePanel} elevation={1}>
            <Avatar.Icon size={48} icon="clipboard-check-outline" style={styles.stateIcon} />
            <Text variant="titleSmall">No active queue tokens</Text>
            <Text variant="bodySmall" style={styles.stateText}>
              Checked-in patients will appear here from the shared OPD queue.
            </Text>
          </Surface>
        )}

        <Text variant="titleMedium" style={styles.sectionTitle}>
          Quick Actions
        </Text>
        <View style={styles.quickActions}>
          {enabledQuickActions.length > 0 ? (
            enabledQuickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickAction}
                onPress={() => navigation.navigate(action.route)}
              >
                <Avatar.Icon size={40} icon={action.icon} />
                <Text variant="labelMedium">{action.label}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Surface style={styles.statePanel} elevation={1}>
              <Avatar.Icon size={48} icon="shield-lock-outline" style={styles.stateIcon} />
              <Text variant="titleSmall">No enabled shortcuts</Text>
              <Text variant="bodySmall" style={styles.stateText}>
                Your role has no mobile workflow actions enabled.
              </Text>
            </Surface>
          )}
        </View>
      </ScrollView>

      {canFindPatients && (
        <FAB
          icon="account-search"
          style={styles.fab}
          onPress={() => navigation.navigate("PatientSearch")}
          label="Find"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    opacity: 0.6,
  },
  staffName: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  deptChip: {
    alignSelf: "flex-start",
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 24,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statAction: {
    width: "48%",
  },
  flowPanel: {
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
  },
  flowLabel: {
    opacity: 0.6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  flowChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  flowChip: {
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
  },
  statCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontWeight: "bold",
  },
  statLabel: {
    opacity: 0.6,
  },
  queueList: {
    gap: 12,
  },
  statePanel: {
    alignItems: "center",
    borderRadius: 12,
    gap: 8,
    padding: 20,
    width: "100%",
  },
  stateIcon: {
    backgroundColor: MEDBRAINS_COLORS.statusSuccessBg,
  },
  stateText: {
    opacity: 0.65,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: MEDBRAINS_COLORS.brand,
    borderRadius: 8,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    color: MEDBRAINS_COLORS.canvas,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickAction: {
    flexGrow: 1,
    minWidth: 96,
    width: "30%",
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: MEDBRAINS_COLORS.panel,
    borderRadius: 12,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
});
