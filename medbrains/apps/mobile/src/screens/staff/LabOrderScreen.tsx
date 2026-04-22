import { api } from "@medbrains/api";
import type { LabTestCatalog, LabOrder, LabPriority } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  List,
  Searchbar,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface LabOrderScreenProps {
  route: {
    params: {
      encounterId?: string;
      patientId?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

interface SelectedTest {
  id: string;
  name: string;
  code: string;
  category?: string;
  price?: number;
  tat_hours?: number;
}

const COMMON_TESTS: SelectedTest[] = [
  { id: "cbc", name: "Complete Blood Count", code: "CBC", category: "Hematology" },
  { id: "lft", name: "Liver Function Test", code: "LFT", category: "Biochemistry" },
  { id: "rft", name: "Renal Function Test", code: "RFT", category: "Biochemistry" },
  { id: "lipid", name: "Lipid Profile", code: "LIPID", category: "Biochemistry" },
  { id: "thyroid", name: "Thyroid Profile", code: "TFT", category: "Hormones" },
  { id: "hba1c", name: "HbA1c", code: "HBA1C", category: "Diabetes" },
  { id: "urine", name: "Urine Routine", code: "URINE", category: "Clinical Pathology" },
  { id: "ecg", name: "ECG", code: "ECG", category: "Cardiology" },
];

export function LabOrderScreen({ route, navigation }: LabOrderScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId, patientId } = route.params;

  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [testSearch, setTestSearch] = useState("");
  const [priority, setPriority] = useState<LabPriority>("routine");
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: labCatalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["lab", "catalog", testSearch],
    queryFn: () => api.listLabCatalog({ search: testSearch, page: "1", per_page: "20" }),
    enabled: testSearch.length >= 2,
  });

  const { data: existingOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["lab", "orders", patientId],
    queryFn: () => api.listLabOrders({ patient_id: patientId || "", page: "1", per_page: "5" }),
    enabled: Boolean(patientId),
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!patientId || selectedTests.length === 0) throw new Error("No tests selected");

      // Create orders for each selected test
      for (const test of selectedTests) {
        await api.createLabOrder({
          patient_id: patientId,
          encounter_id: encounterId,
          test_id: test.id,
          priority,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab", "orders"] });
      setSnackbar({ visible: true, message: "Lab order(s) created successfully" });
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: () => {
      setSnackbar({ visible: true, message: "Failed to create lab order" });
    },
  });

  const handleAddTest = (test: SelectedTest) => {
    if (!selectedTests.find((t) => t.id === test.id)) {
      setSelectedTests([...selectedTests, test]);
    }
    setTestSearch("");
  };

  const handleAddFromCatalog = (test: LabTestCatalog) => {
    handleAddTest({
      id: test.id,
      name: test.name,
      code: test.code,
      // LabTestCatalog has department_id, not category
      category: test.sample_type || undefined,
      price: test.price ? parseFloat(test.price) : undefined,
      tat_hours: test.tat_hours || undefined,
    });
  };

  const handleRemoveTest = (testId: string) => {
    setSelectedTests(selectedTests.filter((t) => t.id !== testId));
  };

  const totalPrice = selectedTests.reduce((sum, t) => sum + (t.price || 0), 0);

  if (ordersLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const catalogList: LabTestCatalog[] = labCatalog || [];
  const ordersList: LabOrder[] = existingOrders?.orders || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search Tests */}
        <Searchbar
          placeholder="Search tests..."
          value={testSearch}
          onChangeText={setTestSearch}
          style={styles.searchbar}
        />

        {/* Search Results */}
        {testSearch.length >= 2 && (
          <Surface style={styles.searchResults} elevation={2}>
            {catalogLoading ? (
              <ActivityIndicator style={styles.searchLoading} />
            ) : catalogList.length > 0 ? (
              catalogList.map((test) => (
                <List.Item
                  key={test.id}
                  title={test.name}
                  description={`${test.code} • ${test.sample_type || "General"}`}
                  left={(props) => <List.Icon {...props} icon="flask" />}
                  right={() => (
                    <IconButton
                      icon={selectedTests.find((t) => t.id === test.id) ? "check" : "plus"}
                      onPress={() => handleAddFromCatalog(test)}
                    />
                  )}
                  onPress={() => handleAddFromCatalog(test)}
                />
              ))
            ) : (
              <Text style={styles.noResults}>No tests found</Text>
            )}
          </Surface>
        )}

        {/* Quick Add - Common Tests */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Common Tests
        </Text>
        <View style={styles.commonTests}>
          {COMMON_TESTS.map((test) => (
            <Chip
              key={test.id}
              onPress={() => handleAddTest(test)}
              selected={selectedTests.some((t) => t.id === test.id)}
              style={styles.commonChip}
              icon={selectedTests.some((t) => t.id === test.id) ? "check" : "plus"}
            >
              {test.name}
            </Chip>
          ))}
        </View>

        {/* Priority Selection */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Priority
        </Text>
        <View style={styles.priorityRow}>
          <Chip
            selected={priority === "routine"}
            onPress={() => setPriority("routine")}
            style={styles.priorityChip}
          >
            Routine
          </Chip>
          <Chip
            selected={priority === "urgent"}
            onPress={() => setPriority("urgent")}
            style={[styles.priorityChip, priority === "urgent" && styles.urgentChip]}
          >
            Urgent
          </Chip>
          <Chip
            selected={priority === "stat"}
            onPress={() => setPriority("stat")}
            style={[styles.priorityChip, priority === "stat" && styles.statChip]}
          >
            STAT
          </Chip>
        </View>

        {/* Selected Tests */}
        <View style={styles.selectedHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Selected Tests
          </Text>
          {selectedTests.length > 0 && (
            <Badge size={24}>{selectedTests.length}</Badge>
          )}
        </View>

        {selectedTests.length > 0 ? (
          <>
            {selectedTests.map((test) => (
              <Surface key={test.id} style={styles.testCard} elevation={1}>
                <View style={styles.testInfo}>
                  <Text variant="titleSmall" style={styles.testName}>
                    {test.name}
                  </Text>
                  <View style={styles.testMeta}>
                    <Chip compact>{test.code}</Chip>
                    {test.category && <Chip compact>{test.category}</Chip>}
                    {test.tat_hours && (
                      <Chip compact icon="clock">
                        {test.tat_hours}h TAT
                      </Chip>
                    )}
                  </View>
                </View>
                {test.price !== undefined && test.price > 0 && (
                  <Text variant="labelLarge" style={styles.testPrice}>
                    ₹{test.price}
                  </Text>
                )}
                <IconButton
                  icon="close"
                  size={20}
                  onPress={() => handleRemoveTest(test.id)}
                />
              </Surface>
            ))}

            {/* Total */}
            {totalPrice > 0 && (
              <Surface style={styles.totalCard} elevation={1}>
                <Text variant="titleMedium">Total</Text>
                <Text variant="headlineSmall" style={styles.totalAmount}>
                  ₹{totalPrice}
                </Text>
              </Surface>
            )}
          </>
        ) : (
          <Surface style={styles.emptyState} elevation={1}>
            <Avatar.Icon size={48} icon="flask-outline" style={styles.emptyIcon} />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No tests selected
            </Text>
            <Text variant="bodySmall" style={styles.emptyHint}>
              Search or tap common tests to add
            </Text>
          </Surface>
        )}

        {/* Previous Orders */}
        {ordersList.length > 0 && (
          <Card style={styles.previousCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.previousTitle}>
                Recent Lab Orders
              </Text>
              <Divider style={styles.divider} />
              {ordersList.slice(0, 3).map((order) => (
                <List.Item
                  key={order.id}
                  title="Lab Order"
                  description={`${order.status} • ${new Date(order.created_at).toLocaleDateString()}`}
                  left={(props) => <List.Icon {...props} icon="flask" />}
                  right={() => (
                    <Chip
                      compact
                      style={order.status === "completed" ? styles.completedChip : undefined}
                    >
                      {order.status}
                    </Chip>
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Submit Button */}
        {selectedTests.length > 0 && (
          <Button
            mode="contained"
            onPress={() => createOrderMutation.mutate()}
            loading={createOrderMutation.isPending}
            disabled={createOrderMutation.isPending}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            icon="flask-plus"
          >
            Place Lab Order ({selectedTests.length} test{selectedTests.length > 1 ? "s" : ""})
          </Button>
        )}
      </ScrollView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ ...snackbar, visible: false })}
        duration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  searchbar: {
    borderRadius: 12,
    marginBottom: 16,
  },
  searchResults: {
    borderRadius: 12,
    marginBottom: 16,
    maxHeight: 200,
  },
  searchLoading: {
    padding: 16,
  },
  noResults: {
    padding: 16,
    textAlign: "center",
    opacity: 0.6,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  commonTests: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  commonChip: {
    marginBottom: 4,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  priorityChip: {
    flex: 1,
  },
  urgentChip: {
    backgroundColor: "#fff3bf",
  },
  statChip: {
    backgroundColor: "#ffe3e3",
  },
  selectedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  testCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  testInfo: {
    flex: 1,
  },
  testName: {
    fontWeight: "600",
  },
  testMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  testPrice: {
    color: "#228be6",
    marginRight: 8,
  },
  totalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "#e7f5ff",
  },
  totalAmount: {
    fontWeight: "bold",
    color: "#228be6",
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    backgroundColor: "#f1f3f5",
  },
  emptyText: {
    opacity: 0.6,
  },
  emptyHint: {
    opacity: 0.4,
  },
  previousCard: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
  },
  previousTitle: {
    fontWeight: "600",
    opacity: 0.7,
  },
  divider: {
    marginVertical: 8,
  },
  completedChip: {
    backgroundColor: "#d3f9d8",
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 12,
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
});
