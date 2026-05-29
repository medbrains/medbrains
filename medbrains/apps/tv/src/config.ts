import { Platform } from "react-native";

const DEFAULT_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const DEFAULT_PORT = "3000";

export const config = {
  apiBase: `http://${DEFAULT_HOST}:${DEFAULT_PORT}/api`,
} as const;
