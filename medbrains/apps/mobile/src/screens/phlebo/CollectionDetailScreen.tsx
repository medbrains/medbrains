import { api } from "@medbrains/api";
import type { LabHomeCollection } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Divider,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

interface CollectionDetailScreenProps {
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

function getStatusColor(status: string): string {
  switch (status) {
    case "collected":
    case "returned_to_lab":
      return "#40c057";
    case "in_transit":
    case "arrived":
      return "#228be6";
    case "scheduled":
    case "assigned":
      return "#fab005";
    case "cancelled":
      return "#fa5252";
    default:
      return "#868e96";
  }
}

export function CollectionDetailScreen({ route, navigation }: CollectionDetailScreenProps) {
  const theme = useTheme();
  const { orderId } = route.params;

  const { data: collection, isLoading } = useQuery({
    queryKey: ["homeCollection", orderId],
    queryFn: async () => {
      const collections = await api.listHomeCollections({});
      return collections.find((c: LabHomeCollection) => c.id === orderId);
    },
    enabled: Boolean(orderId),
  });

  const handleCall = () => {
    if (collection?.contact_phone) {
      Linking.openURL(`tel:${collection.contact_phone}`);
    }
  };

  const handleNavigate = () => {
    const address = [collection?.address_line, collection?.city].filter(Boolean).join(", ");
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Loading collection details...
        </Text>
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Avatar.Icon size={64} icon="alert-circle" style={styles.errorIcon} />
        <Text variant="titleMedium">Collection not found</Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={styles.backButton}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }

  const isPending = collection.status === "scheduled" || collection.status === "assigned";
  const statusColor = getStatusColor(collection.status);
  const addressParts = [collection.address_line, collection.city, collection.pincode].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : "Address not provided";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Banner */}
        <Surface style={[styles.statusBanner, { backgroundColor: `${statusColor}20` }]} elevation={0}>
          <Avatar.Icon
            size={48}
            icon={collection.status === "collected" ? "check-circle" : "clock"}
            style={{ backgroundColor: statusColor }}
          />
          <View style={styles.statusInfo}>
            <Text variant="titleMedium" style={[styles.statusText, { color: statusColor }]}>
              {collection.status.replace("_", " ").toUpperCase()}
            </Text>
            <Text variant="bodySmall" style={styles.statusDate}>
              Scheduled: {collection.scheduled_date}
            </Text>
          </View>
        </Surface>

        {/* Collection Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Collection Details
            </Text>
            <Divider style={styles.divider} />

            <View style={styles.infoRow}>
              <Avatar.Icon size={40} icon="identifier" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text variant="labelSmall" style={styles.infoLabel}>Collection ID</Text>
                <Text variant="bodyMedium">{collection.id.slice(0, 8)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Avatar.Icon size={40} icon="calendar" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text variant="labelSmall" style={styles.infoLabel}>Date</Text>
                <Text variant="bodyMedium">{collection.scheduled_date}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Avatar.Icon size={40} icon="clock" style={styles.infoIcon} />
              <View style={styles.infoContent}>
                <Text variant="labelSmall" style={styles.infoLabel}>Time Slot</Text>
                <Text variant="bodyMedium">{collection.scheduled_time_slot || "Flexible"}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Address Card */}
        <Card style={styles.addressCard}>
          <Card.Content>
            <View style={styles.addressHeader}>
              <Avatar.Icon size={32} icon="map-marker" style={styles.addressIconStyle} />
              <Text variant="titleMedium">Collection Address</Text>
            </View>
            <Text variant="bodyMedium" style={styles.addressText}>
              {address}
            </Text>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            mode="contained"
            icon="phone"
            onPress={handleCall}
            style={styles.quickButton}
            disabled={!collection.contact_phone}
          >
            Call
          </Button>
          <Button
            mode="contained"
            icon="navigation"
            onPress={handleNavigate}
            style={styles.quickButton}
            disabled={!collection.address_line}
          >
            Navigate
          </Button>
        </View>

        {/* Special Instructions */}
        {collection.special_instructions && (
          <Card style={styles.instructionsCard}>
            <Card.Content>
              <View style={styles.instructionsHeader}>
                <Avatar.Icon size={32} icon="alert-circle" style={styles.instructionsIcon} />
                <Text variant="titleMedium">Special Instructions</Text>
              </View>
              <Text variant="bodyMedium" style={styles.instructionsText}>
                {collection.special_instructions}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Action Buttons */}
        {isPending && (
          <View style={styles.actionButtons}>
            <Button
              mode="contained"
              icon="test-tube"
              onPress={() => navigation.navigate("SampleCollection", { orderId })}
              style={styles.collectButton}
              contentStyle={styles.collectButtonContent}
            >
              Start Collection
            </Button>
            <Button
              mode="outlined"
              icon="account-off"
              onPress={() => {
                // Handle patient not available
              }}
              style={styles.notAvailableButton}
            >
              Patient Not Available
            </Button>
          </View>
        )}

        {/* Collected Info */}
        {collection.collected_at && (
          <Surface style={styles.collectedBanner} elevation={0}>
            <Avatar.Icon size={32} icon="check-circle" style={styles.collectedIcon} />
            <View style={styles.collectedInfo}>
              <Text variant="labelMedium">Collected At</Text>
              <Text variant="bodyMedium">
                {new Date(collection.collected_at).toLocaleString()}
              </Text>
            </View>
          </Surface>
        )}
      </ScrollView>
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
  loadingText: {
    opacity: 0.6,
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
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontWeight: "bold",
  },
  statusDate: {
    opacity: 0.7,
    marginTop: 2,
  },
  infoCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  infoIcon: {
    backgroundColor: "#e7f5ff",
  },
  infoContent: {},
  infoLabel: {
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
    marginBottom: 12,
  },
  addressIconStyle: {
    backgroundColor: "#e7f5ff",
  },
  addressText: {
    lineHeight: 22,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  quickButton: {
    flex: 1,
    borderRadius: 12,
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
  actionButtons: {
    gap: 12,
    marginTop: 8,
  },
  collectButton: {
    borderRadius: 12,
    backgroundColor: "#40c057",
  },
  collectButtonContent: {
    paddingVertical: 8,
  },
  notAvailableButton: {
    borderRadius: 12,
  },
  collectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#d3f9d8",
    marginTop: 16,
  },
  collectedIcon: {
    backgroundColor: "#40c057",
  },
  collectedInfo: {},
});
