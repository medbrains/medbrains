import { useAuthStore } from "@medbrains/stores";
import type { QueueEntry } from "@medbrains/types";
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

type MobileQueueStatus = "waiting" | "called" | "in_consultation" | "completed" | "no_show";
type StaffDashboardRoute =
  | "PatientSearch"
  | "Queue"
  | "Vitals"
  | "Prescription"
  | "LabResultsView"
  | "PatientDetail";

interface StaffDashboardProps {
  navigation: {
    navigate: (screen: StaffDashboardRoute, params?: Record<string, unknown>) => void;
  };
}

interface StatCard {
  id: string;
  label: string;
  value: number;
  icon: string;
  color: string;
}

function StatCardItem({ stat }: { stat: StatCard }) {
  return (
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

function queueItemView(item: QueueEntry) {
  return {
    id: item.id,
    token_number: item.token_number,
    patient_name: item.patient_name ?? "Unknown patient",
    uhid: item.uhid ?? "No UHID",
    status: toMobileQueueStatus(item.status),
    wait_time_minutes: elapsedMinutesSince(item.queue_date),
  };
}

export function StaffDashboard({ navigation }: StaffDashboardProps) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);

  const { data, isError, isFetching, isLoading, refetch } = useStaffDashboardQueueQuery();
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
      label: "Tokens Today",
      value: stats.total,
      icon: "account-group",
      color: MEDBRAINS_COLORS.brand,
    },
    {
      id: "waiting",
      label: "Waiting",
      value: stats.waiting,
      icon: "clock-outline",
      color: MEDBRAINS_COLORS.statusWarning,
    },
    {
      id: "active",
      label: "Active",
      value: stats.active,
      icon: "account-clock",
      color: MEDBRAINS_COLORS.statusInfo,
    },
    {
      id: "completed",
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

  const handleStartConsultation = (item: QueueEntry) => {
    startMutation.mutate(item.id, {
      onSuccess: () => navigation.navigate("PatientDetail", { patientId: item.patient_id }),
    });
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
          {todayStats.map((stat) => (
            <StatCardItem key={stat.id} stat={stat} />
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Current Queue</Text>
          <Badge size={24}>{stats.waiting}</Badge>
        </View>

        {isLoading ? (
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
            {activeQueueItems.map((item) => (
              <QueueItem
                key={item.id}
                item={queueItemView(item)}
                onCall={() => callMutation.mutate(item.id)}
                onStart={() => handleStartConsultation(item)}
                onComplete={() => completeMutation.mutate(item.id)}
                onNoShow={() => noShowMutation.mutate(item.id)}
                compact
              />
            ))}
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
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate("Queue")}>
            <Avatar.Icon size={40} icon="clipboard-list" />
            <Text variant="labelMedium">Full Queue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate("PatientSearch")}
          >
            <Avatar.Icon size={40} icon="account-search" />
            <Text variant="labelMedium">Find Patient</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate("Vitals")}
          >
            <Avatar.Icon size={40} icon="heart-pulse" />
            <Text variant="labelMedium">Vitals</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate("Prescription")}
          >
            <Avatar.Icon size={40} icon="file-document-edit" />
            <Text variant="labelMedium">Write Rx</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => navigation.navigate("LabResultsView")}
          >
            <Avatar.Icon size={40} icon="flask" />
            <Text variant="labelMedium">Lab Results</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FAB
        icon="account-search"
        style={styles.fab}
        onPress={() => navigation.navigate("PatientSearch")}
        label="Find"
      />
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
  statCard: {
    width: "48%",
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
