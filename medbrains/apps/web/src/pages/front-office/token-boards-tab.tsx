// FRONT-OFFICE TokenBoardsTab — split from front-office.tsx (pure move).

import { Box, Card, Group, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import type {
  BillingQueueToken,
  ErTriageToken,
  TokenBoardReadinessItem,
  TokenBoardReadinessTone,
  TokenBoardStatusSignal,
  TokenBoardStatusTone,
  TokenBoardSurfaceDefinition,
  TokenBoardSurfaceId,
  TriageLevelColor,
} from "@medbrains/types";
import {
  BILLING_QUEUE_LANES,
  tokenBoardStatusLabel as sharedTokenBoardStatusLabel,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
  tokenBoardOperationalReadinessItems,
  tokenBoardReadinessLabel,
  tokenBoardReadinessLabelKey,
  tokenBoardReadinessValue,
  tokenBoardReadinessValueKey,
  tokenBoardRefreshValueKey,
  tokenBoardStatusLabelKey,
  tokenBoardSurfaceFlowLabelKey,
} from "@medbrains/types";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import type { DisplayToken, TokenBoardRouteDisplayMode } from "../front-office-token-boards";
import { BoardWaitEstimate } from "./board-wait-estimate";
import {
  BILLING_BOARD,
  EMERGENCY_BOARD,
  LAB_BOARD,
  OPD_BOARD,
  PHARMACY_BOARD,
  RADIOLOGY_BOARD,
} from "./shared";

type FrontOfficeTranslator = (
  key: string,
  values?: Record<string, boolean | number | string>,
) => string;

import {
  useFrontOfficeBillingTokenBoardQuery,
  useFrontOfficeEmergencyTokenBoardQuery,
  useFrontOfficeLabTokenBoardQuery,
  useFrontOfficeOpdTokenBoardQuery,
  useFrontOfficePharmacyTokenBoardQuery,
  useFrontOfficeRadiologyTokenBoardQuery,
} from "@/services/frontOffice.queries";
import type { TokenBoardFilter } from "../front-office-token-boards";
import {
  billingDisplayToken,
  labDisplayToken,
  opdDisplayToken,
  pharmacyDisplayToken,
  radiologyDisplayToken,
  tokenBoardDisplayModeFromSearchParams,
  tokenBoardFilterFromSearchParams,
  tokenBoardFilterRoute,
} from "../front-office-token-boards";

const TOKEN_BOARD_LIMIT = 8;
const TOKEN_BOARD_KIOSK_LIMIT = 12;

const TRIAGE_LANES: ReadonlyArray<{
  color: string;
  key: TriageLevelColor;
  label: string;
}> = [
  { color: "red", key: "red", label: "Red" },
  { color: "orange", key: "orange", label: "Orange" },
  { color: "yellow", key: "yellow", label: "Yellow" },
  { color: "green", key: "green", label: "Green" },
  { color: "blue", key: "blue", label: "Blue" },
];

const TRIAGE_LANE_BADGE_TONES: Record<string, BadgeTone> = {
  red: "danger",
  orange: "warning",
  yellow: "warning",
  green: "success",
  blue: "info",
};

function TokenBoardCard({
  children,
  displayMode,
  isError,
  isLoading,
  lastUpdatedAt,
  showLaunchMeta,
  surface,
  summary,
}: {
  children: ReactNode;
  displayMode: TokenBoardRouteDisplayMode;
  isError: boolean;
  isLoading: boolean;
  lastUpdatedAt: number;
  showLaunchMeta: boolean;
  surface: TokenBoardSurfaceDefinition;
  summary: Array<{ label: string; value: number | string }>;
}) {
  const { t } = useTranslation("frontOffice");

  return (
    <Card
      withBorder
      padding={displayMode === "kiosk" ? "lg" : "md"}
      style={displayMode === "kiosk" ? { minHeight: "calc(100vh - 164px)" } : undefined}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={0}>
            <Text fw={700}>{surface.title}</Text>
            <Text size="xs" c="dimmed">
              {surface.subtitle}
            </Text>
          </Stack>
          <Badge tone={isError ? "danger" : "success"}>
            {isError
              ? t("tokenBoards.card.feedError")
              : t("tokenBoards.card.sync", { time: lastUpdatedLabel(lastUpdatedAt) })}
          </Badge>
        </Group>
        {showLaunchMeta && <TokenBoardLaunchMeta surface={surface} />}
        <TokenBoardReadinessStrip
          items={tokenBoardReadinessItemsForWeb({
            isError,
            surface,
            t,
            updatedAt: lastUpdatedAt,
          })}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
          {summary.map((item) => (
            <Box
              key={item.label}
              p="xs"
              style={{
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 0,
              }}
            >
              <Text size="xs" c="dimmed" tt="uppercase">
                {item.label}
              </Text>
              <Text fw={800} size="xl">
                {item.value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
        {isLoading ? (
          <Text size="sm" c="dimmed">
            {t("tokenBoards.card.loading")}
          </Text>
        ) : isError ? (
          <Text size="sm" c="danger">
            {t("tokenBoards.card.feedUnavailable")}
          </Text>
        ) : (
          children
        )}
      </Stack>
    </Card>
  );
}

function TokenBoardLaunchMeta({ surface }: { surface: TokenBoardSurfaceDefinition }) {
  const { t } = useTranslation("frontOffice");

  return (
    <Stack gap={6}>
      <Group gap={6} wrap="wrap">
        {surface.targets.tvAppCodes.map((appCode) => (
          <Badge key={appCode} size="xs" variant="outline" tone="neutral">
            {appCode}
          </Badge>
        ))}
        <Badge size="xs" tone="info">
          {t("tokenBoards.launch.mobile")}: {surface.targets.mobileRoute} ·{" "}
          {surface.targets.mobileParams.surface}
        </Badge>
        <Badge size="xs" tone="success">
          {surface.targets.tvDisplayType}
        </Badge>
      </Group>
      <Group gap={8} wrap="nowrap">
        <Text size="xs" c="dimmed" fw={700}>
          {t("tokenBoards.launch.tvLink")}
        </Text>
        <Tooltip label={surface.targets.tvDeepLink}>
          <Text size="xs" c="dimmed" truncate style={{ flex: 1, minWidth: 0 }}>
            {surface.targets.tvDeepLink}
          </Text>
        </Tooltip>
      </Group>
      <Text size="xs" c="dimmed">
        {surface.privacyNotice}
      </Text>
    </Stack>
  );
}

function TokenBoardReadinessStrip({ items }: { items: TokenBoardReadinessItem[] }) {
  return (
    <Group gap={6} wrap="wrap">
      {items.map((item) => (
        <Badge key={`${item.label}-${item.value}`} tone={readinessColor(item.tone)}>
          {item.label}: {item.value}
        </Badge>
      ))}
    </Group>
  );
}

function TokenLane({
  emptyLabel,
  highlight = false,
  title,
  tokens,
}: {
  emptyLabel: string;
  highlight?: boolean;
  title: string;
  tokens: DisplayToken[];
}) {
  const { t } = useTranslation("frontOffice");

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">
          {title}
        </Text>
        <Badge size="xs">{tokens.length}</Badge>
      </Group>
      {tokens.length === 0 ? (
        <Box
          p="sm"
          style={{
            border: "1px solid var(--mantine-color-gray-3)",
            borderRadius: 0,
          }}
        >
          <Text size="sm" c="dimmed">
            {emptyLabel}
          </Text>
        </Box>
      ) : (
        <Stack gap="xs">
          {tokens.map((token) => {
            const statusText = tokenBoardStatusLabel(token.status, t);

            return (
              <Box
                key={`${title}-${token.tokenNumber}`}
                p="sm"
                style={{
                  border: "1px solid var(--mantine-color-gray-3)",
                  borderRadius: 0,
                }}
              >
                <Group justify="space-between" align="center">
                  <Group gap="sm" wrap="nowrap">
                    <TokenStatusShapeGlyph
                      highlight={highlight}
                      label={statusText}
                      signal={token.signal}
                    />
                    <Stack gap={0}>
                      <Text fw={800} size={highlight ? "xl" : "lg"}>
                        {token.tokenNumber}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {token.meta}
                      </Text>
                    </Stack>
                  </Group>
                  <Badge tone={tokenStatusBadgeColor(token.signal.tone)}>{statusText}</Badge>
                </Group>
              </Box>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

function ErTriageLane({
  color,
  label,
  tokens,
}: {
  color: string;
  label: string;
  tokens: ErTriageToken[];
}) {
  const laneTone: BadgeTone = (color ? TRIAGE_LANE_BADGE_TONES[color] : undefined) ?? "neutral";

  return (
    <Box
      p="sm"
      style={{
        border: "1px solid var(--mantine-color-gray-3)",
        borderRadius: 0,
      }}
    >
      <Group justify="space-between" align="flex-start">
        <Stack gap={0}>
          <Text size="xs" fw={700} c={color} tt="uppercase">
            {label}
          </Text>
          <Text size="xs" c="dimmed">
            {tokens.length === 0
              ? "No waiting tokens"
              : `${tokens.length} waiting · ${tokens.filter((token) => token.is_overdue).length} overdue`}
          </Text>
        </Stack>
        <Group gap={4} justify="flex-end">
          {tokens.length === 0 ? (
            <Badge>Clear</Badge>
          ) : (
            tokens.map((token) => (
              <Badge
                key={`${token.triage_level}-${token.token_number}`}
                tone={token.is_overdue ? "danger" : laneTone}
                variant={token.is_overdue ? "filled" : undefined}
              >
                {token.token_number}
              </Badge>
            ))
          )}
        </Group>
      </Group>
    </Box>
  );
}

function TokenStatusShapeGlyph({
  highlight,
  label,
  signal,
}: {
  highlight: boolean;
  label: string;
  signal: TokenBoardStatusSignal;
}) {
  return (
    <Tooltip label={label}>
      <Box
        aria-label={label}
        role="img"
        style={tokenStatusShapeStyle(signal, highlight)}
        title={label}
      />
    </Tooltip>
  );
}

function tokenBoardStatusLabel(status: string, t: FrontOfficeTranslator): string {
  const key = tokenBoardStatusLabelKey(status);
  return key ? t(key) : sharedTokenBoardStatusLabel(status);
}

function tokenBoardReadinessItemsForWeb({
  isError,
  surface,
  t,
  updatedAt,
}: {
  isError: boolean;
  surface: TokenBoardSurfaceDefinition;
  t: FrontOfficeTranslator;
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
      label: translatedTokenBoardText({
        fallback: tokenBoardReadinessLabel(item.label),
        key: tokenBoardReadinessLabelKey(item.label),
        t,
      }),
      value: translatedTokenBoardText({
        fallback: tokenBoardReadinessValue(item.value),
        key: valueKey,
        t,
        values,
      }),
    };
  });
}

interface TokenBoardsTabProps {
  canViewOpdQueue: boolean;
  canViewLab: boolean;
  canViewRadiology: boolean;
  canViewEmergency: boolean;
  canViewPharmacy: boolean;
  canViewBilling: boolean;
}

function readinessColor(tone: TokenBoardReadinessTone): BadgeTone {
  switch (tone) {
    case "danger":
      return "danger";
    case "warning":
      return "warning";
    case "success":
      return "success";
    default:
      return "info";
  }
}

function tokenStatusBadgeColor(tone: TokenBoardStatusTone): BadgeTone {
  switch (tone) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}

function tokenStatusShapeColors(tone: TokenBoardStatusTone) {
  switch (tone) {
    case "danger":
      return {
        background: "var(--mantine-color-red-1)",
        border: "var(--mantine-color-red-7)",
      };
    case "info":
      return {
        background: "var(--mantine-color-blue-1)",
        border: "var(--mantine-color-blue-7)",
      };
    case "success":
      return {
        background: "var(--mantine-color-teal-1)",
        border: "var(--mantine-color-teal-7)",
      };
    case "warning":
      return {
        background: "var(--mantine-color-orange-1)",
        border: "var(--mantine-color-orange-7)",
      };
    default:
      return {
        background: "var(--mantine-color-gray-0)",
        border: "var(--mantine-color-gray-6)",
      };
  }
}

function tokenStatusShapeStyle(signal: TokenBoardStatusSignal, highlight: boolean): CSSProperties {
  const colors = tokenStatusShapeColors(signal.tone);
  const size = signal.emphasis === "high" || highlight ? 18 : 14;
  const base: CSSProperties = {
    background: signal.shape === "ring" ? "transparent" : colors.background,
    border: `2px solid ${colors.border}`,
    flex: "0 0 auto",
    height: size,
    width: signal.shape === "pill" ? size + 12 : size,
  };

  switch (signal.shape) {
    case "circle":
    case "ring":
      return { ...base, borderRadius: 999 };
    case "diamond":
      return { ...base, borderRadius: 0, transform: "rotate(45deg)" };
    case "pill":
      return { ...base, borderRadius: 999 };
    default:
      return { ...base, borderRadius: 0 };
  }
}

function lastUpdatedLabel(value: number) {
  if (value === 0) return "pending";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function translatedTokenBoardText({
  fallback,
  key,
  t,
  values,
}: {
  fallback: string;
  key: string | null;
  t: FrontOfficeTranslator;
  values?: Record<string, boolean | number | string>;
}): string {
  if (!key) return fallback;

  const translated = t(key, values);
  return translated === key ? fallback : translated;
}

export function TokenBoardsTab({
  canViewOpdQueue,
  canViewLab,
  canViewRadiology,
  canViewEmergency,
  canViewPharmacy,
  canViewBilling,
}: TokenBoardsTabProps) {
  const { t } = useTranslation("frontOffice");
  const routeNavigate = useNavigate();
  const location = useLocation();
  const routeSearchParams = new URLSearchParams(location.search);
  const selectedSurface = tokenBoardFilterFromSearchParams(routeSearchParams);
  const displayMode = tokenBoardDisplayModeFromSearchParams(routeSearchParams);
  const opdQuery = useFrontOfficeOpdTokenBoardQuery({ enabled: canViewOpdQueue });
  const pharmacyQuery = useFrontOfficePharmacyTokenBoardQuery({ enabled: canViewPharmacy });
  const billingQuery = useFrontOfficeBillingTokenBoardQuery({ enabled: canViewBilling });
  const erQuery = useFrontOfficeEmergencyTokenBoardQuery({ enabled: canViewEmergency });
  const labQuery = useFrontOfficeLabTokenBoardQuery({ enabled: canViewLab });
  const radiologyQuery = useFrontOfficeRadiologyTokenBoardQuery("xray", {
    enabled: canViewRadiology,
  });

  const opdTokens = opdQuery.data ?? [];
  const lab = labQuery.data;
  const radiology = radiologyQuery.data;
  const pharmacy = pharmacyQuery.data;
  const billing = billingQuery.data;
  const er = erQuery.data;
  const opdNowServing = opdTokens.filter(
    (token) => token.status === "called" || token.status === "in_progress",
  );
  const opdWaiting = opdTokens.filter((token) => token.status === "waiting");
  const currentPharmacy = pharmacy?.current_token ? [pharmacy.current_token] : [];
  const billingNowServing =
    BILLING_QUEUE_LANES.map((lane) => billing?.[lane.key][0]).find(
      (token): token is BillingQueueToken => token !== undefined,
    ) ?? null;
  const overdueErTokens = TRIAGE_LANES.reduce(
    (count, lane) => count + (er?.[lane.key] ?? []).filter((token) => token.is_overdue).length,
    0,
  );
  const canViewAnyBoard =
    canViewOpdQueue ||
    canViewLab ||
    canViewRadiology ||
    canViewEmergency ||
    canViewPharmacy ||
    canViewBilling;
  const boardAccess: Readonly<Record<TokenBoardSurfaceId, boolean>> = {
    billing: canViewBilling,
    emergency: canViewEmergency,
    lab: canViewLab,
    opd: canViewOpdQueue,
    pharmacy: canViewPharmacy,
    radiology: canViewRadiology,
  };
  const isKioskDisplay = displayMode === "kiosk" && selectedSurface !== "all";
  const selectedSurfaceAccessDenied = selectedSurface !== "all" && !boardAccess[selectedSurface];
  const activeSurface = selectedSurfaceAccessDenied && !isKioskDisplay ? "all" : selectedSurface;
  const activeKioskSurface =
    isKioskDisplay && activeSurface !== "all" ? TOKEN_BOARD_SURFACES[activeSurface] : null;
  const accessibleSurfaces = TOKEN_BOARD_SURFACE_LIST.filter((surface) => boardAccess[surface.id]);
  const surfaceVisible = (surfaceId: TokenBoardSurfaceId) =>
    boardAccess[surfaceId] && (activeSurface === "all" || activeSurface === surfaceId);
  const tokenLimit = isKioskDisplay ? TOKEN_BOARD_KIOSK_LIMIT : TOKEN_BOARD_LIMIT;

  function handleBoardFilterChange(filter: TokenBoardFilter) {
    routeNavigate(
      tokenBoardFilterRoute(location.pathname, new URLSearchParams(location.search), filter),
      { replace: true },
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Text fw={700}>
            {activeKioskSurface ? activeKioskSurface.title : t("tokenBoards.liveTitle")}
          </Text>
          <Text size="sm" c="dimmed">
            {activeKioskSurface
              ? t("tokenBoards.kioskDescription", {
                  notice: t("tokenBoards.privacyNotice"),
                  subtitle: activeKioskSurface.subtitle,
                })
              : t("tokenBoards.workspaceDescription", {
                  notice: t("tokenBoards.privacyNotice"),
                })}
          </Text>
        </Stack>
        <Badge tone="success">
          {isKioskDisplay ? t("tokenBoards.mode.kiosk") : t("tokenBoards.mode.autoRefresh")}
        </Badge>
      </Group>

      {isKioskDisplay && selectedSurfaceAccessDenied ? (
        <Card withBorder padding="lg">
          <Stack gap="xs">
            <Text fw={700}>{TOKEN_BOARD_SURFACES[selectedSurface].restrictedLabel}</Text>
            <Text size="sm" c="dimmed">
              This kiosk route is locked to {TOKEN_BOARD_SURFACES[selectedSurface].title}. Display
              access follows the configured permission matrix and token-board surface assignment.
            </Text>
            <TokenBoardReadinessStrip
              items={tokenBoardReadinessItemsForWeb({
                isError: true,
                surface: TOKEN_BOARD_SURFACES[selectedSurface],
                t,
                updatedAt: 0,
              })}
            />
          </Stack>
        </Card>
      ) : !canViewAnyBoard ? (
        <Card withBorder padding="md">
          <Text fw={600}>Token boards restricted</Text>
          <Text size="sm" c="dimmed">
            Queue-board visibility follows OPD, lab, radiology, emergency, pharmacy and billing
            permissions.
          </Text>
        </Card>
      ) : (
        <>
          {activeSurface === "opd" && canViewOpdQueue && (
            <BoardWaitEstimate isKiosk={isKioskDisplay} />
          )}
          {!isKioskDisplay && (
            <Group gap="xs" wrap="wrap">
              <Button
                tone={activeSurface === "all" ? "primary" : "secondary"}
                size="xs"
                onClick={() => handleBoardFilterChange("all")}
              >
                {t("tokenBoards.filters.allBoards")}
              </Button>
              {accessibleSurfaces.map((surface) => (
                <Button
                  key={surface.id}
                  tone={activeSurface === surface.id ? "primary" : "secondary"}
                  size="xs"
                  onClick={() => handleBoardFilterChange(surface.id)}
                >
                  {surface.title}
                </Button>
              ))}
            </Group>
          )}
          <SimpleGrid cols={isKioskDisplay ? 1 : { base: 1, xl: 2 }} spacing="md">
            {surfaceVisible("opd") && (
              <TokenBoardCard
                surface={OPD_BOARD}
                isLoading={opdQuery.isLoading}
                isError={opdQuery.isError}
                lastUpdatedAt={opdQuery.dataUpdatedAt}
                showLaunchMeta={!isKioskDisplay}
                displayMode={displayMode}
                summary={[
                  { label: "Now", value: opdNowServing[0]?.token_number ?? "—" },
                  { label: "Waiting", value: opdWaiting.length },
                  {
                    label: "Priority",
                    value: opdWaiting.filter((t) => t.priority !== "normal").length,
                  },
                ]}
              >
                <Stack gap="sm">
                  <TokenLane
                    title="Now serving"
                    emptyLabel="No OPD token is currently called"
                    tokens={opdNowServing.slice(0, tokenLimit).map(opdDisplayToken)}
                    highlight
                  />
                  <TokenLane
                    title="Next tokens"
                    emptyLabel="No OPD tokens waiting"
                    tokens={opdWaiting.slice(0, tokenLimit).map(opdDisplayToken)}
                  />
                </Stack>
              </TokenBoardCard>
            )}

            {surfaceVisible("lab") && (
              <TokenBoardCard
                surface={LAB_BOARD}
                isLoading={labQuery.isLoading}
                isError={labQuery.isError}
                lastUpdatedAt={labQuery.dataUpdatedAt}
                showLaunchMeta={!isKioskDisplay}
                displayMode={displayMode}
                summary={[
                  { label: "Now", value: lab?.current_tokens[0]?.token_number ?? "—" },
                  { label: "Waiting", value: lab?.stats.waiting_count ?? "—" },
                  { label: "Counters", value: lab?.stats.counters_active ?? "—" },
                ]}
              >
                <Stack gap="sm">
                  <TokenLane
                    title="Collecting now"
                    emptyLabel="No lab token is currently called"
                    tokens={(lab?.current_tokens ?? []).slice(0, tokenLimit).map(labDisplayToken)}
                    highlight
                  />
                  <TokenLane
                    title="Waiting samples"
                    emptyLabel="No lab sample tokens waiting"
                    tokens={(lab?.waiting ?? []).slice(0, tokenLimit).map(labDisplayToken)}
                  />
                  <TokenLane
                    title="Collection in progress"
                    emptyLabel="No collections in progress"
                    tokens={(lab?.collection_in_progress ?? [])
                      .slice(0, tokenLimit)
                      .map(labDisplayToken)}
                  />
                </Stack>
              </TokenBoardCard>
            )}

            {surfaceVisible("radiology") && (
              <TokenBoardCard
                surface={RADIOLOGY_BOARD}
                isLoading={radiologyQuery.isLoading}
                isError={radiologyQuery.isError}
                lastUpdatedAt={radiologyQuery.dataUpdatedAt}
                showLaunchMeta={!isKioskDisplay}
                displayMode={displayMode}
                summary={[
                  { label: "Now", value: radiology?.current_token?.token_number ?? "—" },
                  { label: "Waiting", value: radiology?.stats.waiting_count ?? "—" },
                  { label: "Room", value: radiology?.room_number ?? "—" },
                ]}
              >
                <Stack gap="sm">
                  <TokenLane
                    title="Called now"
                    emptyLabel="No radiology token is currently called"
                    tokens={
                      radiology?.current_token
                        ? [radiologyDisplayToken(radiology.current_token)]
                        : []
                    }
                    highlight
                  />
                  <TokenLane
                    title="Waiting scans"
                    emptyLabel="No radiology tokens waiting"
                    tokens={(radiology?.waiting ?? [])
                      .slice(0, tokenLimit)
                      .map(radiologyDisplayToken)}
                  />
                </Stack>
              </TokenBoardCard>
            )}

            {surfaceVisible("emergency") && (
              <TokenBoardCard
                surface={EMERGENCY_BOARD}
                isLoading={erQuery.isLoading}
                isError={erQuery.isError}
                lastUpdatedAt={erQuery.dataUpdatedAt}
                showLaunchMeta={!isKioskDisplay}
                displayMode={displayMode}
                summary={[
                  { label: "Waiting", value: er?.total_waiting ?? "—" },
                  { label: "Overdue", value: overdueErTokens },
                  { label: "Bays", value: er?.resuscitation_bays_available ?? "—" },
                ]}
              >
                <Stack gap="xs">
                  {TRIAGE_LANES.map((lane) => (
                    <ErTriageLane
                      key={lane.key}
                      color={lane.color}
                      label={lane.label}
                      tokens={(er?.[lane.key] ?? []).slice(0, tokenLimit)}
                    />
                  ))}
                </Stack>
              </TokenBoardCard>
            )}

            {surfaceVisible("pharmacy") && (
              <TokenBoardCard
                surface={PHARMACY_BOARD}
                isLoading={pharmacyQuery.isLoading}
                isError={pharmacyQuery.isError}
                lastUpdatedAt={pharmacyQuery.dataUpdatedAt}
                showLaunchMeta={!isKioskDisplay}
                displayMode={displayMode}
                summary={[
                  { label: "Now", value: pharmacy?.current_token?.token_number ?? "—" },
                  { label: "Ready", value: pharmacy?.stats.ready_count ?? "—" },
                  { label: "Waiting", value: pharmacy?.stats.waiting_count ?? "—" },
                ]}
              >
                <Stack gap="sm">
                  <TokenLane
                    title="Now serving"
                    emptyLabel="No current token"
                    tokens={currentPharmacy.map(pharmacyDisplayToken)}
                    highlight
                  />
                  <TokenLane
                    title="Ready pickup"
                    emptyLabel="No ready tokens"
                    tokens={(pharmacy?.ready_for_pickup ?? [])
                      .slice(0, tokenLimit)
                      .map(pharmacyDisplayToken)}
                  />
                  <TokenLane
                    title="Preparing"
                    emptyLabel="No preparing tokens"
                    tokens={(pharmacy?.preparing ?? [])
                      .slice(0, tokenLimit)
                      .map(pharmacyDisplayToken)}
                  />
                </Stack>
              </TokenBoardCard>
            )}

            {surfaceVisible("billing") && (
              <TokenBoardCard
                surface={BILLING_BOARD}
                isLoading={billingQuery.isLoading}
                isError={billingQuery.isError}
                lastUpdatedAt={billingQuery.dataUpdatedAt}
                showLaunchMeta={!isKioskDisplay}
                displayMode={displayMode}
                summary={[
                  { label: "Now", value: billingNowServing?.token_number ?? "—" },
                  ...BILLING_QUEUE_LANES.map((lane) => ({
                    label: lane.summaryLabel,
                    value: billing?.[lane.key].length ?? "—",
                  })),
                ]}
              >
                <Stack gap="sm">
                  {BILLING_QUEUE_LANES.map((lane) => (
                    <TokenLane
                      key={lane.key}
                      title={lane.title}
                      emptyLabel={lane.emptyLabel}
                      tokens={(billing?.[lane.key] ?? [])
                        .slice(0, tokenLimit)
                        .map(billingDisplayToken)}
                    />
                  ))}
                </Stack>
              </TokenBoardCard>
            )}
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
