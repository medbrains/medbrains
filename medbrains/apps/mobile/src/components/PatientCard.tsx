import type { FieldAccessLevel } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Card, Chip, Text } from "react-native-paper";

interface PatientCardAccess {
  dateOfBirth?: FieldAccessLevel;
  name?: FieldAccessLevel;
  phone?: FieldAccessLevel;
  uhid?: FieldAccessLevel;
}

interface PatientCardProps {
  patient: {
    id: string;
    uhid: string;
    first_name: string;
    last_name: string;
    gender?: string;
    date_of_birth?: string;
    phone?: string;
  };
  access?: PatientCardAccess;
  onPress?: () => void;
}

function calculateAge(dob?: string): string {
  if (!dob) return "";
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age}Y`;
}

function protectedText(
  access: FieldAccessLevel,
  value: string | null | undefined,
  kind: "identifier" | "name" | "phone" | "text",
  fallback: string,
) {
  const display = fieldAccessText(access, value, kind);
  return display === "—" ? fallback : display;
}

function protectedAge(access: FieldAccessLevel, dob?: string): string {
  if (access === "hidden") return "Restricted";
  if (!dob) return "";
  if (access === "mask") return "Age masked";
  return calculateAge(dob);
}

function getGenderIcon(gender?: string): string {
  switch (gender?.toLowerCase()) {
    case "male":
      return "gender-male";
    case "female":
      return "gender-female";
    default:
      return "account";
  }
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function PatientCard({ access, patient, onPress }: PatientCardProps) {
  const nameAccess = access?.name ?? "edit";
  const uhidAccess = access?.uhid ?? "edit";
  const phoneAccess = access?.phone ?? "edit";
  const dobAccess = access?.dateOfBirth ?? "edit";
  const rawFullName = `${patient.first_name} ${patient.last_name}`;
  const fullName = protectedText(nameAccess, rawFullName, "name", "Unknown patient");
  const initials =
    nameAccess === "mask" || nameAccess === "hidden"
      ? "PT"
      : getInitials(patient.first_name, patient.last_name);
  const uhid = protectedText(uhidAccess, patient.uhid, "identifier", "No UHID");
  const phone = protectedText(phoneAccess, patient.phone, "phone", "");
  const age = protectedAge(dobAccess, patient.date_of_birth);
  const genderDisplay = patient.gender ? patient.gender.charAt(0).toUpperCase() : "";

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <Avatar.Text size={48} label={initials} style={styles.avatar} />
          <View style={styles.info}>
            <Text variant="titleMedium" style={styles.name}>
              {fullName}
            </Text>
            <Text variant="bodySmall" style={styles.uhid}>
              {uhid}
            </Text>
            <View style={styles.meta}>
              {age && (
                <Chip compact icon="calendar" style={styles.chip}>
                  {age}
                </Chip>
              )}
              {genderDisplay && (
                <Chip compact icon={getGenderIcon(patient.gender)} style={styles.chip}>
                  {genderDisplay}
                </Chip>
              )}
              {phone && (
                <Chip compact icon="phone" style={styles.chip}>
                  {phone}
                </Chip>
              )}
            </View>
          </View>
          <Avatar.Icon size={24} icon="chevron-right" style={styles.chevron} />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    backgroundColor: "#0F766E",
  },
  info: {
    flex: 1,
  },
  name: {
    fontWeight: "600",
  },
  uhid: {
    opacity: 0.6,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  chip: {
    height: 24,
  },
  chevron: {
    backgroundColor: "transparent",
  },
});
