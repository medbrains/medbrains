import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { mostRestrictedFieldAccess } from "@medbrains/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar, Searchbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { PatientCard } from "../../components";
import {
  MOBILE_PATIENT_SEARCH_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
import { patientService } from "../../services/patient.service";

interface PatientSearchScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}
const PATIENT_SEARCH_TEXT = MOBILE_PATIENT_SEARCH_TEXT;

function patientSearchText(
  key: string,
  values?: Record<string, string | number | boolean>,
): string {
  return mobilePatientJourneyText(key, values);
}

function patientResultCountText(count: number): string {
  const key =
    count === 1
      ? PATIENT_SEARCH_TEXT.results.countSingular
      : PATIENT_SEARCH_TEXT.results.countPlural;
  return patientSearchText(key, { count });
}

export function PatientSearchScreen({ navigation }: PatientSearchScreenProps) {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const canSearchPatients = useHasPermission(P.PATIENTS.LIST);
  const firstNameAccess = useFieldAccess("patients.first_name");
  const middleNameAccess = useFieldAccess("patients.middle_name");
  const lastNameAccess = useFieldAccess("patients.last_name");
  const patientNameAccess = mostRestrictedFieldAccess([
    firstNameAccess,
    middleNameAccess,
    lastNameAccess,
  ]);
  const uhidAccess = useFieldAccess("patients.uhid");
  const phoneAccess = useFieldAccess("patients.phone");
  const dobAccess = useFieldAccess("patients.date_of_birth");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["patients", "search", search],
    queryFn: () =>
      patientService.listPatients({
        search,
        page: 1,
        per_page: 20,
      }),
    enabled: canSearchPatients && search.length >= 2,
  });

  const handlePatientPress = (patientId: string) => {
    navigation.navigate("PatientDetail", { patientId });
  };

  const showResults = search.length >= 2;
  const patients = data?.patients || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={patientSearchText(PATIENT_SEARCH_TEXT.search.placeholder)}
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          loading={isFetching}
          autoCapitalize="none"
          editable={canSearchPatients}
        />
      </View>

      {!canSearchPatients && (
        <View style={styles.restrictedContainer}>
          <Avatar.Icon size={64} icon="shield-lock-outline" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            {patientSearchText(PATIENT_SEARCH_TEXT.restricted.title)}
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            {patientSearchText(PATIENT_SEARCH_TEXT.restricted.message)}
          </Text>
        </View>
      )}

      {/* Search hint (when not searching) */}
      {!showResults && canSearchPatients && (
        <View style={styles.searchHintSection}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            {patientSearchText(PATIENT_SEARCH_TEXT.search.title)}
          </Text>
          <Text variant="bodySmall" style={styles.searchHint}>
            {patientSearchText(PATIENT_SEARCH_TEXT.search.hint)}
          </Text>
        </View>
      )}

      {/* Search Results */}
      {showResults && canSearchPatients && (
        <View style={styles.resultsContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text variant="bodyMedium" style={styles.loadingText}>
                {patientSearchText(PATIENT_SEARCH_TEXT.loading.patients)}
              </Text>
            </View>
          ) : patients.length > 0 ? (
            <>
              <Text variant="labelMedium" style={styles.resultsCount}>
                {patientResultCountText(data?.total || patients.length)}
              </Text>
              <FlatList
                data={patients}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <PatientCard
                    access={{
                      dateOfBirth: dobAccess,
                      name: patientNameAccess,
                      phone: phoneAccess,
                      uhid: uhidAccess,
                    }}
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
                {patientSearchText(PATIENT_SEARCH_TEXT.empty.title)}
              </Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                {patientSearchText(PATIENT_SEARCH_TEXT.empty.message)}
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
  searchHintSection: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: "600",
    opacity: 0.7,
  },
  searchHint: {
    opacity: 0.6,
  },
  restrictedContainer: {
    alignItems: "center",
    gap: 8,
    padding: 32,
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
