/**
 * Top-level `Shell` — composes Provider + Gate + ModuleNavigator.
 * Each generated app instantiates this with its variant + module
 * list + supplied platform shims (SecretStore, mTLS pair callback,
 * Navigator factory).
 */

import type { ComponentType, ReactNode } from "react";
import { AuthProvider } from "./auth/auth-provider.js";
import { BiometricUnlockGate } from "./auth/biometric-unlock-gate.js";
import { ModuleNavigator } from "./nav/module-navigator.js";
import type { NavigatorRenderProps } from "./nav/module-navigator.js";
import { OfflineProvider } from "./offline/offline-provider.js";
import type { SecretStore } from "./secret-store/index.js";
import type { ModuleList, ShellVariant } from "./types.js";

export interface ShellProps {
  variant: ShellVariant;
  modules: ModuleList;
  secretStore: SecretStore;
  cachePath: string;
  Navigator: ComponentType<NavigatorRenderProps>;
  loginGate?: ReactNode;
  unlockPromptMessage?: string;
}

export function Shell(props: ShellProps): ReactNode {
  const {
    variant,
    modules,
    secretStore,
    cachePath,
    Navigator,
    loginGate = null,
    unlockPromptMessage,
  } = props;

  return (
    <AuthProvider secretStore={secretStore}>
      <OfflineProvider cachePath={cachePath} fallback={loginGate}>
        <BiometricUnlockGate promptMessage={unlockPromptMessage}>
          <ModuleNavigator
            modules={modules}
            variant={variant}
            Navigator={Navigator}
            fallback={loginGate}
          />
        </BiometricUnlockGate>
      </OfflineProvider>
    </AuthProvider>
  );
}
