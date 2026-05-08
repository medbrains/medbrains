import { setApiBase } from "@medbrains/api";
import { createQueryClient } from "@medbrains/stores";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { config } from "./config";
import { RootNavigator } from "./navigation/RootNavigator";
import { theme } from "./theme/paper-theme";

setApiBase(config.apiBase);

const queryClient = createQueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
