import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Banner, Card, Chip, Text, useTheme } from "react-native-paper";
import { appService } from "../services/app.service";
import { mobileHomeStatusText, mobileHomeText } from "./homeText";

const APP_VERSION = "0.1.0";

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
        {mobileHomeStatusText(status)}
      </Text>
    </View>
  );
}

export function HomeScreen() {
  const theme = useTheme();
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: appService.health,
    refetchInterval: 10_000,
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View style={styles.header}>
        <Text variant="headlineLarge" style={styles.title}>
          {mobileHomeText("home.app.name")}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {mobileHomeText("home.app.subtitle")}
        </Text>
      </View>

      <Card style={styles.card}>
        <Card.Title title={mobileHomeText("home.health.system")} />
        <Card.Content>
          {isLoading && <ActivityIndicator size="small" />}

          {error && (
            <Banner visible icon="alert">
              {mobileHomeText("home.error.apiUnavailable")}
            </Banner>
          )}

          {data && (
            <View style={styles.statusList}>
              <StatusChip label={mobileHomeText("home.health.overall")} status={data.status} />
              <StatusChip label={mobileHomeText("home.health.postgres")} status={data.postgres} />
              <StatusChip label={mobileHomeText("home.health.yottadb")} status={data.yottadb} />
            </View>
          )}
        </Card.Content>
      </Card>

      <Text variant="bodySmall" style={styles.footer}>
        {mobileHomeText("home.footer", {
          organization: mobileHomeText("home.organization"),
          version: APP_VERSION,
        })}
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
