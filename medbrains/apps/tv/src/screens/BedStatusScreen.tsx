import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, Surface, Text } from "react-native-paper";
import { config } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";

interface Bed {
  id: string;
  bed_number: string;
  ward_name: string;
  status: "available" | "occupied" | "reserved" | "maintenance" | "cleaning";
  patient_name?: string;
  admission_date?: string;
  doctor_name?: string;
  acuity?: "low" | "medium" | "high" | "critical";
}

interface Ward {
  id: string;
  name: string;
  beds: Bed[];
}

interface BedUpdate {
  type: "bed_update";
  wards: Ward[];
  summary: {
    total: number;
    occupied: number;
    available: number;
    reserved: number;
    maintenance: number;
  };
}

const STATUS_COLORS: Record<Bed["status"], string> = {
  available: "#40c057",
  occupied: "#fa5252",
  reserved: "#fab005",
  maintenance: "#868e96",
  cleaning: "#228be6",
};

const ACUITY_COLORS: Record<NonNullable<Bed["acuity"]>, string> = {
  low: "#40c057",
  medium: "#fab005",
  high: "#fd7e14",
  critical: "#fa5252",
};

function BedCard({ bed }: { bed: Bed }) {
  const statusColor = STATUS_COLORS[bed.status];
  const acuityColor = bed.acuity ? ACUITY_COLORS[bed.acuity] : undefined;

  return (
    <Surface
      style={[
        styles.bedCard,
        bed.status === "available" && styles.bedAvailable,
        bed.status === "occupied" && styles.bedOccupied,
      ]}
      elevation={2}
    >
      <View style={styles.bedHeader}>
        <Text style={styles.bedNumber}>{bed.bed_number}</Text>
        {acuityColor && (
          <View style={[styles.acuityDot, { backgroundColor: acuityColor }]} />
        )}
      </View>
      <View style={[styles.statusBar, { backgroundColor: statusColor }]} />
      {bed.patient_name && (
        <Text style={styles.patientName} numberOfLines={1}>
          {bed.patient_name}
        </Text>
      )}
      {bed.doctor_name && (
        <Text style={styles.doctorName} numberOfLines={1}>
          Dr. {bed.doctor_name}
        </Text>
      )}
    </Surface>
  );
}

function WardSection({ ward }: { ward: Ward }) {
  const available = ward.beds.filter((b) => b.status === "available").length;
  const occupied = ward.beds.filter((b) => b.status === "occupied").length;

  return (
    <View style={styles.wardSection}>
      <View style={styles.wardHeader}>
        <Text style={styles.wardName}>{ward.name}</Text>
        <View style={styles.wardStats}>
          <Chip compact mode="flat" style={styles.statChip}>
            {available} Available
          </Chip>
          <Chip compact mode="flat" style={[styles.statChip, styles.occupiedChip]}>
            {occupied} Occupied
          </Chip>
        </View>
      </View>
      <View style={styles.bedGrid}>
        {ward.beds.map((bed) => (
          <BedCard key={bed.id} bed={bed} />
        ))}
      </View>
    </View>
  );
}

export function BedStatusScreen() {
  const [bedData, setBedData] = useState<BedUpdate | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useWebSocket({
    url: `${config.wsBase}/beds`,
    onMessage: (data) => {
      const update = data as BedUpdate;
      if (update.type === "bed_update") {
        setBedData(update);
      }
    },
  });

  const summary = bedData?.summary || {
    total: 0,
    occupied: 0,
    available: 0,
    reserved: 0,
    maintenance: 0,
  };
  const occupancyRate = summary.total > 0
    ? Math.round((summary.occupied / summary.total) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Bed Status Board</Text>
          <Text style={styles.subtitle}>Real-time bed occupancy</Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#40c057" }]}>
              {summary.available}
            </Text>
            <Text style={styles.summaryLabel}>Available</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#fa5252" }]}>
              {summary.occupied}
            </Text>
            <Text style={styles.summaryLabel}>Occupied</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{occupancyRate}%</Text>
            <Text style={styles.summaryLabel}>Occupancy</Text>
          </View>
        </View>
        <Text style={styles.time}>
          {currentTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {/* Wards */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {bedData?.wards.map((ward) => (
          <WardSection key={ward.id} ward={ward} />
        ))}
        {!bedData && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Connecting to bed status...</Text>
          </View>
        )}
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
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
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#888888",
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 32,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "bold",
  },
  summaryLabel: {
    color: "#888888",
    fontSize: 14,
  },
  time: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    gap: 24,
  },
  wardSection: {
    gap: 12,
  },
  wardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wardName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "600",
  },
  wardStats: {
    flexDirection: "row",
    gap: 8,
  },
  statChip: {
    backgroundColor: "#1a3a1a",
  },
  occupiedChip: {
    backgroundColor: "#3a1a1a",
  },
  bedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  bedCard: {
    width: 100,
    height: 100,
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    padding: 8,
    justifyContent: "space-between",
  },
  bedAvailable: {
    backgroundColor: "#0a2a0a",
  },
  bedOccupied: {
    backgroundColor: "#2a0a0a",
  },
  bedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bedNumber: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  acuityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusBar: {
    height: 4,
    borderRadius: 2,
  },
  patientName: {
    color: "#ffffff",
    fontSize: 12,
    opacity: 0.9,
  },
  doctorName: {
    color: "#888888",
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#666666",
    fontSize: 18,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: "#888888",
    fontSize: 14,
  },
});
