import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type {
  BillingQueueToken,
  ErTriageToken,
  PharmacyQueueToken,
  TriageLevelColor,
} from "@medbrains/types";
import { P } from "@medbrains/types";
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
  usePharmacyTokenBoardQuery,
} from "../../services/tokenBoards.queries";
import { MEDBRAINS_COLORS } from "../../theme/paper-theme";

const TOKEN_LIMIT = 6;
const PRIVACY_NOTICE =
  "Token-only display mode. Patient names, identifiers, diagnoses, drug names and bill amounts stay hidden.";

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
      return MEDBRAINS_COLORS.statusSuccessBg;
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
          {PRIVACY_NOTICE}
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
  const canViewEr = useHasAnyPermission([P.EMERGENCY.VISITS_LIST, P.EMERGENCY.TRIAGE_LIST]);
  const canViewPharmacy = useHasAnyPermission([
    P.PHARMACY.PRESCRIPTIONS_LIST,
    P.PHARMACY.PRESCRIPTIONS_VIEW,
  ]);
  const canViewBilling = useHasPermission(P.BILLING.INVOICES_LIST);
  const canViewAnyBoard = canViewEr || canViewPharmacy || canViewBilling;

  const erQuery = useErTokenBoardQuery({ enabled: canViewEr });
  const pharmacyQuery = usePharmacyTokenBoardQuery({ enabled: canViewPharmacy });
  const billingQuery = useBillingTokenBoardQuery({ enabled: canViewBilling });
  const er = erQuery.data;
  const pharmacy = pharmacyQuery.data;
  const billing = billingQuery.data;
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
            Queue-board visibility follows your emergency, pharmacy and billing permissions.
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
              Mobile view of token-only ER, pharmacy and billing queues.
            </Text>
          </View>
          <Avatar.Icon size={48} icon="monitor-dashboard" />
        </View>

        <PrivacyNotice />

        <View style={styles.metricGrid}>
          <SummaryMetric
            color={MEDBRAINS_COLORS.red}
            label="ER waiting"
            value={er?.total_waiting ?? "—"}
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

        {canViewEr && (
          <BoardCard
            title="Emergency triage"
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
            title="Pharmacy pickup"
            subtitle="Prescription preparation and handover"
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
            title="Billing counters"
            subtitle="OPD, IPD discharge, advance and insurance desks"
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
