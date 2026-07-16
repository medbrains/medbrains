/**
 * MedBrains Camp — dedicated field-camp mobile app.
 *
 * Keeps the installable app focused on remote village operations:
 * camp packet download, local patient search/chart, registration,
 * screening/vitals, lab sample capture, prescription and referral sync.
 */

import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  AuthProvider,
  NotificationBridge,
  Shell,
  buildDeviceTheme,
} from "@medbrains/mobile-shell";
import { apiConfig } from "./src/api/config";
import { CampLoginGate } from "./src/login-gate";
import { MODULES } from "./src/modules";
import { Navigator } from "./src/navigator";

const theme = buildDeviceTheme("light");

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <AuthProvider secretStore={apiConfig.store}>
          <NotificationBridge apiBase={apiConfig.baseUrl} surface="Mobile-Camp" />
          <Shell
            variant="camp"
            modules={MODULES}
            secretStore={apiConfig.store}
            cachePath="medbrains-camp-cache"
            Navigator={Navigator}
            loginGate={<CampLoginGate />}
            unlockPromptMessage="Unlock MedBrains Camp"
          />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
