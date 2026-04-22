import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { config } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";

interface PharmacyToken {
  token_number: number;
  patient_name: string;
  prescription_count: number;
  status: "waiting" | "preparing" | "ready" | "dispensed";
  counter?: number;
  estimated_wait_minutes?: number;
}

interface PharmacyUpdate {
  type: "pharmacy_update";
  current_token: PharmacyToken | null;
  preparing: PharmacyToken[];
  ready_for_pickup: PharmacyToken[];
  waiting: PharmacyToken[];
  stats: {
    waiting_count: number;
    ready_count: number;
    dispensed_today: number;
    avg_wait_minutes: number;
  };
}

function ReadyColumn({ tokens }: { tokens: PharmacyToken[] }) {
  return (
    <Surface style={styles.readyColumn} elevation={3}>
      <View style={styles.readyHeader}>
        <Text style={styles.readyTitle}>Ready for Pickup</Text>
        <View style={styles.readyBadge}>
          <Text style={styles.readyCount}>{tokens.length}</Text>
        </View>
      </View>
      <View style={styles.readyGrid}>
        {tokens.slice(0, 8).map((token) => (
          <Surface key={token.token_number} style={styles.readyToken} elevation={2}>
            <Text style={styles.readyTokenNumber}>{token.token_number}</Text>
            <Text style={styles.readyTokenName} numberOfLines={1}>
              {token.patient_name}
            </Text>
            {token.counter && (
              <Text style={styles.counterBadge}>Counter {token.counter}</Text>
            )}
          </Surface>
        ))}
      </View>
      {tokens.length > 8 && (
        <Text style={styles.moreText}>+{tokens.length - 8} more</Text>
      )}
    </Surface>
  );
}

export function PharmacyQueueScreen() {
  const [pharmacyData, setPharmacyData] = useState<PharmacyUpdate | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useWebSocket({
    url: `${config.wsBase}/pharmacy`,
    onMessage: (data) => {
      const update = data as PharmacyUpdate;
      if (update.type === "pharmacy_update") {
        setPharmacyData(update);
      }
    },
  });

  const stats = pharmacyData?.stats || {
    waiting_count: 0,
    ready_count: 0,
    dispensed_today: 0,
    avg_wait_minutes: 0,
  };
  const currentToken = pharmacyData?.current_token;
  const preparing = pharmacyData?.preparing || [];
  const readyTokens = pharmacyData?.ready_for_pickup || [];
  const waiting = pharmacyData?.waiting || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pharmacy</Text>
          <Text style={styles.subtitle}>Prescription Queue</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.waiting_count}</Text>
            <Text style={styles.statLabel}>Waiting</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: "#40c057" }]}>
              {stats.ready_count}
            </Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.dispensed_today}</Text>
            <Text style={styles.statLabel}>Dispensed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.avg_wait_minutes}</Text>
            <Text style={styles.statLabel}>Avg Wait</Text>
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
        {/* Current Token - Large Display */}
        <View style={styles.currentSection}>
          <Surface style={styles.currentCard} elevation={4}>
            <Text style={styles.currentLabel}>Now Serving</Text>
            {currentToken ? (
              <>
                <Text style={styles.currentNumber}>{currentToken.token_number}</Text>
                <Text style={styles.currentName}>{currentToken.patient_name}</Text>
                {currentToken.counter && (
                  <View style={styles.counterDisplay}>
                    <Text style={styles.counterText}>
                      Counter {currentToken.counter}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.noToken}>—</Text>
            )}
          </Surface>

          {/* Preparing */}
          <Surface style={styles.preparingCard} elevation={2}>
            <Text style={styles.preparingLabel}>Being Prepared</Text>
            <View style={styles.preparingList}>
              {preparing.slice(0, 4).map((token) => (
                <View key={token.token_number} style={styles.preparingItem}>
                  <Text style={styles.preparingNumber}>{token.token_number}</Text>
                  <Text style={styles.preparingRx}>
                    {token.prescription_count} Rx
                  </Text>
                </View>
              ))}
              {preparing.length === 0 && (
                <Text style={styles.emptyText}>None preparing</Text>
              )}
            </View>
          </Surface>
        </View>

        {/* Ready for Pickup */}
        <ReadyColumn tokens={readyTokens} />

        {/* Waiting List */}
        <Surface style={styles.waitingColumn} elevation={2}>
          <Text style={styles.waitingTitle}>Waiting</Text>
          <View style={styles.waitingList}>
            {waiting.slice(0, 12).map((token) => (
              <View key={token.token_number} style={styles.waitingItem}>
                <Text style={styles.waitingNumber}>{token.token_number}</Text>
              </View>
            ))}
            {waiting.length === 0 && (
              <Text style={styles.emptyText}>No one waiting</Text>
            )}
          </View>
          {waiting.length > 12 && (
            <Text style={styles.moreText}>+{waiting.length - 12} more</Text>
          )}
        </Surface>
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
    fontSize: 32,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#888888",
    fontSize: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 32,
  },
  stat: {
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
  currentSection: {
    width: 300,
    gap: 24,
  },
  currentCard: {
    backgroundColor: "#228be6",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
  },
  currentLabel: {
    color: "#ffffff",
    fontSize: 20,
    opacity: 0.8,
    marginBottom: 8,
  },
  currentNumber: {
    color: "#ffffff",
    fontSize: 96,
    fontWeight: "bold",
    lineHeight: 100,
  },
  currentName: {
    color: "#ffffff",
    fontSize: 24,
    marginTop: 8,
  },
  counterDisplay: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  counterText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  noToken: {
    color: "#ffffff",
    fontSize: 64,
    opacity: 0.3,
  },
  preparingCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
    flex: 1,
  },
  preparingLabel: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  preparingList: {
    gap: 8,
  },
  preparingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2a4e",
    padding: 12,
    borderRadius: 8,
  },
  preparingNumber: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
  preparingRx: {
    color: "#888888",
    fontSize: 14,
  },
  readyColumn: {
    flex: 1,
    backgroundColor: "#0a3a0a",
    borderRadius: 16,
    padding: 20,
  },
  readyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  readyTitle: {
    color: "#40c057",
    fontSize: 22,
    fontWeight: "bold",
  },
  readyBadge: {
    backgroundColor: "#40c057",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readyCount: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  readyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  readyToken: {
    backgroundColor: "#1a5a1a",
    borderRadius: 12,
    padding: 16,
    width: "48%",
    alignItems: "center",
  },
  readyTokenNumber: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "bold",
  },
  readyTokenName: {
    color: "#ffffff",
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  counterBadge: {
    color: "#40c057",
    fontSize: 12,
    marginTop: 4,
  },
  waitingColumn: {
    width: 200,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 16,
  },
  waitingTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  waitingList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  waitingItem: {
    backgroundColor: "#2a2a4e",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 50,
    alignItems: "center",
  },
  waitingNumber: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  emptyText: {
    color: "#666666",
    fontSize: 14,
    fontStyle: "italic",
  },
  moreText: {
    color: "#888888",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
});
