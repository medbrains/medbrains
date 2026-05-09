import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Banner, Card, Chip, Text, useTheme } from "react-native-paper";

function StatusChip({ label, status }: { label: string; status: string }) {
  const isConnected = status === "connected" || status === "ok";
  return (
    <View style={styles.chipRow}>
      <Chip
        icon={isConnected ? "check-circle" : "alert-circle"}
        mode="outlined"
        selectedColor={isConnected ? "#10b981" : "#C8102E"}
      >
        {label}
      </Chip>
      <Text variant="bodySmall" style={styles.statusText}>
        {status}
      </Text>
    </View>
  );
}

export function HomeScreen() {
  const theme = useTheme();
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 10_000,
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={styles.header}>
        <Text variant="headlineLarge" style={styles.title}>
          MedBrains
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Hospital Management System
        </Text>
      </View>

      <Card style={styles.card}>
        <Card.Title title="System Health" />
        <Card.Content>
          {isLoading && <ActivityIndicator size="small" />}

          {error && (
            <Banner visible icon="alert">
              Unable to reach API server. Is the backend running?
            </Banner>
          )}

          {data && (
            <View style={styles.statusList}>
              <StatusChip label="Overall" status={data.status} />
              <StatusChip label="PostgreSQL" status={data.postgres} />
              <StatusChip label="YottaDB" status={data.yottadb} />
            </View>
          )}
        </Card.Content>
      </Card>

      <Text variant="bodySmall" style={styles.footer}>
        v0.1.0 · Alagappa Group of Institutions
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontWeight: "bold",
  },
  subtitle: {
    opacity: 0.6,
    marginTop: 4,
  },
  card: {
    width: "100%",
    maxWidth: 400,
  },
  statusList: {
    gap: 12,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    opacity: 0.6,
  },
  footer: {
    opacity: 0.5,
    marginTop: 24,
  },
});
