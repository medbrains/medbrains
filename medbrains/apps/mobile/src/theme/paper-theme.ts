import { MD3LightTheme } from "react-native-paper";

export const MEDBRAINS_COLORS = {
  brand: "#0F766E",
  brandDeep: "#042f2e",
  canvas: "#FFFFFF",
  copper: "#B8924A",
  navActiveBg: "#ccfbf1",
  navActiveBgEnd: "#e0f2fe",
  emerald: "#10b981",
  red: "#C8102E",
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
    primaryContainer: MEDBRAINS_COLORS.navActiveBg,
    onPrimaryContainer: MEDBRAINS_COLORS.brandDeep,
  },
};
