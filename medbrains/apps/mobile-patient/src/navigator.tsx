/**
 * Two tabs, because the app answers two different questions.
 *
 * **Hospital** is the record a clinician wrote. **Health** is what the person
 * does day to day, and it is where a band connects.
 *
 * Each tab is its own stack so that drilling into a lab report and then
 * switching to Health does not lose your place in either — a shared stack
 * makes the tabs feel like one list wearing two names.
 *
 * The Health tab is **hidden entirely** when nothing in it is available. That
 * is the point of the companion shipping hidden: a tab advertising a feature
 * the hospital has not licensed is an advert, not navigation.
 */

import type { NavigatorRenderProps } from "@medbrains/mobile-shell";
import { APP_BAR, AppBarGradient, COLORS } from "@medbrains/ui-mobile";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ComponentType } from "react";
import { useMemo } from "react";
import { TAB_LABEL, tabFor } from "./tabs.js";

const Tabs = createBottomTabNavigator();

const SCREEN_OPTIONS = {
  headerBackground: () => <AppBarGradient />,
  headerStyle: { backgroundColor: "transparent" },
  headerTintColor: APP_BAR.foreground,
  headerShadowVisible: true,
  headerTitleStyle: { color: APP_BAR.title, fontWeight: "700" as const },
};

/** One stack per tab, so each tab keeps its own place. */
function stackFor(modules: NavigatorRenderProps["modules"]): ComponentType {
  const Stack = createNativeStackNavigator();
  return function TabStack() {
    return (
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        {modules.map((mod) => (
          <Stack.Screen
            key={mod.id}
            name={mod.id}
            component={mod.navigator}
            options={{ title: mod.displayName }}
          />
        ))}
      </Stack.Navigator>
    );
  };
}

export function Navigator({ modules }: NavigatorRenderProps) {
  /**
   * Grouped once per module-list change rather than on every render — the list
   * is short, but a tab navigator remounting its stacks because the component
   * identity changed is a real bug, not a micro-optimisation.
   */
  const grouped = useMemo(() => {
    const hospital = modules.filter((mod) => tabFor(mod.id) === "hospital");
    const health = modules.filter((mod) => tabFor(mod.id) === "health");
    return {
      hospital: hospital.length > 0 ? stackFor(hospital) : null,
      health: health.length > 0 ? stackFor(health) : null,
    };
  }, [modules]);

  return (
    <NavigationContainer>
      <Tabs.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.brand,
          tabBarInactiveTintColor: COLORS.ink,
          // WCAG 2.2 SC 2.5.8 — a tab is a target like any other.
          tabBarStyle: { minHeight: 56 },
        }}
      >
        {grouped.hospital && (
          <Tabs.Screen
            name="hospital"
            component={grouped.hospital}
            options={{ title: TAB_LABEL.hospital }}
          />
        )}
        {grouped.health && (
          <Tabs.Screen
            name="health"
            component={grouped.health}
            options={{ title: TAB_LABEL.health }}
          />
        )}
      </Tabs.Navigator>
    </NavigationContainer>
  );
}
