import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createSessionStorageAdapter } from "./platform-storage.js";

/**
 * Edition entitlements — which modules the tenant's edition ("mode") has switched
 * OFF. Loaded from `/api/auth/me` (`disabled_modules`) so every user, not just
 * admins, gets the same view. Backward-safe: a module is enabled unless it is
 * *explicitly* disabled, so tenants with no `module_config` rows see everything.
 *
 * Mirrors `permission-store` (sessionStorage, Set serialized as array).
 */
interface ModuleState {
  disabledModules: Set<string>;
  setDisabledModules: (codes: string[]) => void;
  clearModules: () => void;
  isModuleEnabled: (code?: string) => boolean;
}

export const useModuleStore = create<ModuleState>()(
  persist(
    (set, get) => ({
      disabledModules: new Set<string>(),

      setDisabledModules: (codes) => set({ disabledModules: new Set(codes) }),

      clearModules: () => set({ disabledModules: new Set() }),

      isModuleEnabled: (code) => {
        if (!code) return true;
        return !get().disabledModules.has(code);
      },
    }),
    {
      name: "module-cache",
      storage: createJSONStorage(createSessionStorageAdapter, {
        replacer: (_key, value) => (value instanceof Set ? Array.from(value) : value),
        reviver: (key, value) =>
          key === "disabledModules" && Array.isArray(value) ? new Set(value as string[]) : value,
      }),
      partialize: (state) => ({ disabledModules: state.disabledModules }),
    },
  ),
);
