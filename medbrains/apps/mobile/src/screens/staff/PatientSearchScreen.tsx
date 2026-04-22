import { api } from "@medbrains/api";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Chip,
  Searchbar,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { PatientCard } from "../../components";

interface PatientSearchScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export function PatientSearchScreen({ navigation }: PatientSearchScreenProps) {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [recentSearches] = useState<string[]>(["UHID-2024-00001", "John", "9876543210"]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["patients", "search", search],
    queryFn: () =>
      api.listPatients({
        search,
        page: 1,
        per_page: 20,
      }),
    enabled: search.length >= 2,
  });

  const handlePatientPress = (patientId: string) => {
    navigation.navigate("PatientDetail", { patientId });
  };

  const handleRecentSearch = (term: string) => {
    setSearch(term);
  };

  const showResults = search.length >= 2;
  const patients = data?.patients || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search by UHID, name, phone..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          loading={isFetching}
          autoCapitalize="none"
        />
      </View>

      {/* Recent Searches (when not searching) */}
      {!showResults && (
        <View style={styles.recentSection}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Recent Searches
          </Text>
          <View style={styles.recentChips}>
            {recentSearches.map((term) => (
              <Chip
                key={term}
                onPress={() => handleRecentSearch(term)}
                style={styles.recentChip}
                icon="history"
              >
                {term}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions (when not searching) */}
      {!showResults && (
        <View style={styles.quickActions}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Quick Actions
          </Text>
          <View style={styles.actionsRow}>
            <Surface style={styles.actionCard} elevation={1}>
              <Avatar.Icon size={40} icon="account-plus" style={styles.actionIcon} />
              <Text variant="labelMedium">New Patient</Text>
            </Surface>
            <Surface style={styles.actionCard} elevation={1}>
              <Avatar.Icon size={40} icon="barcode-scan" style={styles.actionIcon} />
              <Text variant="labelMedium">Scan UHID</Text>
            </Surface>
            <Surface style={styles.actionCard} elevation={1}>
              <Avatar.Icon size={40} icon="qrcode-scan" style={styles.actionIcon} />
              <Text variant="labelMedium">QR Code</Text>
            </Surface>
          </View>
        </View>
      )}

      {/* Search Results */}
      {showResults && (
        <View style={styles.resultsContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                Searching patients...
              </Text>
            </View>
          ) : patients.length > 0 ? (
            <>
              <Text variant="labelMedium" style={styles.resultsCount}>
                {data?.total || patients.length} patient(s) found
              </Text>
              <FlatList
                data={patients}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <PatientCard
                    patient={{
                      id: item.id,
                      uhid: item.uhid,
                      first_name: item.first_name,
                      last_name: item.last_name,
                      gender: item.gender,
                      date_of_birth: item.date_of_birth ?? undefined,
                      phone: item.phone,
                    }}
                    onPress={() => handlePatientPress(item.id)}
                  />
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Avatar.Icon size={64} icon="account-search" style={styles.emptyIcon} />
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No patients found
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Try searching with different criteria
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    borderRadius: 12,
  },
  recentSection: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "600",
    opacity: 0.7,
  },
  recentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recentChip: {
    backgroundColor: "#f1f3f5",
  },
  quickActions: {
    padding: 16,
    paddingTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    backgroundColor: "#e7f5ff",
  },
  resultsContainer: {
    flex: 1,
  },
  resultsCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.6,
  },
  listContent: {
    paddingBottom: 16,
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
});
