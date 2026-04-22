import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Avatar, Card, Chip, Text } from "react-native-paper";

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
  onPress?: () => void;
}

function calculateAge(dob?: string): string {
  if (!dob) return "";
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return `${age}Y`;
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

export function PatientCard({ patient, onPress }: PatientCardProps) {
  const fullName = `${patient.first_name} ${patient.last_name}`;
  const age = calculateAge(patient.date_of_birth);
  const genderDisplay = patient.gender ? patient.gender.charAt(0).toUpperCase() : "";

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <Avatar.Text
            size={48}
            label={getInitials(patient.first_name, patient.last_name)}
            style={styles.avatar}
          />
          <View style={styles.info}>
            <Text variant="titleMedium" style={styles.name}>
              {fullName}
            </Text>
            <Text variant="bodySmall" style={styles.uhid}>
              {patient.uhid}
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
              {patient.phone && (
                <Chip compact icon="phone" style={styles.chip}>
                  {patient.phone}
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
    backgroundColor: "#228be6",
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
