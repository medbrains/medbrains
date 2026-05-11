/**
 * Navigator factory — converts the accessible module list (already
 * filtered for permissions by the shell) into a stack/drawer/tabs.
 *
 * Camp currently uses a single stack entry; the module itself owns
 * the nested packet, chart and workflow screens.
 */

import type { NavigatorRenderProps } from "@medbrains/mobile-shell";
import { APP_BAR, AppBarGradient } from "@medbrains/ui-mobile";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator();

export function Navigator({ modules }: NavigatorRenderProps) {
  return (
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
  );
}
