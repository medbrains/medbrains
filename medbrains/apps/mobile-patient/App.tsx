/**
 * MedBrains Patient — entry component.
 *
 * Public-store distribution. Composes the medbrains mobile-shell
 * with the 6 patient self-service modules. Login gate uses
 * password login currently; ABHA flow lives in
 * `src/auth/sign-in.ts` and switches over once the tenant's NHA
 * consumer endpoint is deployed.
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
import { PatientLoginGate } from "./src/login-gate";
import { MODULES } from "./src/modules";

const theme = buildForestCopperTheme("light");

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <AuthProvider secretStore={apiConfig.store}>
          <Shell
            variant="patient"
            modules={MODULES}
            secretStore={apiConfig.store}
            cachePath="medbrains-cache"
            Navigator={Navigator}
            loginGate={<PatientLoginGate />}
            unlockPromptMessage="Unlock MedBrains"
          />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
