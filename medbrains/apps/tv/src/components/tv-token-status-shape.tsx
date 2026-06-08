import type { TokenBoardStatusSignal, TokenBoardStatusTone } from "@medbrains/types";
import { COLORS } from "@medbrains/ui-mobile";
import { View } from "react-native";

export function tvTokenStatusSignalColors(tone: TokenBoardStatusTone) {
  switch (tone) {
    case "success":
      return {
        background: "rgba(28, 183, 133, 0.18)",
        border: COLORS.emerald,
      };
    case "danger":
      return {
        background: "rgba(200, 16, 46, 0.2)",
        border: COLORS.red,
      };
    case "warning":
      return {
        background: "rgba(201, 145, 62, 0.18)",
        border: COLORS.copper,
      };
    case "info":
      return {
        background: "rgba(103, 161, 236, 0.16)",
        border: COLORS.vital,
      };
    default:
      return {
        background: "transparent",
        border: COLORS.tint,
      };
  }
}

export function tvTokenStatusShapeStyle(signal: TokenBoardStatusSignal) {
  const colors = tvTokenStatusSignalColors(signal.tone);
  const size = signal.emphasis === "high" ? 26 : 20;
  const base = {
    backgroundColor: signal.shape === "ring" ? "transparent" : colors.background,
    borderColor: colors.border,
    borderWidth: 4,
    height: size,
    width: signal.shape === "pill" ? size + 18 : size,
  };

  switch (signal.shape) {
    case "circle":
    case "ring":
      return { ...base, borderRadius: 999 };
    case "diamond":
      return { ...base, borderRadius: 4, transform: [{ rotate: "45deg" }] };
    case "pill":
      return { ...base, borderRadius: 999 };
    default:
      return { ...base, borderRadius: 6 };
  }
}

export function TvTokenStatusShape({
  label,
  signal,
}: {
  label: string;
  signal: TokenBoardStatusSignal;
}) {
  return <View accessibilityLabel={label} style={tvTokenStatusShapeStyle(signal)} />;
}

export function tvTokenStatusTextColor(tone: TokenBoardStatusTone) {
  switch (tone) {
    case "success":
      return COLORS.emerald;
    case "danger":
      return COLORS.red;
    case "warning":
      return COLORS.copper;
    case "info":
      return COLORS.vital;
    default:
      return COLORS.tint;
  }
}
