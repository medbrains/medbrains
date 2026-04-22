import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { config } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";

type AcuityLevel = 1 | 2 | 3 | 4 | 5;

interface TriagePatient {
  id: string;
  token: string;
  patient_name: string;
  chief_complaint: string;
  acuity: AcuityLevel; // ESI scale: 1=Resuscitation, 5=Non-urgent
  arrival_time: string;
  status: "waiting" | "in_treatment" | "admitted" | "discharged";
  bed_number?: string;
  doctor_name?: string;
  wait_time_minutes: number;
}

interface TriageUpdate {
  type: "triage_update";
  patients: TriagePatient[];
  stats: {
    total_waiting: number;
    critical_count: number;
    avg_wait_minutes: number;
    beds_available: number;
  };
}

const ACUITY_CONFIG: Record<AcuityLevel, { label: string; color: string; bgColor: string }> = {
  1: { label: "Resuscitation", color: "#ffffff", bgColor: "#c92a2a" },
  2: { label: "Emergent", color: "#ffffff", bgColor: "#e8590c" },
  3: { label: "Urgent", color: "#000000", bgColor: "#fab005" },
  4: { label: "Less Urgent", color: "#000000", bgColor: "#40c057" },
  5: { label: "Non-Urgent", color: "#000000", bgColor: "#228be6" },
};

function PatientRow({ patient }: { patient: TriagePatient }) {
  const acuityConfig = ACUITY_CONFIG[patient.acuity];
  const waitColor = patient.wait_time_minutes > 60 ? "#fa5252" :
    patient.wait_time_minutes > 30 ? "#fab005" : "#40c057";

  return (
    <Surface style={styles.patientRow} elevation={1}>
      <View style={[styles.acuityBadge, { backgroundColor: acuityConfig.bgColor }]}>
        <Text style={[styles.acuityText, { color: acuityConfig.color }]}>
          {patient.acuity}
        </Text>
      </View>
      <View style={styles.patientInfo}>
        <Text style={styles.tokenText}>{patient.token}</Text>
        <Text style={styles.patientName}>{patient.patient_name}</Text>
        <Text style={styles.complaint} numberOfLines={1}>
          {patient.chief_complaint}
        </Text>
      </View>
      <View style={styles.statusInfo}>
        {patient.bed_number ? (
          <Text style={styles.bedText}>Bed {patient.bed_number}</Text>
        ) : (
          <Text style={[styles.waitTime, { color: waitColor }]}>
            {patient.wait_time_minutes} min
          </Text>
        )}
        {patient.doctor_name && (
          <Text style={styles.doctorText}>Dr. {patient.doctor_name}</Text>
        )}
      </View>
    </Surface>
  );
}

function AcuityColumn({ acuity, patients }: { acuity: 1 | 2 | 3 | 4 | 5; patients: TriagePatient[] }) {
  const acuityConfig = ACUITY_CONFIG[acuity];
  const filtered = patients.filter((p) => p.acuity === acuity);

  return (
    <View style={styles.column}>
      <View style={[styles.columnHeader, { backgroundColor: acuityConfig.bgColor }]}>
        <Text style={[styles.columnTitle, { color: acuityConfig.color }]}>
          {acuityConfig.label}
        </Text>
        <Text style={[styles.columnCount, { color: acuityConfig.color }]}>
          {filtered.length}
        </Text>
      </View>
      <ScrollView style={styles.columnContent}>
        {filtered.map((patient) => (
          <PatientRow key={patient.id} patient={patient} />
        ))}
      </ScrollView>
    </View>
  );
}

export function EmergencyTriageScreen() {
  const [triageData, setTriageData] = useState<TriageUpdate | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useWebSocket({
    url: `${config.wsBase}/emergency`,
    onMessage: (data) => {
      const update = data as TriageUpdate;
      if (update.type === "triage_update") {
        setTriageData(update);
      }
    },
  });

  const stats = triageData?.stats || {
    total_waiting: 0,
    critical_count: 0,
    avg_wait_minutes: 0,
    beds_available: 0,
  };
  const patients = triageData?.patients || [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <View>
            <Text style={styles.title}>Emergency Department</Text>
            <Text style={styles.subtitle}>Triage Board</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: "#fa5252" }]}>
              {stats.critical_count}
            </Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.total_waiting}</Text>
            <Text style={styles.statLabel}>Waiting</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{stats.avg_wait_minutes}</Text>
            <Text style={styles.statLabel}>Avg Wait (min)</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: "#40c057" }]}>
              {stats.beds_available}
            </Text>
            <Text style={styles.statLabel}>Beds Free</Text>
          </View>
        </View>
        <Text style={styles.time}>
          {currentTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </Text>
      </View>

      {/* Triage Columns by Acuity */}
      <View style={styles.content}>
        {([1, 2, 3, 4, 5] as const).map((acuity) => (
          <AcuityColumn key={acuity} acuity={acuity} patients={patients} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a1a",
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  emergencyIcon: {
    fontSize: 40,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#888888",
    fontSize: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 32,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#888888",
    fontSize: 14,
  },
  time: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    overflow: "hidden",
  },
  columnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
  columnCount: {
    fontSize: 24,
    fontWeight: "bold",
  },
  columnContent: {
    flex: 1,
    padding: 8,
  },
  patientRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a4e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  acuityBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  acuityText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  patientInfo: {
    flex: 1,
  },
  tokenText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  patientName: {
    color: "#ffffff",
    fontSize: 12,
  },
  complaint: {
    color: "#888888",
    fontSize: 11,
  },
  statusInfo: {
    alignItems: "flex-end",
  },
  bedText: {
    color: "#40c057",
    fontSize: 14,
    fontWeight: "bold",
  },
  waitTime: {
    fontSize: 14,
    fontWeight: "bold",
  },
  doctorText: {
    color: "#888888",
    fontSize: 11,
  },
});
