import { useHasAnyPermission } from "@medbrains/stores";
import type {
  BillingQueueLaneKey,
  BillingQueueToken,
  ErTriageToken,
  LabQueueToken,
  PharmacyQueueToken,
  QueuePriority,
  QueueToken,
  RadiologyQueueToken,
  TokenBoardReadinessItem,
  TokenBoardReadinessTone,
  TokenBoardStatusSignal,
  TokenBoardStatusTone,
  TokenBoardSurfaceDefinition,
  TokenBoardSurfaceFilter,
  TokenBoardSurfaceId,
  TriageLevelColor,
} from "@medbrains/types";
import {
  BILLING_QUEUE_LANES,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
  tokenBoardMobileRouteParams,
  tokenBoardOperationalReadinessItems,
  tokenBoardReadinessLabel,
  tokenBoardReadinessLabelKey,
  tokenBoardReadinessValue,
  tokenBoardReadinessValueKey,
  tokenBoardRefreshValueKey,
  tokenBoardStatusLabel,
  tokenBoardStatusLabelKey,
  tokenBoardStatusSignal,
  tokenBoardSurfaceFilterFromParam,
  tokenBoardSurfaceFlowLabelKey,
} from "@medbrains/types";
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
  MOBILE_TOKEN_BOARDS_TEXT,
  mobilePatientJourneyText,
} from "../../components/patientJourneyText";
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
const TOKEN_BOARDS_TEXT = MOBILE_TOKEN_BOARDS_TEXT;

const SURFACE_TEXT_KEYS: Record<
  TokenBoardSurfaceId,
  {
    flow: string;
    restricted: string;
    subtitle: string;
    title: string;
  }
> = {
  billing: TOKEN_BOARDS_TEXT.surfaces.billing,
  emergency: TOKEN_BOARDS_TEXT.surfaces.emergency,
  lab: TOKEN_BOARDS_TEXT.surfaces.lab,
  opd: TOKEN_BOARDS_TEXT.surfaces.opd,
  pharmacy: TOKEN_BOARDS_TEXT.surfaces.pharmacy,
  radiology: TOKEN_BOARDS_TEXT.surfaces.radiology,
};

const BILLING_LANE_TEXT_KEYS: Record<
  BillingQueueLaneKey,
  {
    empty: string;
    title: string;
  }
> = {
  advance_deposit: {
    empty: TOKEN_BOARDS_TEXT.lanes.billing.advanceDepositEmpty,
    title: TOKEN_BOARDS_TEXT.lanes.billing.advanceDeposit,
  },
  insurance_desk: {
    empty: TOKEN_BOARDS_TEXT.lanes.billing.insuranceDeskEmpty,
    title: TOKEN_BOARDS_TEXT.lanes.billing.insuranceDesk,
  },
  ipd_discharge: {
    empty: TOKEN_BOARDS_TEXT.lanes.billing.ipdDischargeEmpty,
    title: TOKEN_BOARDS_TEXT.lanes.billing.ipdDischarge,
  },
  opd_billing: {
    empty: TOKEN_BOARDS_TEXT.lanes.billing.opdBillingEmpty,
    title: TOKEN_BOARDS_TEXT.lanes.billing.opdBilling,
  },
};

const PRIORITY_LABEL_KEYS: Record<QueuePriority, string> = {
  disabled: TOKEN_BOARDS_TEXT.priority.disabled,
  elderly: TOKEN_BOARDS_TEXT.priority.elderly,
  emergency_referral: TOKEN_BOARDS_TEXT.priority.emergencyReferral,
  normal: TOKEN_BOARDS_TEXT.priority.normal,
  pregnant: TOKEN_BOARDS_TEXT.priority.pregnant,
  vip: TOKEN_BOARDS_TEXT.priority.vip,
};

const BILLING_QUEUE_TYPE_LABEL_KEYS: Partial<Record<string, string>> = {
  advance_deposit: TOKEN_BOARDS_TEXT.lanes.billing.advanceDeposit,
  insurance_desk: TOKEN_BOARDS_TEXT.lanes.billing.insuranceDesk,
  ipd_discharge: TOKEN_BOARDS_TEXT.lanes.billing.ipdDischarge,
  opd_billing: TOKEN_BOARDS_TEXT.lanes.billing.opdBilling,
};

const TRIAGE_LANES: ReadonlyArray<{
  color: string;
  key: TriageLevelColor;
  labelKey: string;
}> = [
  { color: MEDBRAINS_COLORS.red, key: "red", labelKey: TOKEN_BOARDS_TEXT.triage.red },
  { color: MEDBRAINS_COLORS.copper, key: "orange", labelKey: TOKEN_BOARDS_TEXT.triage.orange },
  {
    color: MEDBRAINS_COLORS.statusWarning,
    key: "yellow",
    labelKey: TOKEN_BOARDS_TEXT.triage.yellow,
  },
  { color: MEDBRAINS_COLORS.emerald, key: "green", labelKey: TOKEN_BOARDS_TEXT.triage.green },
  { color: MEDBRAINS_COLORS.brand, key: "blue", labelKey: TOKEN_BOARDS_TEXT.triage.blue },
];

interface DisplayToken {
  meta: string;
  signal: TokenBoardStatusSignal;
  status: string;
  tokenNumber: string;
}

interface BoardMetric {
  color: string;
  id: TokenBoardSurfaceId;
  label: string;
  value: number | string;
}

interface TokenBoardsScreenProps {
  navigation?: {
    setParams: (params: { surface?: TokenBoardSurfaceId }) => void;
  };
  route?: {
    params?: {
      surface?: TokenBoardSurfaceId;
    };
  };
}

function tokenBoardsText(key: string, values?: Record<string, string | number | boolean>): string {
  return mobilePatientJourneyText(key, values);
}

function mobileTokenBoardI18nKey(sharedKey: string): string {
  return `patientJourney.mobile.${sharedKey}`;
}

function mobileSharedTokenBoardText({
  fallback,
  key,
  values,
}: {
  fallback: string;
  key: string | null;
  values?: Record<string, string | number | boolean>;
}): string {
  return key ? tokenBoardsText(mobileTokenBoardI18nKey(key), values) : fallback;
}

function countLabel(count: number, singularKey: string, pluralKey: string): string {
  return tokenBoardsText(count === 1 ? singularKey : pluralKey, { count });
}

function overdueTargetLabel(count: number): string {
  return countLabel(
    count,
    TOKEN_BOARDS_TEXT.triage.overdueTargetsSingular,
    TOKEN_BOARDS_TEXT.triage.overdueTargetsPlural,
  );
}

function statusLabel(value: string) {
  return mobileSharedTokenBoardText({
    fallback: tokenBoardStatusLabel(value),
    key: tokenBoardStatusLabelKey(value),
  });
}

function priorityLabel(value: QueuePriority) {
  return tokenBoardsText(PRIORITY_LABEL_KEYS[value]);
}

function lastSyncLabel(updatedAt: number) {
  if (updatedAt === 0) return tokenBoardsText(TOKEN_BOARDS_TEXT.common.pending);
  return new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function syncLabel(isError: boolean, updatedAt: number): string {
  if (isError) return tokenBoardsText(TOKEN_BOARDS_TEXT.common.feedError);
  return tokenBoardsText(TOKEN_BOARDS_TEXT.common.syncStatus, { time: lastSyncLabel(updatedAt) });
}

function surfaceTitle(surface: TokenBoardSurfaceDefinition): string {
  return tokenBoardsText(SURFACE_TEXT_KEYS[surface.id].title);
}

function surfaceSubtitle(surface: TokenBoardSurfaceDefinition): string {
  return tokenBoardsText(SURFACE_TEXT_KEYS[surface.id].subtitle);
}

function surfaceRestrictedLabel(surface: TokenBoardSurfaceDefinition): string {
  return tokenBoardsText(SURFACE_TEXT_KEYS[surface.id].restricted);
}

function counterLabel(counter: number): string {
  return tokenBoardsText(TOKEN_BOARDS_TEXT.meta.counter, { counter });
}

function billingQueueTypeLabel(queueType: string): string {
  const key = BILLING_QUEUE_TYPE_LABEL_KEYS[queueType];
  return key ? tokenBoardsText(key) : queueType;
}

function tokenBoardReadinessItems({
  isError,
  surface,
  updatedAt,
}: {
  isError: boolean;
  surface: TokenBoardSurfaceDefinition;
  updatedAt: number;
}): TokenBoardReadinessItem[] {
  return tokenBoardOperationalReadinessItems({ isError, surface, updatedAt }).map((item) => {
    const valueKey =
      item.label === "Refresh"
        ? tokenBoardRefreshValueKey()
        : item.label === "Flow"
          ? tokenBoardSurfaceFlowLabelKey(surface.id)
          : tokenBoardReadinessValueKey(item.value);

    const values =
      item.label === "Refresh" ? { seconds: surface.refreshIntervalMs / 1_000 } : undefined;

    return {
      ...item,
      label: mobileSharedTokenBoardText({
        fallback: tokenBoardReadinessLabel(item.label),
        key: tokenBoardReadinessLabelKey(item.label),
      }),
      value: mobileSharedTokenBoardText({
        fallback: tokenBoardReadinessValue(item.value),
        key: valueKey,
        values,
      }),
    };
  });
}

function statusSignalColors(tone: TokenBoardStatusTone) {
  switch (tone) {
    case "danger":
      return {
        background: MEDBRAINS_COLORS.statusDangerBg,
        border: MEDBRAINS_COLORS.statusDanger,
      };
    case "info":
      return {
        background: MEDBRAINS_COLORS.navActiveBg,
        border: MEDBRAINS_COLORS.brand,
      };
    case "success":
      return {
        background: MEDBRAINS_COLORS.statusSuccessBg,
        border: MEDBRAINS_COLORS.emerald,
      };
    case "warning":
      return {
        background: MEDBRAINS_COLORS.statusWarningBg,
        border: MEDBRAINS_COLORS.statusWarning,
      };
    default:
      return {
        background: MEDBRAINS_COLORS.navActiveBg,
        border: MEDBRAINS_COLORS.muted,
      };
  }
}

function statusShapeStyle(signal: TokenBoardStatusSignal) {
  const colors = statusSignalColors(signal.tone);
  const size = signal.emphasis === "high" ? 18 : 14;
  const base = {
    backgroundColor: signal.shape === "ring" ? "transparent" : colors.background,
    borderColor: colors.border,
    borderWidth: 2,
    height: size,
    width: signal.shape === "pill" ? size + 12 : size,
  };

  switch (signal.shape) {
    case "circle":
    case "ring":
      return { ...base, borderRadius: 999 };
    case "diamond":
      return { ...base, borderRadius: 3, transform: [{ rotate: "45deg" }] };
    case "pill":
      return { ...base, borderRadius: 999 };
    default:
      return { ...base, borderRadius: 4 };
  }
}

function TokenStatusShape({ label, signal }: { label: string; signal: TokenBoardStatusSignal }) {
  return <View accessibilityLabel={label} style={statusShapeStyle(signal)} />;
}

function opdToken(token: QueueToken): DisplayToken {
  return {
    meta: priorityLabel(token.priority),
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function labToken(token: LabQueueToken): DisplayToken {
  return {
    meta: [
      countLabel(
        token.test_count,
        TOKEN_BOARDS_TEXT.meta.testsCountSingular,
        TOKEN_BOARDS_TEXT.meta.testsCountPlural,
      ),
      token.counter !== null ? counterLabel(token.counter) : null,
      token.is_fasting ? tokenBoardsText(TOKEN_BOARDS_TEXT.meta.fasting) : null,
      token.is_pediatric ? tokenBoardsText(TOKEN_BOARDS_TEXT.meta.pediatric) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function radiologyToken(token: RadiologyQueueToken): DisplayToken {
  return {
    meta: [token.modality, token.room_number]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function pharmacyToken(token: PharmacyQueueToken): DisplayToken {
  return {
    meta: [
      countLabel(
        token.prescription_count,
        TOKEN_BOARDS_TEXT.meta.itemsCountSingular,
        TOKEN_BOARDS_TEXT.meta.itemsCountPlural,
      ),
      token.counter !== null ? counterLabel(token.counter) : null,
      token.estimated_wait_minutes !== null
        ? tokenBoardsText(TOKEN_BOARDS_TEXT.meta.waitMinutes, {
            minutes: token.estimated_wait_minutes,
          })
        : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    signal: tokenBoardStatusSignal(token.status),
    status: token.status,
    tokenNumber: token.token_number,
  };
}

function billingToken(token: BillingQueueToken): DisplayToken {
  return {
    meta: [
      billingQueueTypeLabel(token.queue_type),
      token.counter !== null ? counterLabel(token.counter) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    signal: tokenBoardStatusSignal(token.status),
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
          {tokenBoardsText(TOKEN_BOARDS_TEXT.common.privacyMode)}
        </Text>
        <Text variant="bodySmall" style={styles.privacyText}>
          {tokenBoardsText(TOKEN_BOARDS_TEXT.common.privacyNotice)}
        </Text>
      </View>
    </Surface>
  );
}

function LaunchTargetPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.launchPathPill}>
      <Text variant="labelSmall" style={styles.launchPathLabel}>
        {label}
      </Text>
      <Text
        ellipsizeMode="middle"
        numberOfLines={1}
        variant="labelSmall"
        style={styles.launchPathText}
      >
        {value}
      </Text>
    </View>
  );
}

function BoardCard({
  children,
  isError,
  isLoading,
  lastUpdatedAt,
  surface,
  subtitle,
}: {
  children: ReactNode;
  isError: boolean;
  isLoading: boolean;
  lastUpdatedAt: number;
  surface: TokenBoardSurfaceDefinition;
  subtitle: string;
}) {
  return (
    <Surface style={styles.boardCard} elevation={1}>
      <View style={styles.boardHeader}>
        <View style={styles.boardTitleBlock}>
          <Text variant="titleMedium" style={styles.boardTitle}>
            {surfaceTitle(surface)}
          </Text>
          <Text variant="bodySmall" style={styles.boardSubtitle}>
            {subtitle}
          </Text>
        </View>
        <Chip compact mode="outlined" style={isError ? styles.errorChip : styles.syncChip}>
          {syncLabel(isError, lastUpdatedAt)}
        </Chip>
      </View>
      <View style={styles.launchMeta}>
        {surface.targets.tvAppCodes.map((appCode) => (
          <Chip key={appCode} compact mode="outlined" style={styles.launchChip}>
            {appCode}
          </Chip>
        ))}
        <LaunchTargetPill
          label={tokenBoardsText(TOKEN_BOARDS_TEXT.launch.mobile)}
          value={`${surface.targets.mobileRoute} · ${surface.targets.mobileParams.surface}`}
        />
        <LaunchTargetPill
          label={tokenBoardsText(TOKEN_BOARDS_TEXT.launch.web)}
          value={surface.targets.webPath}
        />
        <LaunchTargetPill
          label={tokenBoardsText(TOKEN_BOARDS_TEXT.launch.tv)}
          value={surface.targets.tvDeepLink}
        />
        <LaunchTargetPill
          label={tokenBoardsText(TOKEN_BOARDS_TEXT.launch.kiosk)}
          value={surface.targets.kioskPath}
        />
      </View>
      <TokenBoardReadinessStrip
        items={tokenBoardReadinessItems({
          isError,
          surface,
          updatedAt: lastUpdatedAt,
        })}
      />
      {isLoading ? (
        <View style={styles.statePanel}>
          <ActivityIndicator size="small" />
          <Text variant="bodySmall" style={styles.stateText}>
            {tokenBoardsText(TOKEN_BOARDS_TEXT.common.loadingFeed)}
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.statePanel}>
          <Avatar.Icon size={40} icon="wifi-alert" style={styles.stateIcon} />
          <Text variant="bodySmall" style={styles.stateText}>
            {tokenBoardsText(TOKEN_BOARDS_TEXT.common.feedUnavailable)}
          </Text>
        </View>
      ) : (
        children
      )}
    </Surface>
  );
}

function readinessChipStyle(tone: TokenBoardReadinessTone) {
  switch (tone) {
    case "danger":
      return styles.readinessDangerChip;
    case "warning":
      return styles.readinessWarningChip;
    case "success":
      return styles.readinessSuccessChip;
    default:
      return styles.readinessInfoChip;
  }
}

function TokenBoardReadinessStrip({ items }: { items: TokenBoardReadinessItem[] }) {
  return (
    <View style={styles.readinessRow}>
      {items.map((item) => (
        <Chip
          compact
          key={`${item.label}-${item.value}`}
          mode="flat"
          style={readinessChipStyle(item.tone)}
        >
          {item.label}: {item.value}
        </Chip>
      ))}
    </View>
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
              style={[
                styles.tokenCard,
                { backgroundColor: statusSignalColors(token.signal.tone).background },
              ]}
              elevation={0}
            >
              <View style={styles.tokenIdentity}>
                <TokenStatusShape label={statusLabel(token.status)} signal={token.signal} />
                <View>
                  <Text variant="titleMedium" style={styles.tokenNumber}>
                    {token.tokenNumber}
                  </Text>
                  <Text variant="bodySmall" style={styles.tokenMeta}>
                    {token.meta}
                  </Text>
                </View>
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
  labelKey,
  tokens,
}: {
  color: string;
  labelKey: string;
  tokens: ErTriageToken[];
}) {
  const overdueCount = tokens.filter((token) => token.is_overdue).length;
  const waitingSummary =
    tokens.length === 0
      ? tokenBoardsText(TOKEN_BOARDS_TEXT.triage.noWaitingTokens)
      : tokenBoardsText(TOKEN_BOARDS_TEXT.triage.waitingSummary, {
          count: tokens.length,
          overdue: overdueCount,
        });

  return (
    <View style={[styles.triageLane, { borderLeftColor: color }]}>
      <View style={styles.laneHeader}>
        <View>
          <Text variant="labelSmall" style={[styles.triageLabel, { color }]}>
            {tokenBoardsText(labelKey)}
          </Text>
          <Text variant="bodySmall" style={styles.tokenMeta}>
            {waitingSummary}
          </Text>
        </View>
        <View style={styles.triageTokens}>
          {tokens.length === 0 ? (
            <Chip compact mode="outlined">
              {tokenBoardsText(TOKEN_BOARDS_TEXT.triage.clear)}
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

export function TokenBoardsScreen({ navigation, route }: TokenBoardsScreenProps) {
  const theme = useTheme();
  const selectedSurface = tokenBoardSurfaceFilterFromParam(route?.params?.surface);
  const canViewOpd = useHasAnyPermission(OPD_BOARD.requiredAnyPermissions);
  const canViewLab = useHasAnyPermission(LAB_BOARD.requiredAnyPermissions);
  const canViewRadiology = useHasAnyPermission(RADIOLOGY_BOARD.requiredAnyPermissions);
  const canViewEr = useHasAnyPermission(EMERGENCY_BOARD.requiredAnyPermissions);
  const canViewPharmacy = useHasAnyPermission(PHARMACY_BOARD.requiredAnyPermissions);
  const canViewBilling = useHasAnyPermission(BILLING_BOARD.requiredAnyPermissions);
  const canViewAnyBoard =
    canViewOpd || canViewLab || canViewRadiology || canViewEr || canViewPharmacy || canViewBilling;
  const boardAccess: Readonly<Record<TokenBoardSurfaceId, boolean>> = {
    billing: canViewBilling,
    emergency: canViewEr,
    lab: canViewLab,
    opd: canViewOpd,
    pharmacy: canViewPharmacy,
    radiology: canViewRadiology,
  };
  const selectedSurfaceAccessDenied = selectedSurface !== "all" && !boardAccess[selectedSurface];
  const activeSurface = selectedSurface;
  const restrictedSurface = selectedSurfaceAccessDenied
    ? TOKEN_BOARD_SURFACES[selectedSurface]
    : null;
  const accessibleSurfaces = TOKEN_BOARD_SURFACE_LIST.filter((surface) => boardAccess[surface.id]);
  const surfaceVisible = (surfaceId: TokenBoardSurfaceId) =>
    !selectedSurfaceAccessDenied &&
    boardAccess[surfaceId] &&
    (activeSurface === "all" || activeSurface === surfaceId);

  function handleSurfaceChange(filter: TokenBoardSurfaceFilter) {
    navigation?.setParams(tokenBoardMobileRouteParams(filter) ?? { surface: undefined });
  }

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
    BILLING_QUEUE_LANES.map((lane) => billing?.[lane.key][0]).find(
      (token): token is BillingQueueToken => token !== undefined,
    ) ?? null;
  const unavailableMetric = tokenBoardsText(TOKEN_BOARDS_TEXT.common.unavailable);
  const allMetrics: BoardMetric[] = [
    {
      color: MEDBRAINS_COLORS.copper,
      id: "opd",
      label: tokenBoardsText(TOKEN_BOARDS_TEXT.metrics.opdWaiting),
      value: opdWaiting.length,
    },
    {
      color: MEDBRAINS_COLORS.red,
      id: "emergency",
      label: tokenBoardsText(TOKEN_BOARDS_TEXT.metrics.erWaiting),
      value: er?.total_waiting ?? unavailableMetric,
    },
    {
      color: MEDBRAINS_COLORS.brand,
      id: "lab",
      label: tokenBoardsText(TOKEN_BOARDS_TEXT.metrics.labWaiting),
      value: lab?.stats.waiting_count ?? unavailableMetric,
    },
    {
      color: MEDBRAINS_COLORS.copper,
      id: "radiology",
      label: tokenBoardsText(TOKEN_BOARDS_TEXT.metrics.radiologyWaiting),
      value: radiology?.stats.waiting_count ?? unavailableMetric,
    },
    {
      color: MEDBRAINS_COLORS.emerald,
      id: "pharmacy",
      label: tokenBoardsText(TOKEN_BOARDS_TEXT.metrics.pharmacyReady),
      value: pharmacy?.stats.ready_count ?? unavailableMetric,
    },
    {
      color: MEDBRAINS_COLORS.brand,
      id: "billing",
      label: tokenBoardsText(TOKEN_BOARDS_TEXT.metrics.billingNow),
      value: billingNowServing?.token_number ?? unavailableMetric,
    },
  ];
  const metrics = allMetrics.filter((metric) => surfaceVisible(metric.id));

  if (!canViewAnyBoard) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.restrictedPanel}>
          <Avatar.Icon size={56} icon="shield-lock-outline" style={styles.stateIcon} />
          <Text variant="titleMedium">
            {tokenBoardsText(TOKEN_BOARDS_TEXT.common.noBoardAccessTitle)}
          </Text>
          <Text variant="bodySmall" style={styles.stateText}>
            {tokenBoardsText(TOKEN_BOARDS_TEXT.common.noBoardAccessMessage)}
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
              {tokenBoardsText(TOKEN_BOARDS_TEXT.common.title)}
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {tokenBoardsText(TOKEN_BOARDS_TEXT.common.subtitle)}
            </Text>
          </View>
          <Avatar.Icon size={48} icon="monitor-dashboard" />
        </View>

        <PrivacyNotice />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          <Chip
            compact
            mode={activeSurface === "all" ? "flat" : "outlined"}
            selected={activeSurface === "all"}
            onPress={() => handleSurfaceChange("all")}
            style={activeSurface === "all" ? styles.activeFilterChip : styles.filterChip}
          >
            {tokenBoardsText(TOKEN_BOARDS_TEXT.common.allBoards)}
          </Chip>
          {accessibleSurfaces.map((surface) => (
            <Chip
              compact
              key={surface.id}
              mode={activeSurface === surface.id ? "flat" : "outlined"}
              selected={activeSurface === surface.id}
              onPress={() => handleSurfaceChange(surface.id)}
              style={activeSurface === surface.id ? styles.activeFilterChip : styles.filterChip}
            >
              {surfaceTitle(surface)}
            </Chip>
          ))}
        </ScrollView>

        {restrictedSurface && (
          <Surface style={styles.boardRestrictedPanel} elevation={1}>
            <Avatar.Icon size={44} icon="shield-lock-outline" style={styles.stateIcon} />
            <View style={styles.privacyTextBlock}>
              <Text variant="titleSmall">{surfaceRestrictedLabel(restrictedSurface)}</Text>
              <Text variant="bodySmall" style={styles.stateTextLeft}>
                {tokenBoardsText(TOKEN_BOARDS_TEXT.common.restrictedSurfaceMessage, {
                  surface: surfaceTitle(restrictedSurface),
                })}
              </Text>
            </View>
          </Surface>
        )}

        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <SummaryMetric
              key={metric.id}
              color={metric.color}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </View>

        {surfaceVisible("opd") && (
          <BoardCard
            surface={OPD_BOARD}
            subtitle={surfaceSubtitle(OPD_BOARD)}
            isLoading={opdQuery.isLoading}
            isError={opdQuery.isError}
            lastUpdatedAt={opdQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.opd.nowServing)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.opd.nowServingEmpty)}
                tokens={opdNowServing.slice(0, TOKEN_LIMIT).map(opdToken)}
              />
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.opd.nextTokens)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.opd.nextTokensEmpty)}
                tokens={opdWaiting.slice(0, TOKEN_LIMIT).map(opdToken)}
              />
            </View>
          </BoardCard>
        )}

        {surfaceVisible("lab") && (
          <BoardCard
            surface={LAB_BOARD}
            subtitle={surfaceSubtitle(LAB_BOARD)}
            isLoading={labQuery.isLoading}
            isError={labQuery.isError}
            lastUpdatedAt={labQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.lab.collectingNow)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.lab.collectingNowEmpty)}
                tokens={(lab?.current_tokens ?? []).slice(0, TOKEN_LIMIT).map(labToken)}
              />
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.lab.waitingSamples)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.lab.waitingSamplesEmpty)}
                tokens={(lab?.waiting ?? []).slice(0, TOKEN_LIMIT).map(labToken)}
              />
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.lab.inProgress)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.lab.inProgressEmpty)}
                tokens={(lab?.collection_in_progress ?? []).slice(0, TOKEN_LIMIT).map(labToken)}
              />
            </View>
          </BoardCard>
        )}

        {surfaceVisible("radiology") && (
          <BoardCard
            surface={RADIOLOGY_BOARD}
            subtitle={surfaceSubtitle(RADIOLOGY_BOARD)}
            isLoading={radiologyQuery.isLoading}
            isError={radiologyQuery.isError}
            lastUpdatedAt={radiologyQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.radiology.calledNow)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.radiology.calledNowEmpty)}
                tokens={radiology?.current_token ? [radiologyToken(radiology.current_token)] : []}
              />
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.radiology.waitingScans)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.radiology.waitingScansEmpty)}
                tokens={(radiology?.waiting ?? []).slice(0, TOKEN_LIMIT).map(radiologyToken)}
              />
            </View>
          </BoardCard>
        )}

        {surfaceVisible("emergency") && (
          <BoardCard
            surface={EMERGENCY_BOARD}
            subtitle={overdueTargetLabel(overdueErTokens)}
            isLoading={erQuery.isLoading}
            isError={erQuery.isError}
            lastUpdatedAt={erQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              {TRIAGE_LANES.map((lane) => (
                <TriageLane
                  key={lane.key}
                  color={lane.color}
                  labelKey={lane.labelKey}
                  tokens={(er?.[lane.key] ?? []).slice(0, TOKEN_LIMIT)}
                />
              ))}
            </View>
          </BoardCard>
        )}

        {surfaceVisible("pharmacy") && (
          <BoardCard
            surface={PHARMACY_BOARD}
            subtitle={surfaceSubtitle(PHARMACY_BOARD)}
            isLoading={pharmacyQuery.isLoading}
            isError={pharmacyQuery.isError}
            lastUpdatedAt={pharmacyQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.pharmacy.nowServing)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.pharmacy.nowServingEmpty)}
                tokens={pharmacyNowServing.map(pharmacyToken)}
              />
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.pharmacy.readyPickup)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.pharmacy.readyPickupEmpty)}
                tokens={(pharmacy?.ready_for_pickup ?? []).slice(0, TOKEN_LIMIT).map(pharmacyToken)}
              />
              <TokenLane
                title={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.pharmacy.preparing)}
                emptyLabel={tokenBoardsText(TOKEN_BOARDS_TEXT.lanes.pharmacy.preparingEmpty)}
                tokens={(pharmacy?.preparing ?? []).slice(0, TOKEN_LIMIT).map(pharmacyToken)}
              />
            </View>
          </BoardCard>
        )}

        {surfaceVisible("billing") && (
          <BoardCard
            surface={BILLING_BOARD}
            subtitle={surfaceSubtitle(BILLING_BOARD)}
            isLoading={billingQuery.isLoading}
            isError={billingQuery.isError}
            lastUpdatedAt={billingQuery.dataUpdatedAt}
          >
            <View style={styles.laneStack}>
              {BILLING_QUEUE_LANES.map((lane) => (
                <TokenLane
                  key={lane.key}
                  title={tokenBoardsText(BILLING_LANE_TEXT_KEYS[lane.key].title)}
                  emptyLabel={tokenBoardsText(BILLING_LANE_TEXT_KEYS[lane.key].empty)}
                  tokens={(billing?.[lane.key] ?? []).slice(0, TOKEN_LIMIT).map(billingToken)}
                />
              ))}
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
  boardRestrictedPanel: {
    alignItems: "center",
    backgroundColor: MEDBRAINS_COLORS.statusWarningBg,
    borderColor: MEDBRAINS_COLORS.statusWarning,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
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
  activeFilterChip: {
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
  },
  filterChip: {
    backgroundColor: MEDBRAINS_COLORS.canvas,
  },
  filterChips: {
    gap: 8,
    paddingRight: 16,
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
  launchChip: {
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
  },
  launchPathLabel: {
    color: MEDBRAINS_COLORS.brandDeep,
    fontWeight: "700",
  },
  launchPathPill: {
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
    borderColor: MEDBRAINS_COLORS.rule,
    borderRadius: 14,
    borderWidth: 1,
    flexShrink: 1,
    gap: 2,
    maxWidth: "100%",
    minWidth: 128,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  launchPathText: {
    color: MEDBRAINS_COLORS.muted,
  },
  launchMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
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
  readinessDangerChip: {
    backgroundColor: MEDBRAINS_COLORS.statusDangerBg,
  },
  readinessInfoChip: {
    backgroundColor: MEDBRAINS_COLORS.navActiveBg,
  },
  readinessRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  readinessSuccessChip: {
    backgroundColor: MEDBRAINS_COLORS.statusSuccessBg,
  },
  readinessWarningChip: {
    backgroundColor: MEDBRAINS_COLORS.statusWarningBg,
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
  stateTextLeft: {
    color: MEDBRAINS_COLORS.muted,
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
  tokenIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
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
