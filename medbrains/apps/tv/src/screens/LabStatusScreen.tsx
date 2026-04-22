import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ProgressBar, Surface, Text } from "react-native-paper";
import { config } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";

interface LabSample {
  id: string;
  sample_id: string;
  patient_name: string;
  test_name: string;
  status: "ordered" | "sample_collected" | "processing" | "completed" | "verified";
  priority: "routine" | "urgent" | "stat";
  ordered_at: string;
  estimated_completion?: string;
  progress: number; // 0-100
}

interface LabUpdate {
  type: "lab_update";
  samples: LabSample[];
  stats: {
    pending: number;
    in_progress: number;
    completed_today: number;
    avg_tat_minutes: number;
  };
}

const STATUS_LABELS: Record<LabSample["status"], string> = {
  ordered: "Ordered",
  sample_collected: "Sample Collected",
  processing: "Processing",
  completed: "Completed",
  verified: "Verified & Ready",
};

const PRIORITY_COLORS: Record<LabSample["priority"], string> = {
  routine: "#868e96",
  urgent: "#fab005",
  stat: "#fa5252",
};

function SampleCard({ sample }: { sample: LabSample }) {
  const priorityColor = PRIORITY_COLORS[sample.priority];
  const isUrgent = sample.priority !== "routine";

  return (
    <Surface
      style={[
        styles.sampleCard,
        isUrgent && { borderLeftColor: priorityColor, borderLeftWidth: 4 },
      ]}
      elevation={2}
    >
      <View style={styles.sampleHeader}>
        <View>
          <Text style={styles.sampleId}>{sample.sample_id}</Text>
          <Text style={styles.patientName}>{sample.patient_name}</Text>
        </View>
        {isUrgent && (
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
            <Text style={styles.priorityText}>{sample.priority.toUpperCase()}</Text>
          </View>
        )}
      </View>
      <Text style={styles.testName}>{sample.test_name}</Text>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>{STATUS_LABELS[sample.status]}</Text>
        <Text style={styles.progressText}>{sample.progress}%</Text>
      </View>
      <ProgressBar
        progress={sample.progress / 100}
        color={sample.status === "verified" ? "#40c057" : "#228be6"}
        style={styles.progressBar}
      />
    </Surface>
  );
}

export function LabStatusScreen() {
  const [labData, setLabData] = useState<LabUpdate | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useWebSocket({
    url: `${config.wsBase}/lab`,
    onMessage: (data) => {
      const update = data as LabUpdate;
      if (update.type === "lab_update") {
        setLabData(update);
      }
    },
  });

  const stats = labData?.stats || {
    pending: 0,
    in_progress: 0,
    completed_today: 0,
    avg_tat_minutes: 0,
  };

  // Group samples by status
  const inProgress = labData?.samples.filter(
    (s) => s.status === "processing" || s.status === "sample_collected"
  ) || [];
  const completed = labData?.samples.filter(
    (s) => s.status === "completed" || s.status === "verified"
  ) || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Laboratory Status</Text>
          <Text style={styles.subtitle}>Real-time sample tracking</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#fab005" }]}>
              {stats.pending}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#228be6" }]}>
              {stats.in_progress}
            </Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#40c057" }]}>
              {stats.completed_today}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.avg_tat_minutes}</Text>
            <Text style={styles.statLabel}>Avg TAT (min)</Text>
          </View>
        </View>
        <Text style={styles.time}>
          {currentTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* In Progress Column */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>In Progress</Text>
          <ScrollView style={styles.sampleList}>
            {inProgress.map((sample) => (
              <SampleCard key={sample.id} sample={sample} />
            ))}
            {inProgress.length === 0 && (
              <Text style={styles.emptyText}>No samples in progress</Text>
            )}
          </ScrollView>
        </View>

        {/* Completed Column */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Ready for Collection</Text>
          <ScrollView style={styles.sampleList}>
            {completed.map((sample) => (
              <SampleCard key={sample.id} sample={sample} />
            ))}
            {completed.length === 0 && (
              <Text style={styles.emptyText}>No samples ready</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a1a",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#888888",
    fontSize: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 32,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#888888",
    fontSize: 14,
  },
  time: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    gap: 24,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  sampleList: {
    flex: 1,
  },
  sampleCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sampleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  sampleId: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  patientName: {
    color: "#888888",
    fontSize: 14,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  testName: {
    color: "#ffffff",
    fontSize: 16,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statusText: {
    color: "#888888",
    fontSize: 14,
  },
  progressText: {
    color: "#888888",
    fontSize: 14,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2a2a4e",
  },
  emptyText: {
    color: "#666666",
    fontSize: 16,
    textAlign: "center",
    marginTop: 32,
  },
});
