/**
 * `ModuleNavigator` — composes a stack/drawer/tabs from the
 * accessible module list. The shell variant ("staff" | "patient" |
 * "tv" | "vendor") picks the chrome shape; modules supply screens.
 *
 * Implementation note: this file deliberately doesn't import
 * `@react-navigation/*` types directly — keeps the package
 * typecheckable when the host hasn't installed Navigation yet.
 * Hosts pass a `Navigator` factory that we render with the
 * accessible module list.
 */

import type { ComponentType, ReactNode } from "react";
import { View } from "react-native";
import { Button, Surface, Text } from "react-native-paper";
import { useSecretStore } from "../auth/auth-provider.js";
import { useAuthStore } from "../auth/auth-store.js";
import { DEVICE_PALETTE } from "../theme/index.js";
import { filterAccessibleModules } from "../types.js";
import type { ModuleList, ShellVariant } from "../types.js";

export interface NavigatorRenderProps {
  modules: ModuleList;
  variant: ShellVariant;
}

export interface ModuleNavigatorProps {
  modules: ModuleList;
  variant: ShellVariant;
  Navigator: ComponentType<NavigatorRenderProps>;
  fallback?: ReactNode;
}

export function ModuleNavigator(props: ModuleNavigatorProps): ReactNode {
  const { modules, variant, Navigator, fallback = null } = props;
  const identity = useAuthStore((s) => s.identity);
  const accessible = filterAccessibleModules(modules, identity);
  if (!identity) {
    return fallback;
  }
  if (accessible.length === 0) {
    return <NoAccessibleModules />;
  }
  return <Navigator modules={accessible} variant={variant} />;
}

function NoAccessibleModules(): ReactNode {
  const secretStore = useSecretStore();
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <Surface
      elevation={0}
      style={{
        flex: 1,
        justifyContent: "center",
        backgroundColor: DEVICE_PALETTE.canvas,
        padding: 24,
      }}
    >
      <View
        style={{
          borderRadius: 8,
          borderWidth: 1,
          borderColor: DEVICE_PALETTE.rule,
          backgroundColor: DEVICE_PALETTE.panel,
          padding: 20,
        }}
      >
        <Text
          variant="titleLarge"
          style={{
            color: DEVICE_PALETTE.ink,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          No mobile modules assigned
        </Text>
        <Text
          variant="bodyMedium"
          style={{
            color: DEVICE_PALETTE.muted,
            marginBottom: 20,
          }}
        >
          Ask an administrator to assign mobile permissions for this role.
        </Text>
        <Button
          mode="contained"
          buttonColor={DEVICE_PALETTE.brand}
          textColor={DEVICE_PALETTE.canvas}
          onPress={() => {
            void signOut(secretStore);
          }}
        >
          Back to login
        </Button>
      </View>
    </Surface>
  );
}
