import { MD3LightTheme } from "react-native-paper";

export const MEDBRAINS_COLORS = {
  brand: "#0066CC",
  brandHover: "#0052A3",
  brandDeep: "#00182F",
  ink: "#0D0D0C",
  canvas: "#FFFFFF",
  panel: "#F8F8F7",
  rule: "#E7E7E3",
  muted: "#5B5B57",
  copper: "#B7322E",
  accentMuted: "#FDE9E6",
  navActiveBg: "#EEF4FC",
  navActiveBgEnd: "#E6F1FF",
  emerald: "#1CB785",
  vital: "#34D69D",
  red: "#FF453A",
  statusInfo: "#0369A1",
  statusInfoBg: "#E0F2FE",
  statusSuccess: "#047857",
  statusSuccessBg: "#D1FAE5",
  statusWarning: "#B45309",
  statusWarningBg: "#FEF3C7",
  statusDanger: "#B91C1C",
  statusDangerBg: "#FEE2E2",
} as const;

export const APP_BAR_COLORS = {
  background: MEDBRAINS_COLORS.navActiveBg,
  foreground: MEDBRAINS_COLORS.brand,
  title: MEDBRAINS_COLORS.brandDeep,
} as const;

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: MEDBRAINS_COLORS.brand,
    secondary: MEDBRAINS_COLORS.copper,
    error: MEDBRAINS_COLORS.red,
    primaryContainer: MEDBRAINS_COLORS.navActiveBgEnd,
    onPrimaryContainer: MEDBRAINS_COLORS.brandDeep,
    secondaryContainer: MEDBRAINS_COLORS.accentMuted,
    onSecondaryContainer: MEDBRAINS_COLORS.statusDanger,
    tertiary: MEDBRAINS_COLORS.emerald,
    tertiaryContainer: MEDBRAINS_COLORS.statusSuccessBg,
    onTertiaryContainer: MEDBRAINS_COLORS.statusSuccess,
    surfaceVariant: MEDBRAINS_COLORS.panel,
    outline: MEDBRAINS_COLORS.rule,
  },
};
