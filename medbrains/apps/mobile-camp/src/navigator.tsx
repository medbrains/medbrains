/**
 * Navigator factory — converts the accessible module list (already
 * filtered for permissions by the shell) into a stack/drawer/tabs.
 *
 * Camp currently uses a single stack entry; the module itself owns
 * the nested packet, chart and workflow screens.
 */

import type { NavigatorRenderProps } from "@medbrains/mobile-shell";
import { useAuthStore, useSecretStore } from "@medbrains/mobile-shell";
import { APP_BAR, AppBarGradient } from "@medbrains/ui-mobile";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Image, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { useCampSession } from "./state/camp-session.js";
import { wipeActiveCampPacket } from "./storage/camp-local-store.js";

const Stack = createNativeStackNavigator();

export function Navigator({ modules }: NavigatorRenderProps) {
  const secretStore = useSecretStore();
  const signOut = useAuthStore((state) => state.signOut);
  const clearCurrentCamp = useCampSession((state) => state.clearCurrentCamp);

  async function logout(): Promise<void> {
    await wipeActiveCampPacket();
    clearCurrentCamp();
    await signOut(secretStore);
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerBackground: () => <AppBarGradient />,
          headerStyle: { backgroundColor: "transparent" },
          headerTintColor: APP_BAR.foreground,
          headerShadowVisible: true,
          headerTitle: ({ children }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Image
                source={require("../assets/icon.png")}
                style={{ width: 24, height: 24, borderRadius: 6 }}
              />
              <Text variant="titleMedium" style={{ color: APP_BAR.title, fontWeight: "700" }}>
                {children}
              </Text>
            </View>
          ),
          headerRight: () => (
            <Button
              compact
              mode="text"
              textColor={APP_BAR.foreground}
              accessibilityLabel="Logout"
              onPress={() => {
                void logout();
              }}
            >
              Logout
            </Button>
          ),
        }}
      >
        {modules.map((mod) => (
          <Stack.Screen
            key={mod.id}
            name={mod.id}
            component={mod.navigator}
            options={{ title: mod.displayName }}
          />
        ))}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
