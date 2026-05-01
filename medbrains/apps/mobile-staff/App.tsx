/**
 * MedBrains Staff — entry component.
 *
 * Composes the medbrains mobile-shell with this app's 11 modules
 * (doctor / nurse / pharmacy / lab / billing / bme / facilities /
 * housekeeping / security / hr / reception). Login gate is the
 * `StaffLoginGate` — hits the shared `/api/auth/login` endpoint.
 */

import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  AuthProvider,
  Shell,
  buildForestCopperTheme,
} from "@medbrains/mobile-shell";
import { apiConfig } from "./src/api/config";
import { Navigator } from "./src/navigator";
import { StaffLoginGate } from "./src/login-gate";
import { MODULES } from "./src/modules";

const theme = buildForestCopperTheme("light");

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <AuthProvider secretStore={apiConfig.store}>
          <Shell
            variant="staff"
            modules={MODULES}
            secretStore={apiConfig.store}
            cachePath="medbrains-cache"
            Navigator={Navigator}
            loginGate={<StaffLoginGate />}
            unlockPromptMessage="Unlock MedBrains Staff"
          />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
