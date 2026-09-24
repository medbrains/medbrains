/**
 * Navigator factory — converts the accessible module list (already
 * filtered for permissions by the shell) into a stack/drawer/tabs.
 *
 * For staff/vendor: bottom tab nav over modules.
 * For patient: stack with a home + per-module screens.
 * For tv: full-screen single-module focus (D-pad).
 */

import type { NavigatorRenderProps } from "@medbrains/mobile-shell";
import { APP_BAR, AppBarGradient } from "@medbrains/ui-mobile";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View } from "react-native";
import { EmergencyFlash } from "./components/emergency-flash.js";

const Stack = createNativeStackNavigator();

export function Navigator({ modules }: NavigatorRenderProps) {
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerBackground: () => <AppBarGradient />,
            headerStyle: { backgroundColor: "transparent" },
            headerTintColor: APP_BAR.foreground,
            headerShadowVisible: true,
            headerTitleStyle: { color: APP_BAR.title, fontWeight: "700" },
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
      {/* Above every screen: an open emergency code takes the phone over. */}
      <EmergencyFlash />
    </View>
  );
}
