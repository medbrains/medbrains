import { BarcodeScanner } from "@medbrains/mobile-shell";
import { useHasPermission } from "@medbrains/stores";
import type { LabHomeCollection } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Divider,
  List,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { assignBarcode, canComplete } from "../../lib/specimen.js";
import { phlebotomyService } from "../../services/phlebotomy.service";
import { mobilePhlebotomyText } from "./phlebotomyText";

interface SampleCollectionScreenProps {
  route: {
    params: {
      orderId: string;
    };
  };
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

interface CollectedSample {
  sampleId: string;
  barcode: string;
  collected: boolean;
}

function confirmMessage(sampleCount: number, collectionId: string): string {
  return mobilePhlebotomyText(
    sampleCount === 1
      ? "phlebotomy.collection.confirmMessageSingular"
      : "phlebotomy.collection.confirmMessagePlural",
    { count: sampleCount, id: collectionId },
  );
}

export function SampleCollectionScreen({ route, navigation }: SampleCollectionScreenProps) {
  const canUpdateCollection = useHasPermission(P.LAB.SAMPLES_MANAGE);
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { orderId } = route.params;

  const [samples, setSamples] = useState<CollectedSample[]>([
    { sampleId: "sample-1", barcode: "", collected: false },
  ]);
  const [notes, setNotes] = useState("");
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  const [scanningFor, setScanningFor] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: collection, isLoading } = useQuery({
    queryKey: ["homeCollection", orderId],
    queryFn: async () => {
      const collections = await phlebotomyService.listHomeCollections({});
      return collections.find((c: LabHomeCollection) => c.id === orderId);
    },
    enabled: Boolean(orderId),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await phlebotomyService.updateHomeCollectionStatus(orderId, {
        status: "collected",
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeCollections"] });
      setSnackbar({
        visible: true,
        message: mobilePhlebotomyText("phlebotomy.collection.snackbar.completed"),
      });
      setTimeout(() => navigation.goBack(), 1500);
    },
    onError: () => {
      setSnackbar({
        visible: true,
        message: mobilePhlebotomyText("phlebotomy.collection.snackbar.failed"),
      });
    },
  });

  const handleToggleSample = (sampleId: string) => {
    setSamples(
      samples.map((s) => (s.sampleId === sampleId ? { ...s, collected: !s.collected } : s)),
    );
  };

  /**
   * Applies a label to one named tube, refusing a code already on another.
   * The rule lives in `lib/specimen` so it can be tested without a renderer.
   */
  const handleSetBarcode = (sampleId: string, barcode: string) => {
    const outcome = assignBarcode(samples, sampleId, barcode);
    if (!outcome.ok) {
      setSnackbar({ visible: true, message: outcome.reason });
      return;
    }
    setSamples(outcome.samples);
  };

  /**
   * Opens the real camera for the tube being labelled.
   *
   * This used to invent a barcode from the clock and report it as scanned, and
   * it applied that value to whichever tube happened to be first — so a
   * phlebotomist labelling their third tube recorded against their first, while
   * being told the scan had succeeded.
   */
  const handleScanBarcode = (sampleId: string) => {
    setScanningFor(sampleId);
  };

  const handleAddSample = () => {
    setSamples([
      ...samples,
      { sampleId: `sample-${samples.length + 1}`, barcode: "", collected: false },
    ]);
  };

  const allCollected = canComplete(samples);

  // The camera takes the whole screen: a tube label is small, curved and
  // often read in a corridor, so there is nothing to gain from a preview
  // squeezed beside the form.
  if (scanningFor) {
    return (
      <SafeAreaView style={styles.container}>
        <BarcodeScanner
          title="Scan the label on this tube"
          hint="Hold the barcode inside the frame"
          resumeKey={scanningFor}
          onCancel={() => setScanningFor(null)}
          onScan={(value) => {
            handleSetBarcode(scanningFor, value);
            setScanningFor(null);
          }}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="alert-circle" style={styles.errorIcon} />
        <Text variant="titleMedium">{mobilePhlebotomyText("phlebotomy.collection.notFound")}</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.backButton}>
          {mobilePhlebotomyText("phlebotomy.action.goBack")}
        </Button>
      </SafeAreaView>
    );
  }

  const addressParts = [collection.address_line, collection.city, collection.pincode].filter(
    Boolean,
  );
  const address =
    addressParts.length > 0
      ? addressParts.join(", ")
      : mobilePhlebotomyText("phlebotomy.collection.addressNotProvided");

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Collection Info Header */}
        <Surface style={styles.patientHeader} elevation={1}>
          <Avatar.Icon size={48} icon="test-tube" style={styles.avatar} />
          <View style={styles.patientInfo}>
            <Text variant="titleMedium" style={styles.patientName}>
              {mobilePhlebotomyText("phlebotomy.collection.collectionId", {
                id: collection.id.slice(0, 8),
              })}
            </Text>
            <Text variant="bodySmall" style={styles.uhid}>
              {collection.scheduled_date}
            </Text>
          </View>
          <Chip icon="clock">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Chip>
        </Surface>

        {/* Address */}
        <Card style={styles.addressCard}>
          <Card.Content>
            <View style={styles.addressHeader}>
              <Avatar.Icon size={32} icon="map-marker" style={styles.addressIconStyle} />
              <Text variant="titleSmall">
                {mobilePhlebotomyText("phlebotomy.collection.addressTitle")}
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.addressText}>
              {address}
            </Text>
            {collection.contact_phone && (
              <Chip icon="phone" style={styles.phoneChip}>
                {collection.contact_phone}
              </Chip>
            )}
          </Card.Content>
        </Card>

        {/* Samples to Collect */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {mobilePhlebotomyText("phlebotomy.collection.samplesSection")}
          </Text>
          <Button mode="text" icon="plus" onPress={handleAddSample} compact>
            {mobilePhlebotomyText("phlebotomy.action.addSample")}
          </Button>
        </View>

        {samples.map((sample, index) => (
          <Card key={sample.sampleId} style={styles.sampleCard}>
            <Card.Content>
              <View style={styles.sampleHeader}>
                <View style={styles.tubeIndicator} />
                <View style={styles.sampleInfo}>
                  <Text variant="titleSmall" style={styles.testName}>
                    {mobilePhlebotomyText("phlebotomy.collection.sampleTitle", {
                      number: index + 1,
                    })}
                  </Text>
                </View>
                <Checkbox
                  status={sample.collected ? "checked" : "unchecked"}
                  onPress={() => handleToggleSample(sample.sampleId)}
                />
              </View>

              {/* Barcode Input */}
              <View style={styles.barcodeRow}>
                <TextInput
                  mode="outlined"
                  label={mobilePhlebotomyText("phlebotomy.collection.barcodeLabel")}
                  value={sample.barcode}
                  onChangeText={(v) => handleSetBarcode(sample.sampleId, v)}
                  style={styles.barcodeInput}
                  dense
                  left={<TextInput.Icon icon="barcode" />}
                />
                <Button
                  mode="contained"
                  icon="barcode-scan"
                  onPress={() => handleScanBarcode(sample.sampleId)}
                  compact
                  style={styles.scanButton}
                >
                  {mobilePhlebotomyText("phlebotomy.action.scan")}
                </Button>
              </View>

              {sample.collected && (
                <Chip icon="check" style={styles.collectedChip}>
                  {mobilePhlebotomyText("phlebotomy.collection.sampleCollected")}
                </Chip>
              )}
            </Card.Content>
          </Card>
        ))}

        {/* Collection Notes */}
        <Text variant="titleMedium" style={styles.sectionTitle}>
          {mobilePhlebotomyText("phlebotomy.collection.notesTitle")}
        </Text>
        <TextInput
          mode="outlined"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          placeholder={mobilePhlebotomyText("phlebotomy.collection.notesPlaceholder")}
          style={styles.notesInput}
        />

        {/* Special Instructions */}
        {collection.special_instructions && (
          <Card style={styles.instructionsCard}>
            <Card.Content>
              <View style={styles.instructionsHeader}>
                <Avatar.Icon size={32} icon="alert-circle" style={styles.instructionsIcon} />
                <Text variant="titleSmall">
                  {mobilePhlebotomyText("phlebotomy.collection.specialInstructions")}
                </Text>
              </View>
              <Text variant="bodyMedium" style={styles.instructionsText}>
                {collection.special_instructions}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Verification Checklist */}
        <Card style={styles.checklistCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.checklistTitle}>
              {mobilePhlebotomyText("phlebotomy.collection.checklistTitle")}
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title={mobilePhlebotomyText("phlebotomy.collection.checklist.patientVerified")}
              left={() => <Checkbox status="checked" />}
            />
            <List.Item
              title={mobilePhlebotomyText("phlebotomy.collection.checklist.labeled")}
              left={() => <Checkbox status={allCollected ? "checked" : "unchecked"} />}
            />
            <List.Item
              title={mobilePhlebotomyText("phlebotomy.collection.checklist.stored")}
              left={() => <Checkbox status="checked" />}
            />
          </Card.Content>
        </Card>

        {/* Submit Button */}
        <Button
          mode="contained"
          onPress={() => setConfirmDialogVisible(true)}
          disabled={!allCollected || !canUpdateCollection}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          icon="check-circle"
        >
          {mobilePhlebotomyText("phlebotomy.action.completeCollection")}
        </Button>

        {/* Progress Indicator */}
        <View style={styles.progressRow}>
          <Text variant="labelMedium" style={styles.progressText}>
            {mobilePhlebotomyText("phlebotomy.collection.progress", {
              collected: samples.filter((s) => s.collected).length,
              total: samples.length,
            })}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${samples.length > 0 ? (samples.filter((s) => s.collected).length / samples.length) * 100 : 0}%`,
                },
              ]}
            />
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Dialog */}
      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={() => setConfirmDialogVisible(false)}>
          <Dialog.Title>{mobilePhlebotomyText("phlebotomy.collection.confirmTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text>{confirmMessage(samples.length, collection.id.slice(0, 8))}</Text>
            <Text style={styles.dialogWarning}>
              {mobilePhlebotomyText("phlebotomy.collection.submitWarning")}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDialogVisible(false)}>
              {mobilePhlebotomyText("phlebotomy.action.cancel")}
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setConfirmDialogVisible(false);
                submitMutation.mutate();
              }}
              loading={submitMutation.isPending}
            >
              {mobilePhlebotomyText("phlebotomy.action.confirm")}
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
    gap: 16,
  },
  errorIcon: {
    backgroundColor: "#fff5f5",
    marginBottom: 8,
  },
  backButton: {
    marginTop: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  patientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: "#0F766E",
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontWeight: "600",
  },
  uhid: {
    opacity: 0.6,
  },
  addressCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  addressIconStyle: {
    backgroundColor: "#e7f5ff",
  },
  addressText: {
    lineHeight: 22,
  },
  phoneChip: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  sampleCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  sampleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  tubeIndicator: {
    width: 8,
    height: 48,
    borderRadius: 4,
    backgroundColor: "#C8102E",
  },
  sampleInfo: {
    flex: 1,
  },
  testName: {
    fontWeight: "600",
  },
  barcodeRow: {
    flexDirection: "row",
    gap: 12,
  },
  barcodeInput: {
    flex: 1,
  },
  scanButton: {
    justifyContent: "center",
    borderRadius: 8,
  },
  collectedChip: {
    marginTop: 12,
    backgroundColor: "#d3f9d8",
    alignSelf: "flex-start",
  },
  notesInput: {
    marginBottom: 16,
  },
  instructionsCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff5f5",
  },
  instructionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  instructionsIcon: {
    backgroundColor: "#ffe3e3",
  },
  instructionsText: {
    lineHeight: 22,
  },
  checklistCard: {
    borderRadius: 12,
    backgroundColor: "#f8f9fa",
    marginBottom: 16,
  },
  checklistTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 8,
  },
  submitButton: {
    borderRadius: 12,
    backgroundColor: "#10b981",
  },
  submitButtonContent: {
    paddingVertical: 8,
  },
  progressRow: {
    marginTop: 16,
    alignItems: "center",
  },
  progressText: {
    opacity: 0.6,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    width: "100%",
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  dialogWarning: {
    marginTop: 12,
    fontStyle: "italic",
    opacity: 0.7,
  },
});
