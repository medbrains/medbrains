import { zodResolver } from "@hookform/resolvers/zod";
import {
  type MobilePatientProfileContactFormInput,
  mobilePatientProfileContactFormSchema,
} from "@medbrains/schemas";
import { useAuthStore, usePermissionStore } from "@medbrains/stores";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Dialog,
  Divider,
  HelperText,
  List,
  Portal,
  Snackbar,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { authService } from "../../services/auth.service";
import { patientService } from "../../services/patient.service";
import { mobileProfileText } from "./profileText";

const emptyProfileContactForm: MobilePatientProfileContactFormInput = {
  phone: "",
  email: "",
  phone_secondary: "",
};
const APP_VERSION = "0.1.0";

function profileFieldErrorText(message: string | undefined): string | undefined {
  return message ? mobileProfileText(message) : undefined;
}

export function ProfileScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const clearPermissions = usePermissionStore((state) => state.clearPermissions);

  const [editMode, setEditMode] = useState(false);
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", user?.id],
    queryFn: () => patientService.getPatient(user?.id || ""),
    enabled: Boolean(user?.id),
  });

  const profileContactValues = useMemo<MobilePatientProfileContactFormInput>(
    () =>
      patient
        ? {
            phone: patient.phone || "",
            email: patient.email || "",
            phone_secondary: patient.phone_secondary || "",
          }
        : emptyProfileContactForm,
    [patient],
  );

  const { control, handleSubmit } = useForm<MobilePatientProfileContactFormInput>({
    resolver: zodResolver(mobilePatientProfileContactFormSchema),
    values: profileContactValues,
  });

  const updateMutation = useMutation({
    mutationFn: (values: MobilePatientProfileContactFormInput) =>
      patientService.updatePatient(user?.id || "", {
        phone: values.phone.trim() || patient?.phone,
        email: values.email?.trim() || patient?.email || undefined,
        phone_secondary: values.phone_secondary.trim() || patient?.phone_secondary || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient"] });
      setEditMode(false);
      setSnackbar({
        visible: true,
        message: mobileProfileText("profile.snackbar.updated"),
      });
    },
    onError: () => {
      setSnackbar({
        visible: true,
        message: mobileProfileText("profile.snackbar.updateFailed"),
      });
    },
  });

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {}
    clearAuth();
    clearPermissions();
    setLogoutDialogVisible(false);
  };

  const handleEditStart = () => {
    setEditMode(true);
  };

  const saveProfileContact = handleSubmit((values) => updateMutation.mutate(values));

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  const fullName = patient
    ? `${patient.first_name} ${patient.last_name}`
    : user?.full_name || mobileProfileText("profile.fallback.user");
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
        .join(", ") || mobileProfileText("profile.fallback.notProvided")
    : mobileProfileText("profile.fallback.notProvided");

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
                {mobileProfileText("profile.contact.section")}
              </Text>
              {!editMode && (
                <Button mode="text" onPress={handleEditStart} icon="pencil">
                  {mobileProfileText("profile.action.edit")}
                </Button>
              )}
            </View>
            <Divider style={styles.divider} />

            {editMode ? (
              <View style={styles.editForm}>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field, fieldState }) => (
                    <>
                      <TextInput
                        label={mobileProfileText("profile.contact.phone")}
                        value={field.value}
                        onChangeText={field.onChange}
                        mode="outlined"
                        keyboardType="phone-pad"
                        error={Boolean(fieldState.error)}
                        left={<TextInput.Icon icon="phone" />}
                        style={styles.input}
                      />
                      {fieldState.error?.message && (
                        <HelperText type="error" visible>
                          {profileFieldErrorText(fieldState.error.message)}
                        </HelperText>
                      )}
                    </>
                  )}
                />
                <Controller
                  control={control}
                  name="phone_secondary"
                  render={({ field, fieldState }) => (
                    <>
                      <TextInput
                        label={mobileProfileText("profile.contact.secondaryPhone")}
                        value={field.value}
                        onChangeText={field.onChange}
                        mode="outlined"
                        keyboardType="phone-pad"
                        error={Boolean(fieldState.error)}
                        left={<TextInput.Icon icon="phone-plus" />}
                        style={styles.input}
                      />
                      {fieldState.error?.message && (
                        <HelperText type="error" visible>
                          {profileFieldErrorText(fieldState.error.message)}
                        </HelperText>
                      )}
                    </>
                  )}
                />
                <Controller
                  control={control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <>
                      <TextInput
                        label={mobileProfileText("profile.contact.email")}
                        value={field.value || ""}
                        onChangeText={field.onChange}
                        mode="outlined"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        error={Boolean(fieldState.error)}
                        left={<TextInput.Icon icon="email" />}
                        style={styles.input}
                      />
                      {fieldState.error?.message && (
                        <HelperText type="error" visible>
                          {profileFieldErrorText(fieldState.error.message)}
                        </HelperText>
                      )}
                    </>
                  )}
                />

                <View style={styles.editActions}>
                  <Button
                    mode="outlined"
                    onPress={() => setEditMode(false)}
                    style={styles.editButton}
                  >
                    {mobileProfileText("profile.action.cancel")}
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => void saveProfileContact()}
                    loading={updateMutation.isPending}
                    style={styles.editButton}
                  >
                    {mobileProfileText("profile.action.save")}
                  </Button>
                </View>
              </View>
            ) : (
              <>
                <List.Item
                  title={mobileProfileText("profile.contact.phone")}
                  description={patient?.phone || mobileProfileText("profile.fallback.notProvided")}
                  left={(props) => <List.Icon {...props} icon="phone" />}
                />
                {patient?.phone_secondary && (
                  <List.Item
                    title={mobileProfileText("profile.contact.secondaryPhone")}
                    description={patient.phone_secondary}
                    left={(props) => <List.Icon {...props} icon="phone-plus" />}
                  />
                )}
                <List.Item
                  title={mobileProfileText("profile.contact.email")}
                  description={patient?.email || mobileProfileText("profile.fallback.notProvided")}
                  left={(props) => <List.Icon {...props} icon="email" />}
                />
                <List.Item
                  title={mobileProfileText("profile.contact.address")}
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
                {mobileProfileText("profile.family.section")}
              </Text>
              <Divider style={styles.divider} />

              {patient.guardian_name && (
                <List.Item
                  title={mobileProfileText("profile.family.guardian")}
                  description={
                    patient.guardian_relation
                      ? mobileProfileText("profile.family.guardianWithRelation", {
                          name: patient.guardian_name,
                          relation: patient.guardian_relation,
                        })
                      : patient.guardian_name
                  }
                  left={(props) => <List.Icon {...props} icon="account-child" />}
                />
              )}
              {patient.father_name && (
                <List.Item
                  title={mobileProfileText("profile.family.father")}
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
              {mobileProfileText("profile.medical.section")}
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title={mobileProfileText("profile.medical.bloodGroup")}
              description={
                patient?.blood_group || mobileProfileText("profile.fallback.notSpecified")
              }
              left={(props) => <List.Icon {...props} icon="water" />}
            />
            <List.Item
              title={mobileProfileText("profile.medical.dateOfBirth")}
              description={
                patient?.date_of_birth
                  ? new Date(patient.date_of_birth).toLocaleDateString()
                  : mobileProfileText("profile.fallback.notSpecified")
              }
              left={(props) => <List.Icon {...props} icon="calendar" />}
            />
            <List.Item
              title={mobileProfileText("profile.medical.allergies")}
              description={
                patient?.no_known_allergies
                  ? mobileProfileText("profile.medical.noKnownAllergies")
                  : mobileProfileText("profile.medical.viewAllergies")
              }
              left={(props) => <List.Icon {...props} icon="alert-circle" />}
              right={
                !patient?.no_known_allergies
                  ? (props) => <List.Icon {...props} icon="chevron-right" />
                  : undefined
              }
              onPress={patient?.no_known_allergies ? undefined : () => {}}
            />
          </Card.Content>
        </Card>

        {/* Account Actions */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {mobileProfileText("profile.account.section")}
            </Text>
            <Divider style={styles.divider} />

            <List.Item
              title={mobileProfileText("profile.account.changePassword")}
              left={(props) => <List.Icon {...props} icon="lock" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {}}
            />
            <List.Item
              title={mobileProfileText("profile.account.notifications")}
              left={(props) => <List.Icon {...props} icon="bell" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => {}}
            />
            <List.Item
              title={mobileProfileText("profile.account.privacySettings")}
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
          textColor="#C8102E"
          icon="logout"
        >
          {mobileProfileText("profile.action.signOut")}
        </Button>

        <Text variant="labelSmall" style={styles.versionText}>
          {mobileProfileText("profile.version", { version: APP_VERSION })}
        </Text>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <Portal>
        <Dialog visible={logoutDialogVisible} onDismiss={() => setLogoutDialogVisible(false)}>
          <Dialog.Title>{mobileProfileText("profile.dialog.signOutTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text>{mobileProfileText("profile.dialog.signOutMessage")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialogVisible(false)}>
              {mobileProfileText("profile.action.cancel")}
            </Button>
            <Button onPress={handleLogout} textColor="#C8102E">
              {mobileProfileText("profile.action.signOut")}
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
    backgroundColor: "#0F766E",
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
    color: "#C8102E",
    fontWeight: "600",
  },
  genderChip: {
    backgroundColor: "#e7f5ff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  genderText: {
    color: "#0F766E",
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
    borderColor: "#C8102E",
    borderRadius: 12,
  },
  versionText: {
    textAlign: "center",
    opacity: 0.4,
    marginTop: 16,
  },
});
