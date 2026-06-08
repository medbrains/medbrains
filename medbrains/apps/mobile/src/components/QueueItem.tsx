import { StyleSheet, View } from "react-native";
import { Button, Card, Chip, IconButton, Text } from "react-native-paper";
import { MEDBRAINS_COLORS } from "../theme/paper-theme";
import { MOBILE_QUEUE_ITEM_TEXT, mobilePatientJourneyText } from "./patientJourneyText";

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

const QUEUE_ITEM_TEXT = MOBILE_QUEUE_ITEM_TEXT;
const STATUS_CONFIG: Record<QueueStatus, { color: string; labelKey: string }> = {
  waiting: { color: MEDBRAINS_COLORS.muted, labelKey: QUEUE_ITEM_TEXT.status.waiting },
  called: { color: MEDBRAINS_COLORS.brand, labelKey: QUEUE_ITEM_TEXT.status.called },
  in_consultation: {
    color: MEDBRAINS_COLORS.emerald,
    labelKey: QUEUE_ITEM_TEXT.status.inProgress,
  },
  completed: { color: MEDBRAINS_COLORS.emerald, labelKey: QUEUE_ITEM_TEXT.status.completed },
  no_show: { color: MEDBRAINS_COLORS.red, labelKey: QUEUE_ITEM_TEXT.status.noShow },
};

function queueItemText(key: string, values?: Record<string, string | number | boolean>): string {
  return mobilePatientJourneyText(key, values);
}

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
              {queueItemText(statusConfig.labelKey)}
            </Chip>

            {isWaiting && item.wait_time_minutes !== undefined && (
              <Text variant="labelSmall" style={styles.waitTime}>
                {queueItemText(QUEUE_ITEM_TEXT.fields.waitMinutes, {
                  count: item.wait_time_minutes,
                })}
              </Text>
            )}
          </View>

          {!compact && item.doctor_name && (
            <Text variant="bodySmall" style={styles.doctor}>
              {queueItemText(QUEUE_ITEM_TEXT.fields.doctor, { name: item.doctor_name })}
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
              {queueItemText(QUEUE_ITEM_TEXT.actions.call)}
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
              {queueItemText(QUEUE_ITEM_TEXT.actions.start)}
            </Button>
          )}

          {isInProgress && onComplete && (
            <Button
              mode="contained"
              compact
              onPress={onComplete}
              icon="check"
              style={[styles.actionButton, { backgroundColor: MEDBRAINS_COLORS.emerald }]}
            >
              {queueItemText(QUEUE_ITEM_TEXT.actions.done)}
            </Button>
          )}

          {(isWaiting || isCalled) && onNoShow && (
            <IconButton
              accessibilityLabel={queueItemText(QUEUE_ITEM_TEXT.actions.noShow)}
              icon="account-off"
              iconColor={MEDBRAINS_COLORS.red}
              mode="contained-tonal"
              size={18}
              onPress={onNoShow}
              style={styles.noShowIcon}
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
    color: MEDBRAINS_COLORS.canvas,
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
    backgroundColor: MEDBRAINS_COLORS.statusDangerBg,
  },
});
