import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
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

export function ProfileScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();

  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({
    phone: "",
    email: "",
    phone_secondary: "",
  });
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", user?.id],
    queryFn: () => api.getPatient(user?.id || ""),
    enabled: Boolean(user?.id),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updatePatient(user?.id || "", {
        phone: editedData.phone || patient?.phone,
        email: editedData.email || patient?.email || undefined,
        phone_secondary: editedData.phone_secondary || patient?.phone_secondary || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient"] });
      setEditMode(false);
      setSnackbar({ visible: true, message: "Profile updated successfully" });
    },
    onError: () => {
      setSnackbar({ visible: true, message: "Failed to update profile" });
    },
  });

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    clearAuth();
    setLogoutDialogVisible(false);
  };

  const handleEditStart = () => {
    if (patient) {
      setEditedData({
        phone: patient.phone || "",
        email: patient.email || "",
        phone_secondary: patient.phone_secondary || "",
      });
    }
    setEditMode(true);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const fullName = patient
    ? `${patient.first_name} ${patient.last_name}`
    : user?.full_name || "User";
  const initials = fullName
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Format address if available
  const addressDisplay = patient?.address
    ? [
        (patient.address as Record<string, string>).line1,
        (patient.address as Record<string, string>).city,
        (patient.address as Record<string, string>).state,
        (patient.address as Record<string, string>).pincode,
      ]
        .filter(Boolean)
        .join(", ") || "Not provided"
    : "Not provided";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <Surface style={styles.headerCard} elevation={2}>
          <Avatar.Text size={80} label={initials} style={styles.avatar} />
          <Text variant="headlineSmall" style={styles.name}>
            {fullName}
          </Text>
          <Text variant="bodyMedium" style={styles.uhid}>
            {patient?.uhid || user?.username}
          </Text>

          <View style={styles.headerChips}>
            {patient?.blood_group && (
              <Surface style={styles.bloodChip} elevation={0}>
                <Text style={styles.bloodText}>{patient.blood_group}</Text>
              </Surface>
            )}
            {patient?.gender && (
              <Surface style={styles.genderChip} elevation={0}>
                <Text style={styles.genderText}>{patient.gender}</Text>
              </Surface>
            )}
          </View>
        </Surface>

        {/* Contact Information */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Contact Information
              </Text>
              {!editMode && (
                <Button mode="text" onPress={handleEditStart} icon="pencil">
                  Edit
                </Button>
              )}
            </View>
            <Divider style={styles.divider} />

            {editMode ? (
              <View style={styles.editForm}>
                <TextInput
                  label="Phone"
                  value={editedData.phone}
                  onChangeText={(v) => setEditedData({ ...editedData, phone: v })}
                  mode="outlined"
                  keyboardType="phone-pad"
                  left={<TextInput.Icon icon="phone" />}
                  style={styles.input}
                />
                <TextInput
                  label="Secondary Phone"
                  value={editedData.phone_secondary}
                  onChangeText={(v) => setEditedData({ ...editedData, phone_secondary: v })}
                  mode="outlined"
                  keyboardType="phone-pad"
                  left={<TextInput.Icon icon="phone-plus" />}
                  style={styles.input}
                />
                <TextInput
                  label="Email"
                  value={editedData.email}
                  onChangeText={(v) => setEditedData({ ...editedData, email: v })}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="email" />}
                  style={styles.input}
                />

                <View style={styles.editActions}>
                  <Button mode="outlined" onPress={() => setEditMode(false)} style={styles.editButton}>
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => updateMutation.mutate()}
                    loading={updateMutation.isPending}
                    style={styles.editButton}
                  >
                    Save
                  </Button>
                </View>
              </View>
            ) : (
              <>
                <List.Item
                  title="Phone"
                  description={patient?.phone || "Not provided"}
                  left={(props) => <List.Icon {...props} icon="phone" />}
                />
                {patient?.phone_secondary && (
                  <List.Item
                    title="Secondary Phone"
                    description={patient.phone_secondary}
                    left={(props) => <List.Icon {...props} icon="phone-plus" />}
                  />
                )}
                <List.Item
                  title="Email"
                  description={patient?.email || "Not provided"}
                  left={(props) => <List.Icon {...props} icon="email" />}
                />
                <List.Item
                  title="Address"
                  description={addressDisplay}
                  left={(props) => <List.Icon {...props} icon="map-marker" />}
                />
              </>
            )}
          </Card.Content>
        </Card>

        {/* Guardian Information */}
        {(patient?.guardian_name || patient?.father_name) && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Guardian / Family
              </Text>
              <Divider style={styles.divider} />

              {patient.guardian_name && (
                <List.Item
                  title="Guardian"
                  description={`${patient.guardian_name}${patient.guardian_relation ? ` (${patient.guardian_relation})` : ""}`}
                  left={(props) => <List.Icon {...props} icon="account-child" />}
                />
              )}
              {patient.father_name && (
                <List.Item
                  title="Father"
                  description={patient.father_name}
                  left={(props) => <List.Icon {...props} icon="account" />}
                />
              )}
            </Card.Content>
          </Card>
        )}

        {/* Medical Information */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Medical Information
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title="Blood Group"
              description={patient?.blood_group || "Not specified"}
              left={(props) => <List.Icon {...props} icon="water" />}
            />
            <List.Item
              title="Date of Birth"
              description={
                patient?.date_of_birth
                  ? new Date(patient.date_of_birth).toLocaleDateString()
                  : "Not specified"
              }
              left={(props) => <List.Icon {...props} icon="calendar" />}
            />
            <List.Item
              title="Allergies"
              description={patient?.no_known_allergies ? "No known allergies" : "View allergies"}
              left={(props) => <List.Icon {...props} icon="alert-circle" />}
              right={!patient?.no_known_allergies ? (props) => <List.Icon {...props} icon="chevron-right" /> : undefined}
              onPress={patient?.no_known_allergies ? undefined : () => {}}
            />
          </Card.Content>
        </Card>

        {/* Account Actions */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Account
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title="Change Password"
              left={(props) => <List.Icon {...props} icon="lock" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {}}
            />
            <List.Item
              title="Notifications"
              left={(props) => <List.Icon {...props} icon="bell" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {}}
            />
            <List.Item
              title="Privacy Settings"
              left={(props) => <List.Icon {...props} icon="shield-account" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {}}
            />
          </Card.Content>
        </Card>

        {/* Logout Button */}
        <Button
          mode="outlined"
          onPress={() => setLogoutDialogVisible(true)}
          style={styles.logoutButton}
          textColor="#fa5252"
          icon="logout"
        >
          Sign Out
        </Button>

        <Text variant="labelSmall" style={styles.versionText}>
          MedBrains v0.1.0
        </Text>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <Portal>
        <Dialog visible={logoutDialogVisible} onDismiss={() => setLogoutDialogVisible(false)}>
          <Dialog.Title>Sign Out</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to sign out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleLogout} textColor="#fa5252">
              Sign Out
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
    paddingBottom: 32,
  },
  headerCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: "#228be6",
    marginBottom: 16,
  },
  name: {
    fontWeight: "bold",
  },
  uhid: {
    opacity: 0.6,
    marginTop: 4,
  },
  headerChips: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  bloodChip: {
    backgroundColor: "#fff5f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bloodText: {
    color: "#fa5252",
    fontWeight: "600",
  },
  genderChip: {
    backgroundColor: "#e7f5ff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  genderText: {
    color: "#228be6",
    fontWeight: "600",
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontWeight: "600",
  },
  divider: {
    marginVertical: 12,
  },
  editForm: {
    gap: 12,
  },
  input: {
    backgroundColor: "transparent",
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
  },
  logoutButton: {
    marginTop: 8,
    borderColor: "#fa5252",
    borderRadius: 12,
  },
  versionText: {
    textAlign: "center",
    opacity: 0.4,
    marginTop: 16,
  },
});
