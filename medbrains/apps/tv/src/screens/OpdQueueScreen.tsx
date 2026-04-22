import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { config } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";

interface QueueToken {
  token_number: number;
  patient_name: string;
  department_name: string;
  doctor_name: string;
  status: "waiting" | "called" | "in_consultation" | "completed";
  counter?: string;
  called_at?: string;
}

interface QueueUpdate {
  type: "queue_update";
  department_id: string;
  current_token: QueueToken | null;
  next_tokens: QueueToken[];
  completed_count: number;
  waiting_count: number;
}

interface CurrentTokenCardProps {
  token: QueueToken | null;
  title: string;
  color: string;
}

function CurrentTokenCard({ token, title, color }: CurrentTokenCardProps) {
  return (
    <Surface style={[styles.currentCard, { backgroundColor: color }]} elevation={4}>
      <Text style={styles.cardTitle}>{title}</Text>
      {token ? (
        <>
          <Text style={styles.tokenNumber}>{token.token_number}</Text>
          <Text style={styles.patientName}>{token.patient_name}</Text>
          {token.counter && <Text style={styles.counterText}>Counter {token.counter}</Text>}
        </>
      ) : (
        <Text style={styles.noToken}>—</Text>
      )}
    </Surface>
  );
}

function WaitingList({ tokens }: { tokens: QueueToken[] }) {
  return (
    <Surface style={styles.waitingPanel} elevation={2}>
      <Text style={styles.sectionTitle}>Waiting</Text>
      <View style={styles.waitingGrid}>
        {tokens.slice(0, 12).map((token) => (
          <View key={token.token_number} style={styles.waitingToken}>
            <Text style={styles.waitingNumber}>{token.token_number}</Text>
          </View>
        ))}
        {tokens.length === 0 && (
          <Text style={styles.emptyText}>No patients waiting</Text>
        )}
      </View>
    </Surface>
  );
}

export function OpdQueueScreen() {
  const [queueData, setQueueData] = useState<QueueUpdate | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useWebSocket({
    url: `${config.wsBase}/queue`,
    onMessage: (data) => {
      const update = data as QueueUpdate;
      if (update.type === "queue_update") {
        setQueueData(update);
      }
    },
  });

  const currentToken = queueData?.current_token;
  const nextTokens = queueData?.next_tokens || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.hospitalName}>MedBrains Hospital</Text>
          <Text style={styles.departmentName}>OPD Queue Display</Text>
        </View>
        <View style={styles.timeContainer}>
          <Text style={styles.time}>
            {currentTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <Text style={styles.date}>
            {currentTime.toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Current Token - Large Display */}
        <View style={styles.currentSection}>
          <CurrentTokenCard
            token={currentToken || null}
            title="Now Serving"
            color="#228be6"
          />
          <CurrentTokenCard
            token={nextTokens[0] || null}
            title="Next"
            color="#40c057"
          />
        </View>

        {/* Waiting List */}
        <WaitingList tokens={nextTokens.slice(1)} />
      </View>

      {/* Footer Stats */}
      <View style={styles.footer}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{queueData?.waiting_count || 0}</Text>
          <Text style={styles.statLabel}>Waiting</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{queueData?.completed_count || 0}</Text>
          <Text style={styles.statLabel}>Completed Today</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a1a",
    padding: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  hospitalName: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
  },
  departmentName: {
    color: "#888888",
    fontSize: 20,
  },
  timeContainer: {
    alignItems: "flex-end",
  },
  time: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "bold",
  },
  date: {
    color: "#888888",
    fontSize: 18,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    gap: 24,
  },
  currentSection: {
    flex: 1,
    gap: 24,
  },
  currentCard: {
    flex: 1,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "600",
    opacity: 0.8,
    marginBottom: 8,
  },
  tokenNumber: {
    color: "#ffffff",
    fontSize: 120,
    fontWeight: "bold",
    lineHeight: 130,
  },
  patientName: {
    color: "#ffffff",
    fontSize: 28,
    marginTop: 8,
    opacity: 0.9,
  },
  counterText: {
    color: "#ffffff",
    fontSize: 20,
    marginTop: 8,
    opacity: 0.7,
  },
  noToken: {
    color: "#ffffff",
    fontSize: 80,
    opacity: 0.3,
  },
  waitingPanel: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 24,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  waitingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  waitingToken: {
    backgroundColor: "#2a2a4e",
    borderRadius: 8,
    padding: 16,
    minWidth: 80,
    alignItems: "center",
  },
  waitingNumber: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
  },
  emptyText: {
    color: "#666666",
    fontSize: 18,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 64,
    marginTop: 24,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#888888",
    fontSize: 16,
  },
});
