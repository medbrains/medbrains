import { setApiBase } from "@medbrains/api";
import { createQueryClient } from "@medbrains/stores";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { config } from "./config";
import { DashboardScreen } from "./screens/DashboardScreen";
import { OpdQueueScreen } from "./screens/OpdQueueScreen";
import { BedStatusScreen } from "./screens/BedStatusScreen";
import { LabStatusScreen } from "./screens/LabStatusScreen";
import { EmergencyTriageScreen } from "./screens/EmergencyTriageScreen";
import { DigitalSignageScreen } from "./screens/DigitalSignageScreen";
import { PharmacyQueueScreen } from "./screens/PharmacyQueueScreen";

setApiBase(config.apiBase);

const queryClient = createQueryClient();

/**
 * TV Display Modes
 *
 * Each screen can be launched directly via deep link:
 * - medbrains://tv/dashboard
 * - medbrains://tv/opd-queue?department=cardiology
 * - medbrains://tv/beds?ward=icu
 * - medbrains://tv/lab
 * - medbrains://tv/emergency
 * - medbrains://tv/signage
 * - medbrains://tv/pharmacy
 *
 * Or configured via admin dashboard to auto-launch on boot.
 */
export type RootStackParamList = {
  Dashboard: undefined;
  OpdQueue: { department_id?: string };
  BedStatus: { ward_id?: string };
  LabStatus: undefined;
  EmergencyTriage: undefined;
  DigitalSignage: undefined;
  PharmacyQueue: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                animation: "fade",
                contentStyle: { backgroundColor: "#0a0a1a" },
              }}
              initialRouteName="Dashboard"
            >
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="OpdQueue" component={OpdQueueScreen} />
              <Stack.Screen name="BedStatus" component={BedStatusScreen} />
              <Stack.Screen name="LabStatus" component={LabStatusScreen} />
              <Stack.Screen name="EmergencyTriage" component={EmergencyTriageScreen} />
              <Stack.Screen name="DigitalSignage" component={DigitalSignageScreen} />
              <Stack.Screen name="PharmacyQueue" component={PharmacyQueueScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
