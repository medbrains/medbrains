/**
 * Navigator factory — converts the accessible module list (already
 * filtered for permissions by the shell) into a stack/drawer/tabs.
 *
 * For staff/vendor: bottom tab nav over modules.
 * For patient: stack with a home + per-module screens.
 * For tv: full-screen single-module focus (D-pad).
 */

import type { NavigatorRenderProps } from "@medbrains/mobile-shell";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "@medbrains/ui-mobile";

const Stack = createNativeStackNavigator();

export function Navigator({ modules }: NavigatorRenderProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.brand },
          headerTintColor: COLORS.canvas,
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
