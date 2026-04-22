import React from "react";
import { StyleSheet, View } from "react-native";
import { Avatar, Button, Card, Chip, Text } from "react-native-paper";

type QueueStatus = "waiting" | "called" | "in_consultation" | "completed" | "no_show";

interface QueueItemProps {
  item: {
    id: string;
    token_number: number;
    patient_name: string;
    uhid: string;
    status: QueueStatus;
    wait_time_minutes?: number;
    department?: string;
    doctor_name?: string;
  };
  onCall?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onNoShow?: () => void;
  compact?: boolean;
}

const STATUS_CONFIG: Record<QueueStatus, { color: string; label: string }> = {
  waiting: { color: "#868e96", label: "Waiting" },
  called: { color: "#228be6", label: "Called" },
  in_consultation: { color: "#40c057", label: "In Progress" },
  completed: { color: "#40c057", label: "Completed" },
  no_show: { color: "#fa5252", label: "No Show" },
};

export function QueueItem({
  item,
  onCall,
  onStart,
  onComplete,
  onNoShow,
  compact = false,
}: QueueItemProps) {
  const statusConfig = STATUS_CONFIG[item.status];
  const isWaiting = item.status === "waiting";
  const isCalled = item.status === "called";
  const isInProgress = item.status === "in_consultation";

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={[styles.tokenBadge, { backgroundColor: statusConfig.color }]}>
          <Text style={styles.tokenNumber}>{item.token_number}</Text>
        </View>

        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.name}>
            {item.patient_name}
          </Text>
          <Text variant="bodySmall" style={styles.uhid}>
            {item.uhid}
          </Text>

          <View style={styles.meta}>
            <Chip
              compact
              mode="flat"
              style={[styles.statusChip, { backgroundColor: `${statusConfig.color}20` }]}
              textStyle={{ color: statusConfig.color }}
            >
              {statusConfig.label}
            </Chip>

            {isWaiting && item.wait_time_minutes !== undefined && (
              <Text variant="labelSmall" style={styles.waitTime}>
                {item.wait_time_minutes} min
              </Text>
            )}
          </View>

          {!compact && item.doctor_name && (
            <Text variant="bodySmall" style={styles.doctor}>
              Dr. {item.doctor_name}
            </Text>
          )}
        </View>

        <View style={styles.actions}>
          {isWaiting && onCall && (
            <Button
              mode="contained"
              compact
              onPress={onCall}
              icon="phone"
              style={styles.actionButton}
            >
              Call
            </Button>
          )}

          {isCalled && onStart && (
            <Button
              mode="contained"
              compact
              onPress={onStart}
              icon="play"
              style={styles.actionButton}
            >
              Start
            </Button>
          )}

          {isInProgress && onComplete && (
            <Button
              mode="contained"
              compact
              onPress={onComplete}
              icon="check"
              style={[styles.actionButton, { backgroundColor: "#40c057" }]}
            >
              Done
            </Button>
          )}

          {(isWaiting || isCalled) && onNoShow && (
            <Avatar.Icon
              size={32}
              icon="account-off"
              style={styles.noShowIcon}
              color="#fa5252"
            />
          )}
        </View>
      </Card.Content>
    </Card>
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
  tokenBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  tokenNumber: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  info: {
    flex: 1,
  },
  name: {
    fontWeight: "600",
  },
  uhid: {
    opacity: 0.5,
    marginTop: 2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  statusChip: {
    height: 24,
  },
  waitTime: {
    opacity: 0.6,
  },
  doctor: {
    opacity: 0.6,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
  },
  noShowIcon: {
    backgroundColor: "#fff5f5",
  },
});
