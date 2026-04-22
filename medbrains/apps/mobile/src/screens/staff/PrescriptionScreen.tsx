import { api } from "@medbrains/api";
import type { PrescriptionWithItems, PharmacyCatalog } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  FAB,
  IconButton,
  List,
  Portal,
  Searchbar,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface PrescriptionScreenProps {
  route: {
    params: {
      encounterId?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

interface PrescriptionItem {
  id?: string;
  drug_name: string;
  generic_name?: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions?: string;
}

const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "As needed", "Before meals", "After meals", "At bedtime"];
const ROUTES = ["Oral", "Topical", "IV", "IM", "SC", "Inhalation", "Sublingual", "Rectal"];
const DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "3 months", "Continuous"];

export function PrescriptionScreen({ route, navigation }: PrescriptionScreenProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { encounterId } = route.params;

  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [drugSearch, setDrugSearch] = useState("");
  const [currentItem, setCurrentItem] = useState<PrescriptionItem>({
    drug_name: "",
    dosage: "",
    frequency: FREQUENCIES[0] ?? "Once daily",
    duration: DURATIONS[2] ?? "7 days",
    route: ROUTES[0] ?? "Oral",
  });
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: existingPrescriptions, isLoading } = useQuery({
    queryKey: ["prescriptions", encounterId],
    queryFn: () => api.listPrescriptions(encounterId || ""),
    enabled: Boolean(encounterId),
  });

  const { data: drugCatalog } = useQuery({
    queryKey: ["pharmacy", "catalog", drugSearch],
    queryFn: () => api.listPharmacyCatalog({ search: drugSearch, page: "1", per_page: "10" }),
    enabled: drugSearch.length >= 2,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!encounterId || items.length === 0) throw new Error("No items to save");

      await api.createPrescription(encounterId, {
        items: items.map((item) => ({
          drug_name: item.drug_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          route: item.route,
          instructions: item.instructions,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      setSnackbar({ visible: true, message: "Prescription saved successfully" });
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: () => {
      setSnackbar({ visible: true, message: "Failed to save prescription" });
    },
  });

  const handleAddItem = () => {
    if (currentItem.drug_name && currentItem.dosage) {
      setItems([...items, { ...currentItem, id: Date.now().toString() }]);
      setCurrentItem({
        drug_name: "",
        dosage: "",
        frequency: FREQUENCIES[0] ?? "Once daily",
        duration: DURATIONS[2] ?? "7 days",
        route: ROUTES[0] ?? "Oral",
      });
      setDrugSearch("");
      setShowAddDialog(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleSelectDrug = (drug: PharmacyCatalog) => {
    setCurrentItem({
      ...currentItem,
      drug_name: drug.name,
      generic_name: drug.generic_name || undefined,
    });
    setDrugSearch("");
  };

  const handleCopyFromPrevious = (rx: PrescriptionWithItems) => {
    // Add items from the previous prescription
    const newItems = rx.items.map((item) => ({
      id: Date.now().toString() + Math.random().toString(),
      drug_name: item.drug_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route || "Oral",
      instructions: item.instructions || undefined,
    }));
    setItems([...items, ...newItems]);
    setSnackbar({ visible: true, message: "Added items from previous prescription" });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const drugList: PharmacyCatalog[] = drugCatalog || [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Previous Prescriptions */}
        {existingPrescriptions && existingPrescriptions.length > 0 && (
          <Card style={styles.previousCard}>
            <Card.Content>
              <Text variant="titleSmall" style={styles.previousTitle}>
                Previous Prescriptions
              </Text>
              <Divider style={styles.divider} />
              {existingPrescriptions.slice(0, 3).map((rx) => (
                <List.Item
                  key={rx.prescription.id}
                  title={`${rx.items.length} medication(s)`}
                  description={new Date(rx.prescription.created_at).toLocaleDateString()}
                  left={(props) => <List.Icon {...props} icon="pill" />}
                  right={() => (
                    <IconButton
                      icon="content-copy"
                      size={20}
                      onPress={() => handleCopyFromPrevious(rx)}
                    />
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Current Prescription Items */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Current Prescription
        </Text>

        {items.length > 0 ? (
          items.map((item, index) => (
            <Surface key={item.id} style={styles.itemCard} elevation={1}>
              <View style={styles.itemHeader}>
                <View style={styles.itemNumber}>
                  <Text style={styles.itemNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text variant="titleSmall" style={styles.drugName}>
                    {item.drug_name}
                  </Text>
                  {item.generic_name && (
                    <Text variant="bodySmall" style={styles.genericName}>
                      ({item.generic_name})
                    </Text>
                  )}
                </View>
                <IconButton
                  icon="close"
                  size={20}
                  onPress={() => handleRemoveItem(item.id || "")}
                />
              </View>
              <View style={styles.itemDetails}>
                <Chip compact icon="pill">{item.dosage}</Chip>
                <Chip compact icon="clock">{item.frequency}</Chip>
                <Chip compact icon="calendar">{item.duration}</Chip>
                <Chip compact icon="routes">{item.route}</Chip>
              </View>
              {item.instructions && (
                <Text variant="bodySmall" style={styles.instructions}>
                  Note: {item.instructions}
                </Text>
              )}
            </Surface>
          ))
        ) : (
          <Surface style={styles.emptyState} elevation={1}>
            <Avatar.Icon size={48} icon="pill" style={styles.emptyIcon} />
            <Text variant="bodyMedium" style={styles.emptyText}>
              No medications added yet
            </Text>
            <Text variant="bodySmall" style={styles.emptyHint}>
              Tap + to add medications
            </Text>
          </Surface>
        )}

        {/* Save Button */}
        {items.length > 0 && (
          <Button
            mode="contained"
            onPress={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={saveMutation.isPending}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
            icon="content-save"
          >
            Save Prescription ({items.length} item{items.length > 1 ? "s" : ""})
          </Button>
        )}
      </ScrollView>

      {/* Add FAB */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowAddDialog(true)}
        label="Add Drug"
      />

      {/* Add Drug Dialog */}
      <Portal>
        <Dialog visible={showAddDialog} onDismiss={() => setShowAddDialog(false)}>
          <Dialog.Title>Add Medication</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              {/* Drug Search */}
              <Searchbar
                placeholder="Search drug..."
                value={drugSearch}
                onChangeText={setDrugSearch}
                style={styles.drugSearch}
              />

              {drugList.length > 0 && (
                <View style={styles.drugResults}>
                  {drugList.map((drug) => (
                    <TouchableOpacity
                      key={drug.id}
                      onPress={() => handleSelectDrug(drug)}
                    >
                      <List.Item
                        title={drug.name}
                        description={drug.generic_name || undefined}
                        left={(props) => <List.Icon {...props} icon="pill" />}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {currentItem.drug_name && (
                <Chip style={styles.selectedDrug} icon="check">
                  {currentItem.drug_name}
                </Chip>
              )}

              <TextInput
                label="Drug Name"
                value={currentItem.drug_name}
                onChangeText={(v) => setCurrentItem({ ...currentItem, drug_name: v })}
                mode="outlined"
                style={styles.dialogInput}
              />

              <TextInput
                label="Dosage (e.g., 500mg)"
                value={currentItem.dosage}
                onChangeText={(v) => setCurrentItem({ ...currentItem, dosage: v })}
                mode="outlined"
                style={styles.dialogInput}
              />

              <Text variant="labelMedium" style={styles.dialogLabel}>Frequency</Text>
              <View style={styles.chipGroup}>
                {FREQUENCIES.slice(0, 4).map((freq) => (
                  <Chip
                    key={freq}
                    selected={currentItem.frequency === freq}
                    onPress={() => setCurrentItem({ ...currentItem, frequency: freq })}
                    style={styles.selectChip}
                  >
                    {freq}
                  </Chip>
                ))}
              </View>

              <Text variant="labelMedium" style={styles.dialogLabel}>Duration</Text>
              <View style={styles.chipGroup}>
                {DURATIONS.slice(0, 4).map((dur) => (
                  <Chip
                    key={dur}
                    selected={currentItem.duration === dur}
                    onPress={() => setCurrentItem({ ...currentItem, duration: dur })}
                    style={styles.selectChip}
                  >
                    {dur}
                  </Chip>
                ))}
              </View>

              <Text variant="labelMedium" style={styles.dialogLabel}>Route</Text>
              <View style={styles.chipGroup}>
                {ROUTES.slice(0, 4).map((rt) => (
                  <Chip
                    key={rt}
                    selected={currentItem.route === rt}
                    onPress={() => setCurrentItem({ ...currentItem, route: rt })}
                    style={styles.selectChip}
                  >
                    {rt}
                  </Chip>
                ))}
              </View>

              <TextInput
                label="Special Instructions (optional)"
                value={currentItem.instructions || ""}
                onChangeText={(v) => setCurrentItem({ ...currentItem, instructions: v })}
                mode="outlined"
                multiline
                style={styles.dialogInput}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleAddItem}
              disabled={!currentItem.drug_name || !currentItem.dosage}
            >
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
    paddingBottom: 100,
  },
  previousCard: {
    marginBottom: 24,
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
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
  },
  itemCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#228be6",
    justifyContent: "center",
    alignItems: "center",
  },
  itemNumberText: {
    color: "#fff",
    fontWeight: "bold",
  },
  itemInfo: {
    flex: 1,
  },
  drugName: {
    fontWeight: "600",
  },
  genericName: {
    opacity: 0.6,
  },
  itemDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  instructions: {
    marginTop: 8,
    fontStyle: "italic",
    opacity: 0.7,
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
  saveButton: {
    marginTop: 16,
    borderRadius: 12,
  },
  saveButtonContent: {
    paddingVertical: 8,
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
  dialogScroll: {
    maxHeight: 400,
  },
  drugSearch: {
    marginBottom: 12,
  },
  drugResults: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedDrug: {
    marginBottom: 12,
    backgroundColor: "#d3f9d8",
  },
  dialogInput: {
    marginBottom: 12,
  },
  dialogLabel: {
    marginBottom: 8,
    opacity: 0.7,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  selectChip: {
    marginBottom: 4,
  },
});
