import { useFieldAccess } from "@medbrains/stores";
import type { QueueEntry } from "@medbrains/types";
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  SegmentedButtons,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { QueueItem } from "../../components";
import {
  type QueueFilter,
  useCallQueueEntryMutation,
  useCompleteQueueEntryMutation,
  useMarkNoShowMutation,
  useQueueQuery,
  useStartConsultationMutation,
} from "../../services/queue.queries";
import { MEDBRAINS_COLORS } from "../../theme/paper-theme";
import { protectedQueueIdentity, queuePatientNameAccess } from "../../utils/queue-privacy";

type MobileQueueStatus = "waiting" | "called" | "in_consultation" | "completed" | "no_show";

const QUEUE_FILTERS = new Set<string>(["all", "waiting", "called", "in_progress"]);

interface QueueScreenProps {
  route?: {
    params?: {
      departmentId?: string;
    };
  };
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
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

function isQueueFilter(value: string): value is QueueFilter {
  return QUEUE_FILTERS.has(value);
}

export function QueueScreen({ route, navigation }: QueueScreenProps) {
  const theme = useTheme();
  const departmentId = route?.params?.departmentId;
  const firstNameAccess = useFieldAccess("patients.first_name");
  const middleNameAccess = useFieldAccess("patients.middle_name");
  const lastNameAccess = useFieldAccess("patients.last_name");
  const uhidAccess = useFieldAccess("patients.uhid");
  const patientNameAccess = queuePatientNameAccess(
    firstNameAccess,
    middleNameAccess,
    lastNameAccess,
  );

  const [filter, setFilter] = useState<QueueFilter>("all");

  const { data, isLoading, refetch } = useQueueQuery({ departmentId, filter });
  const callMutation = useCallQueueEntryMutation();
  const startMutation = useStartConsultationMutation();
  const completeMutation = useCompleteQueueEntryMutation();
  const noShowMutation = useMarkNoShowMutation();

  // API returns QueueEntry[] directly
  const queueItems: QueueEntry[] = data || [];
  const stats = {
    waiting: queueItems.filter((i) => i.status === "waiting").length,
    called: queueItems.filter((i) => i.status === "called").length,
    inProgress: queueItems.filter((i) => i.status === "in_consultation").length,
  };
  const currentPatient = queueItems.find((i) => i.status === "in_consultation");
  const currentPatientIdentity = currentPatient
    ? protectedQueueIdentity(currentPatient, { name: patientNameAccess, uhid: uhidAccess })
    : null;

  const handleQueueItemAction = (
    action: "call" | "start" | "complete" | "noShow",
    item: QueueEntry,
  ) => {
    switch (action) {
      case "call":
        callMutation.mutate(item.id);
        break;
      case "start":
        startMutation.mutate(item.id);
        navigation.navigate("PatientDetail", { patientId: item.patient_id });
        break;
      case "complete":
        completeMutation.mutate(item.id);
        break;
      case "noShow":
        noShowMutation.mutate(item.id);
        break;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: MEDBRAINS_COLORS.muted }]}>{stats.waiting}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            Waiting
          </Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: MEDBRAINS_COLORS.brand }]}>{stats.called}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            Called
          </Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: MEDBRAINS_COLORS.emerald }]}>
            {stats.inProgress}
          </Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            In Progress
          </Text>
        </Surface>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => {
            if (isQueueFilter(value)) setFilter(value);
          }}
          buttons={[
            { value: "all", label: "All" },
            { value: "waiting", label: "Waiting" },
            { value: "called", label: "Called" },
            { value: "in_progress", label: "Active" },
          ]}
          style={styles.segmented}
        />
      </View>

      {/* Queue List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text variant="bodyMedium" style={styles.loadingText}>
            Loading queue...
          </Text>
        </View>
      ) : queueItems.length > 0 ? (
        <FlatList
          data={queueItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const identity = protectedQueueIdentity(item, {
              name: patientNameAccess,
              uhid: uhidAccess,
            });

            return (
              <QueueItem
                item={{
                  id: item.id,
                  token_number: item.token_number,
                  patient_name: identity.patient_name,
                  uhid: identity.uhid,
                  status: toMobileQueueStatus(item.status),
                  wait_time_minutes: item.called_at
                    ? Math.floor((Date.now() - new Date(item.called_at).getTime()) / 60000)
                    : undefined,
                }}
                onCall={() => handleQueueItemAction("call", item)}
                onStart={() => handleQueueItemAction("start", item)}
                onComplete={() => handleQueueItemAction("complete", item)}
                onNoShow={() => handleQueueItemAction("noShow", item)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="clipboard-list-outline" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No patients in queue
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {filter === "all"
              ? "The queue is empty. Patients will appear here when they check in."
              : `No patients with "${filter}" status.`}
          </Text>
        </View>
      )}

      {/* Current Patient Indicator */}
      {stats.inProgress > 0 && (
        <Surface style={styles.currentPatientBanner} elevation={3}>
          <Avatar.Icon size={32} icon="account-check" style={styles.bannerIcon} />
          <View style={styles.bannerText}>
            <Text variant="labelMedium">Currently seeing</Text>
            <Text variant="titleSmall" style={styles.bannerTitle}>
              {currentPatientIdentity?.patient_name ?? "Patient"}
            </Text>
          </View>
          <Badge style={styles.tokenBadge}>{`#${currentPatient?.token_number ?? ""}`}</Badge>
        </Surface>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
  },
  statLabel: {
    opacity: 0.6,
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  segmented: {
    borderRadius: 12,
  },
  listContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  emptyIcon: {
    backgroundColor: MEDBRAINS_COLORS.panel,
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: "600",
  },
  emptyText: {
    opacity: 0.6,
    textAlign: "center",
  },
  currentPatientBanner: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: MEDBRAINS_COLORS.statusSuccessBg,
    gap: 12,
  },
  bannerIcon: {
    backgroundColor: MEDBRAINS_COLORS.emerald,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontWeight: "600",
  },
  tokenBadge: {
    backgroundColor: MEDBRAINS_COLORS.emerald,
    fontSize: 14,
  },
});
