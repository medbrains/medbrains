import { api } from "@medbrains/api";
import type { QueueEntry } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
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

type QueueFilter = "all" | "waiting" | "called" | "in_progress";

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

export function QueueScreen({ route, navigation }: QueueScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const departmentId = route?.params?.departmentId;

  const [filter, setFilter] = useState<QueueFilter>("all");

  // listQueue returns QueueEntry[] directly and takes Record<string, string>
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["queue", departmentId, filter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (departmentId) params.department_id = departmentId;
      if (filter !== "all") {
        params.status = filter === "in_progress" ? "in_consultation" : filter;
      }
      return api.listQueue(params);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const callMutation = useMutation({
    mutationFn: (id: string) => api.callQueueEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.startConsultation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.completeQueueEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => api.markNoShow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
  });

  // API returns QueueEntry[] directly
  const queueItems: QueueEntry[] = data || [];
  const stats = {
    waiting: queueItems.filter((i) => i.status === "waiting").length,
    called: queueItems.filter((i) => i.status === "called").length,
    inProgress: queueItems.filter((i) => i.status === "in_consultation").length,
  };

  const handleQueueItemAction = (
    action: "call" | "start" | "complete" | "noShow",
    item: QueueEntry
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
          <Text style={[styles.statValue, { color: "#868e96" }]}>{stats.waiting}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            Waiting
          </Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: "#228be6" }]}>{stats.called}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            Called
          </Text>
        </Surface>
        <Surface style={styles.statCard} elevation={1}>
          <Text style={[styles.statValue, { color: "#40c057" }]}>{stats.inProgress}</Text>
          <Text variant="labelSmall" style={styles.statLabel}>
            In Progress
          </Text>
        </Surface>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={filter}
          onValueChange={(value) => setFilter(value as QueueFilter)}
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
          renderItem={({ item }) => (
            <QueueItem
              item={{
                id: item.id,
                token_number: item.token_number,
                patient_name: item.patient_name,
                uhid: item.uhid,
                status: item.status as "waiting" | "called" | "in_consultation" | "completed" | "no_show",
                // Calculate wait time from called_at if available
                wait_time_minutes: item.called_at
                  ? Math.floor((Date.now() - new Date(item.called_at).getTime()) / 60000)
                  : undefined,
              }}
              onCall={() => handleQueueItemAction("call", item)}
              onStart={() => handleQueueItemAction("start", item)}
              onComplete={() => handleQueueItemAction("complete", item)}
              onNoShow={() => handleQueueItemAction("noShow", item)}
            />
          )}
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
              {queueItems.find((i) => i.status === "in_consultation")?.patient_name || "Patient"}
            </Text>
          </View>
          <Badge style={styles.tokenBadge}>
            {`#${queueItems.find((i) => i.status === "in_consultation")?.token_number ?? ""}`}
          </Badge>
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
    backgroundColor: "#f1f3f5",
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
    backgroundColor: "#d3f9d8",
    gap: 12,
  },
  bannerIcon: {
    backgroundColor: "#40c057",
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontWeight: "600",
  },
  tokenBadge: {
    backgroundColor: "#40c057",
    fontSize: 14,
  },
});
