import {
  type TokenBoardReadinessTone,
  type TokenBoardSurfaceDefinition,
  tokenBoardFeedIsStale,
  tokenBoardFeedReadiness,
  tokenBoardOperationalReadinessItems,
  tokenBoardReadinessLabel,
  tokenBoardReadinessValue,
  tokenBoardRefreshLabel,
} from "@medbrains/types";
import type { IntentTone } from "@medbrains/ui-mobile";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

interface TvFeedStatusBannerProps {
  errorLabel: string;
  isError: boolean;
  lastUpdatedAt: number;
  refreshIntervalMs: number;
}

export function tvLastUpdatedLabel(updatedAt: number) {
  if (updatedAt <= 0) return "not synced";
  return new Date(updatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function tvFeedIsStale(updatedAt: number, refreshIntervalMs: number) {
  return tokenBoardFeedIsStale(updatedAt, refreshIntervalMs);
}

function tvReadinessTone(tone: TokenBoardReadinessTone): IntentTone {
  switch (tone) {
    case "danger":
      return "alert";
    case "warning":
      return "warn";
    case "success":
      return "success";
    default:
      return "info";
  }
}

export function tvFeedReadiness(
  isError: boolean,
  updatedAt: number,
  refreshIntervalMs: number,
): { label: string; tone: IntentTone; value: string } {
  const readiness = tokenBoardFeedReadiness({ isError, refreshIntervalMs, updatedAt });
  return {
    label: tokenBoardReadinessLabel(readiness.label),
    tone: tvReadinessTone(readiness.tone),
    value: tokenBoardReadinessValue(readiness.value),
  };
}

export function tvTokenBoardLegend(
  surface: TokenBoardSurfaceDefinition,
  updatedAt: number,
  deepLink = surface.targets.tvDeepLink,
) {
  return `Updates every ${tokenBoardRefreshLabel(surface)} · last sync ${tvLastUpdatedLabel(updatedAt)} · ${deepLink}`;
}

export function tvTokenBoardReadinessItems({
  isError,
  surface,
  updatedAt,
}: {
  isError: boolean;
  surface: TokenBoardSurfaceDefinition;
  updatedAt: number;
}): { label: string; tone: IntentTone; value: string }[] {
  return tokenBoardOperationalReadinessItems({ isError, surface, updatedAt }).map((item) => ({
    label: tokenBoardReadinessLabel(item.label),
    tone: tvReadinessTone(item.tone),
    value: tokenBoardReadinessValue(item.value),
  }));
}

export function TvFeedStatusBanner({
  errorLabel,
  isError,
  lastUpdatedAt,
  refreshIntervalMs,
}: TvFeedStatusBannerProps) {
  const isStale = tvFeedIsStale(lastUpdatedAt, refreshIntervalMs);

  if (!isError && !isStale) {
    return null;
  }

  const tone = isError ? "error" : "stale";
  const message = isError ? errorLabel : "Showing last known tokens while the display reconnects.";

  return (
    <View style={[styles.banner, tone === "error" ? styles.error : styles.warning]}>
      <Text style={styles.title}>{tone === "error" ? "Feed degraded" : "Feed status"}</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.meta}>Last sync {tvLastUpdatedLabel(lastUpdatedAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
  },
  error: {
    backgroundColor: "rgba(200, 16, 46, 0.18)",
    borderColor: COLORS.red,
  },
  warning: {
    backgroundColor: "rgba(201, 145, 62, 0.18)",
    borderColor: COLORS.copper,
  },
  message: {
    color: COLORS.canvas,
    fontSize: 22,
    marginTop: SPACING.xs,
  },
  meta: {
    color: COLORS.tint,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
    marginTop: SPACING.xs,
    opacity: 0.72,
    textTransform: "uppercase",
  },
  title: {
    color: COLORS.emerald,
    fontFamily: "JetBrainsMono-Regular",
    fontSize: 16,
    textTransform: "uppercase",
  },
});
