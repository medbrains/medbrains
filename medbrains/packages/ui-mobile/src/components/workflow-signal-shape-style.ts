import type { ViewStyle } from "react-native";
import { COLORS, INTENT_BG, INTENT_FG } from "../tokens.js";

export type WorkflowSignalMarkerShape = "bed" | "diamond" | "pill" | "token";
export type WorkflowSignalMarkerTone =
  | "active"
  | "blocked"
  | "complete"
  | "neutral"
  | "ready"
  | "risk";
export type WorkflowSignalEmphasis = "high" | "standard";

export interface WorkflowSignalColors {
  background: string;
  border: string;
  text: string;
}

export interface WorkflowSignalShapeStyleInput {
  emphasis?: WorkflowSignalEmphasis;
  pillExtension?: number;
  shape: WorkflowSignalMarkerShape;
  size?: number;
  tone: WorkflowSignalMarkerTone;
}

export function workflowSignalColors(tone: WorkflowSignalMarkerTone): WorkflowSignalColors {
  switch (tone) {
    case "risk":
      return {
        background: INTENT_BG.alert,
        border: COLORS.red,
        text: INTENT_FG.alert,
      };
    case "active":
      return {
        background: COLORS.navActiveBg,
        border: COLORS.brand,
        text: COLORS.brand,
      };
    case "complete":
    case "ready":
      return {
        background: INTENT_BG.success,
        border: COLORS.emerald,
        text: INTENT_FG.success,
      };
    case "blocked":
      return {
        background: INTENT_BG.warn,
        border: COLORS.amber,
        text: INTENT_FG.warn,
      };
    default:
      return {
        background: COLORS.panel,
        border: COLORS.muted,
        text: COLORS.muted,
      };
  }
}

export function workflowSignalShapeStyle({
  emphasis = "standard",
  pillExtension = 14,
  shape,
  size,
  tone,
}: WorkflowSignalShapeStyleInput): ViewStyle {
  const colors = workflowSignalColors(tone);
  const markerSize = size ?? (emphasis === "high" ? 16 : 13);
  const base: ViewStyle = {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: emphasis === "high" ? 2 : 1.5,
    height: markerSize,
    width: shape === "pill" ? markerSize + pillExtension : markerSize,
  };

  switch (shape) {
    case "bed":
      return {
        ...base,
        borderRadius: 3,
        height: Math.max(12, Math.round(markerSize * 0.72)),
        width: markerSize + pillExtension + 6,
      };
    case "diamond":
      return { ...base, borderRadius: 3, transform: [{ rotate: "45deg" }] };
    case "pill":
      return { ...base, borderRadius: 999 };
    case "token":
      return { ...base, borderRadius: 4 };
  }
}
