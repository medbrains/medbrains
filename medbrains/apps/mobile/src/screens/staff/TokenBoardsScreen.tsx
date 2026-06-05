import { useHasAnyPermission } from "@medbrains/stores";
import type {
  BillingQueueToken,
  ErTriageToken,
  LabQueueToken,
  PharmacyQueueToken,
  QueuePriority,
  QueueToken,
  RadiologyQueueToken,
  TriageLevelColor,
} from "@medbrains/types";
import { TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE, TOKEN_BOARD_SURFACES } from "@medbrains/types";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Chip,
  Surface,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useBillingTokenBoardQuery,
  useErTokenBoardQuery,
  useLabTokenBoardQuery,
  useOpdTokenBoardQuery,
  usePharmacyTokenBoardQuery,
  useRadiologyTokenBoardQuery,
} from "../../services/tokenBoards.queries";
import { MEDBRAINS_COLORS } from "../../theme/paper-theme";

const TOKEN_LIMIT = 6;
const OPD_BOARD = TOKEN_BOARD_SURFACES.opd;
const LAB_BOARD = TOKEN_BOARD_SURFACES.lab;
const RADIOLOGY_BOARD = TOKEN_BOARD_SURFACES.radiology;
const EMERGENCY_BOARD = TOKEN_BOARD_SURFACES.emergency;
const PHARMACY_BOARD = TOKEN_BOARD_SURFACES.pharmacy;
const BILLING_BOARD = TOKEN_BOARD_SURFACES.billing;

const TRIAGE_LANES: ReadonlyArray<{
  color: string;
  key: TriageLevelColor;
  label: string;
}> = [
  { color: MEDBRAINS_COLORS.red, key: "red", label: "Red" },
  { color: MEDBRAINS_COLORS.copper, key: "orange", label: "Orange" },
  { color: MEDBRAINS_COLORS.statusWarning, key: "yellow", label: "Yellow" },
  { color: MEDBRAINS_COLORS.emerald, key: "green", label: "Green" },
  { color: MEDBRAINS_COLORS.brand, key: "blue", label: "Blue" },
];

interface DisplayToken {
  meta: string;
  status: string;
  tokenNumber: string;
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function priorityLabel(value: QueuePriority) {
  return value.replace(/_/g, " ");
}

function lastSyncLabel(updatedAt: number) {
  if (updatedAt === 0) return "pending";
  return new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string) {
  switch (status) {
    case "ready":
    case "dispensed":
    case "paid":
    case "settled":
    case "called":
    case "collected":
    case "completed":
    case "in_progress":
      return MEDBRAINS_COLORS.statusSuccessBg;
    case "scheduled":
    case "collection_in_progress":
    case "preparing":
    case "issued":
    case "active":
      return MEDBRAINS_COLORS.statusWarningBg;
    case "partially_paid":
    case "on_hold":
      return MEDBRAINS_COLORS.accentMuted;
    default:
      return MEDBRAINS_COLORS.navActiveBg;
  }
}

function opdToken(token: QueueToken): DisplayToken {
  return {
    meta: token.priority === "normal" ? "Standard priority" : priorityLabel(token.priority),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function labToken(token: LabQueueToken): DisplayToken {
  return {
    meta: [
      `${token.test_count} test${token.test_count === 1 ? "" : "s"}`,
      token.counter !== null ? `Counter ${token.counter}` : null,
      token.is_fasting ? "Fasting" : null,
      token.is_pediatric ? "Pediatric" : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function radiologyToken(token: RadiologyQueueToken): DisplayToken {
  return {
    meta: [token.modality, token.room_number]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function pharmacyToken(token: PharmacyQueueToken): DisplayToken {
  return {
    meta: [
      `${token.prescription_count} item${token.prescription_count === 1 ? "" : "s"}`,
      token.counter !== null ? `Counter ${token.counter}` : null,
      token.estimated_wait_minutes !== null ? `${token.estimated_wait_minutes} min wait` : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function billingToken(token: BillingQueueToken): DisplayToken {
  return {
    meta: [token.queue_type, token.counter !== null ? `Counter ${token.counter}` : null]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function SummaryMetric({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number | string;
}) {
  return (
    <Surface style={[styles.metricCard, { borderLeftColor: color }]} elevation={1}>
      <Text variant="headlineSmall" style={styles.metricValue}>
        {value}
      </Text>
      <Text variant="labelSmall" style={styles.metricLabel}>
        {label}
      </Text>
    </Surface>
  );
}

function PrivacyNotice() {
  return (
    <Surface style={styles.privacyPanel} elevation={0}>
      <Avatar.Icon size={34} icon="shield-check-outline" style={styles.privacyIcon} />
      <View style={styles.privacyTextBlock}>
        <Text variant="labelSmall" style={styles.privacyTitle}>
          Privacy display mode
        </Text>
        <Text variant="bodySmall" style={styles.privacyText}>
          {TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE}
        </Text>
      </View>
    </Surface>
  );
}

function BoardCard({
  children,
  isError,
  isLoading,
  lastUpdatedAt,
  subtitle,
  title,
}: {
  children: ReactNode;
  isError: boolean;
  isLoading: boolean;
  lastUpdatedAt: number;
  subtitle: string;
  title: string;
}) {
  return (
    <Surface style={styles.boardCard} elevation={1}>
      <View style={styles.boardHeader}>
        <View style={styles.boardTitleBlock}>
          <Text variant="titleMedium" style={styles.boardTitle}>
            {title}
          </Text>
          <Text variant="bodySmall" style={styles.boardSubtitle}>
            {subtitle}
          </Text>
        </View>
        <Chip compact mode="outlined" style={isError ? styles.errorChip : styles.syncChip}>
          {isError ? "Feed error" : `Sync ${lastSyncLabel(lastUpdatedAt)}`}
        </Chip>
      </View>
      {isLoading ? (
        <View style={styles.statePanel}>
          <ActivityIndicator size="small" />
          <Text variant="bodySmall" style={styles.stateText}>
            Loading token feed...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.statePanel}>
          <Avatar.Icon size={40} icon="wifi-alert" style={styles.stateIcon} />
          <Text variant="bodySmall" style={styles.stateText}>
            Feed unavailable. Check network and display permissions.
          </Text>
        </View>
      ) : (
        children
      )}
    </Surface>
  );
}

function TokenLane({
  emptyLabel,
  title,
  tokens,
}: {
  emptyLabel: string;
  title: string;
  tokens: DisplayToken[];
}) {
  return (
    <View style={styles.lane}>
      <View style={styles.laneHeader}>
        <Text variant="labelSmall" style={styles.laneTitle}>
          {title}
        </Text>
        <Badge size={22}>{tokens.length}</Badge>
      </View>
      {tokens.length === 0 ? (
        <Text variant="bodySmall" style={styles.emptyText}>
          {emptyLabel}
        </Text>
      ) : (
        <View style={styles.tokenList}>
          {tokens.map((token) => (
            <Surface
              key={`${title}-${token.tokenNumber}`}
              style={[styles.tokenCard, { backgroundColor: statusColor(token.status) }]}
              elevation={0}
            >
              <View>
                <Text variant="titleMedium" style={styles.tokenNumber}>
                  {token.tokenNumber}
                </Text>
                <Text variant="bodySmall" style={styles.tokenMeta}>
                  {token.meta}
                </Text>
              </View>
              <Text variant="labelSmall" style={styles.tokenStatus}>
                {statusLabel(token.status)}
              </Text>
            </Surface>
          ))}
        </View>
      )}
    </View>
  );
}

function TriageLane({
  color,
  label,
  tokens,
}: {
  color: string;
  label: string;
  tokens: ErTriageToken[];
}) {
  const overdueCount = tokens.filter((token) => token.is_overdue).length;

  return (
    <View style={[styles.triageLane, { borderLeftColor: color }]}>
      <View style={styles.laneHeader}>
        <View>
          <Text variant="labelSmall" style={[styles.triageLabel, { color }]}>
            {label}
          </Text>
          <Text variant="bodySmall" style={styles.tokenMeta}>
            {tokens.length === 0
              ? "No waiting tokens"
              : `${tokens.length} waiting · ${overdueCount} overdue`}
          </Text>
        </View>
        <View style={styles.triageTokens}>
          {tokens.length === 0 ? (
            <Chip compact mode="outlined">
              Clear
            </Chip>
          ) : (
            tokens.map((token) => (
              <Chip
                compact
                key={`${token.triage_level}-${token.token_number}`}
                mode={token.is_overdue ? "flat" : "outlined"}
                style={token.is_overdue ? styles.overdueChip : undefined}
              >
                {token.token_number}
              </Chip>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

export function TokenBoardsScreen() {
  const theme = useTheme();
  const canViewOpd = useHasAnyPermission(OPD_BOARD.requiredAnyPermissions);
  const canViewLab = useHasAnyPermission(LAB_BOARD.requiredAnyPermissions);
  const canViewRadiology = useHasAnyPermission(RADIOLOGY_BOARD.requiredAnyPermissions);
  const canViewEr = useHasAnyPermission(EMERGENCY_BOARD.requiredAnyPermissions);
  const canViewPharmacy = useHasAnyPermission(PHARMACY_BOARD.requiredAnyPermissions);
  const canViewBilling = useHasAnyPermission(BILLING_BOARD.requiredAnyPermissions);
  const canViewAnyBoard =
    canViewOpd || canViewLab || canViewRadiology || canViewEr || canViewPharmacy || canViewBilling;

  const opdQuery = useOpdTokenBoardQuery({ enabled: canViewOpd });
  const labQuery = useLabTokenBoardQuery({ enabled: canViewLab });
  const radiologyQuery = useRadiologyTokenBoardQuery("xray", { enabled: canViewRadiology });
  const erQuery = useErTokenBoardQuery({ enabled: canViewEr });
  const pharmacyQuery = usePharmacyTokenBoardQuery({ enabled: canViewPharmacy });
  const billingQuery = useBillingTokenBoardQuery({ enabled: canViewBilling });
  const opdTokens = opdQuery.data ?? [];
  const lab = labQuery.data;
  const radiology = radiologyQuery.data;
  const er = erQuery.data;
  const pharmacy = pharmacyQuery.data;
  const billing = billingQuery.data;
  const opdNowServing = opdTokens.filter(
    (token) => token.status === "called" || token.status === "in_progress",
  );
  const opdWaiting = opdTokens.filter((token) => token.status === "waiting");
  const overdueErTokens = TRIAGE_LANES.reduce(
    (count, lane) => count + (er?.[lane.key] ?? []).filter((token) => token.is_overdue).length,
    0,
  );
  const pharmacyNowServing = pharmacy?.current_token ? [pharmacy.current_token] : [];
  const billingNowServing =
    billing?.ipd_discharge[0] ??
    billing?.insurance_desk[0] ??
    billing?.opd_billing[0] ??
    billing?.advance_deposit[0] ??
    null;

  if (!canViewAnyBoard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.restrictedPanel}>
          <Avatar.Icon size={56} icon="shield-lock-outline" style={styles.stateIcon} />
          <Text variant="titleMedium">Token boards restricted</Text>
          <Text variant="bodySmall" style={styles.stateText}>
            Queue-board visibility follows your OPD, lab, radiology, emergency, pharmacy and billing
            permissions.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="headlineSmall" style={styles.title}>
              Token Boards
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Mobile view of token-only OPD, lab, radiology, ER, pharmacy and billing queues.
            </Text>
          </View>
          <Avatar.Icon size={48} icon="monitor-dashboard" />
        </View>

        <PrivacyNotice />

        <View style={styles.metricGrid}>
          <SummaryMetric
            color={MEDBRAINS_COLORS.copper}
            label="OPD waiting"
            value={canViewOpd ? opdWaiting.length : "—"}
          />
          <SummaryMetric
            color={MEDBRAINS_COLORS.red}
            label="ER waiting"
            value={er?.total_waiting ?? "—"}
          />
          <SummaryMetric
            color={MEDBRAINS_COLORS.brand}
            label="Lab waiting"
            value={lab?.stats.waiting_count ?? "—"}
          />
          <SummaryMetric
            color={MEDBRAINS_COLORS.copper}
            label="Radiology waiting"
            value={radiology?.stats.waiting_count ?? "—"}
          />
          <SummaryMetric
            color={MEDBRAINS_COLORS.emerald}
            label="Pharmacy ready"
            value={pharmacy?.stats.ready_count ?? "—"}
          />
          <SummaryMetric
            color={MEDBRAINS_COLORS.brand}
            label="Billing now"
            value={billingNowServing?.token_number ?? "—"}
          />
        </View>

        {canViewOpd && (
          <BoardCard
            title={OPD_BOARD.title}
            subtitle={OPD_BOARD.subtitle}
            isLoading={opdQuery.isLoading}
            isError={opdQuery.isError}
            lastUpdatedAt={opdQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title="Now serving"
                emptyLabel="No OPD token is currently called"
                tokens={opdNowServing.slice(0, TOKEN_LIMIT).map(opdToken)}
              />
              <TokenLane
                title="Next tokens"
                emptyLabel="No OPD tokens waiting"
                tokens={opdWaiting.slice(0, TOKEN_LIMIT).map(opdToken)}
              />
            </View>
          </BoardCard>
        )}

        {canViewLab && (
          <BoardCard
            title={LAB_BOARD.title}
            subtitle={LAB_BOARD.subtitle}
            isLoading={labQuery.isLoading}
            isError={labQuery.isError}
            lastUpdatedAt={labQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title="Collecting now"
                emptyLabel="No lab token is currently called"
                tokens={(lab?.current_tokens ?? []).slice(0, TOKEN_LIMIT).map(labToken)}
              />
              <TokenLane
                title="Waiting samples"
                emptyLabel="No lab sample tokens waiting"
                tokens={(lab?.waiting ?? []).slice(0, TOKEN_LIMIT).map(labToken)}
              />
              <TokenLane
                title="In progress"
                emptyLabel="No collections in progress"
                tokens={(lab?.collection_in_progress ?? []).slice(0, TOKEN_LIMIT).map(labToken)}
              />
            </View>
          </BoardCard>
        )}

        {canViewRadiology && (
          <BoardCard
            title={RADIOLOGY_BOARD.title}
            subtitle={RADIOLOGY_BOARD.subtitle}
            isLoading={radiologyQuery.isLoading}
            isError={radiologyQuery.isError}
            lastUpdatedAt={radiologyQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title="Called now"
                emptyLabel="No radiology token is currently called"
                tokens={radiology?.current_token ? [radiologyToken(radiology.current_token)] : []}
              />
              <TokenLane
                title="Waiting scans"
                emptyLabel="No radiology tokens waiting"
                tokens={(radiology?.waiting ?? []).slice(0, TOKEN_LIMIT).map(radiologyToken)}
              />
            </View>
          </BoardCard>
        )}

        {canViewEr && (
          <BoardCard
            title={EMERGENCY_BOARD.title}
            subtitle={`${overdueErTokens} overdue target${overdueErTokens === 1 ? "" : "s"}`}
            isLoading={erQuery.isLoading}
            isError={erQuery.isError}
            lastUpdatedAt={erQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              {TRIAGE_LANES.map((lane) => (
                <TriageLane
                  key={lane.key}
                  color={lane.color}
                  label={lane.label}
                  tokens={(er?.[lane.key] ?? []).slice(0, TOKEN_LIMIT)}
                />
              ))}
            </View>
          </BoardCard>
        )}

        {canViewPharmacy && (
          <BoardCard
            title={PHARMACY_BOARD.title}
            subtitle={PHARMACY_BOARD.subtitle}
            isLoading={pharmacyQuery.isLoading}
            isError={pharmacyQuery.isError}
            lastUpdatedAt={pharmacyQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title="Now serving"
                emptyLabel="No current token"
                tokens={pharmacyNowServing.map(pharmacyToken)}
              />
              <TokenLane
                title="Ready pickup"
                emptyLabel="No ready tokens"
                tokens={(pharmacy?.ready_for_pickup ?? []).slice(0, TOKEN_LIMIT).map(pharmacyToken)}
              />
              <TokenLane
                title="Preparing"
                emptyLabel="No preparing tokens"
                tokens={(pharmacy?.preparing ?? []).slice(0, TOKEN_LIMIT).map(pharmacyToken)}
              />
            </View>
          </BoardCard>
        )}

        {canViewBilling && (
          <BoardCard
            title={BILLING_BOARD.title}
            subtitle={BILLING_BOARD.subtitle}
            isLoading={billingQuery.isLoading}
            isError={billingQuery.isError}
            lastUpdatedAt={billingQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title="IPD discharge"
                emptyLabel="No IPD discharge bills"
                tokens={(billing?.ipd_discharge ?? []).slice(0, TOKEN_LIMIT).map(billingToken)}
              />
              <TokenLane
                title="OPD billing"
                emptyLabel="No OPD bills waiting"
                tokens={(billing?.opd_billing ?? []).slice(0, TOKEN_LIMIT).map(billingToken)}
              />
              <TokenLane
                title="Insurance desk"
                emptyLabel="No insurance tokens"
                tokens={(billing?.insurance_desk ?? []).slice(0, TOKEN_LIMIT).map(billingToken)}
              />
            </View>
          </BoardCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  boardCard: {
    borderRadius: 16,
    gap: 14,
    padding: 16,
  },
  boardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  boardSubtitle: {
    color: MEDBRAINS_COLORS.muted,
  },
  boardTitle: {
    fontWeight: "700",
  },
  boardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  container: {
    flex: 1,
  },
  emptyText: {
    color: MEDBRAINS_COLORS.muted,
    paddingVertical: 6,
  },
  errorChip: {
    backgroundColor: MEDBRAINS_COLORS.statusDangerBg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
  },
  lane: {
    gap: 8,
  },
  laneHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  laneStack: {
    gap: 12,
  },
  laneTitle: {
    color: MEDBRAINS_COLORS.muted,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricCard: {
    borderLeftWidth: 4,
    borderRadius: 14,
    flex: 1,
    minWidth: "30%",
    padding: 12,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricLabel: {
    color: MEDBRAINS_COLORS.muted,
  },
  metricValue: {
    fontWeight: "800",
  },
  overdueChip: {
    backgroundColor: MEDBRAINS_COLORS.statusDangerBg,
  },
  privacyIcon: {
    backgroundColor: MEDBRAINS_COLORS.statusSuccessBg,
  },
  privacyPanel: {
    alignItems: "center",
    backgroundColor: MEDBRAINS_COLORS.statusSuccessBg,
    borderColor: MEDBRAINS_COLORS.emerald,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  privacyText: {
    color: MEDBRAINS_COLORS.ink,
  },
  privacyTextBlock: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    color: MEDBRAINS_COLORS.statusSuccess,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  restrictedPanel: {
    alignItems: "center",
    flex: 1,
    gap: 10,
    justifyContent: "center",
    padding: 24,
  },
  scrollContent: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  stateIcon: {
    backgroundColor: MEDBRAINS_COLORS.statusSuccessBg,
  },
  statePanel: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  stateText: {
    color: MEDBRAINS_COLORS.muted,
    textAlign: "center",
  },
  subtitle: {
    color: MEDBRAINS_COLORS.muted,
  },
  syncChip: {
    backgroundColor: MEDBRAINS_COLORS.statusSuccessBg,
  },
  title: {
    fontWeight: "800",
  },
  tokenCard: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    padding: 12,
  },
  tokenList: {
    gap: 8,
  },
  tokenMeta: {
    color: MEDBRAINS_COLORS.muted,
  },
  tokenNumber: {
    fontWeight: "800",
  },
  tokenStatus: {
    color: MEDBRAINS_COLORS.brandDeep,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  triageLabel: {
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  triageLane: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
  },
  triageTokens: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    maxWidth: "58%",
  },
});
