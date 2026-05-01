/**
 * Lightweight module router. Each module owns a sub-stack of screens
 * (home → list → detail). Rather than wiring React Navigation for
 * nested stacks, modules use a typed reducer + push/pop API.
 *
 * `route.id` selects a screen from the module's render map; `payload`
 * carries arbitrary state to the next screen. The shell's outer
 * navigator handles inter-module navigation; this handles within.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface RouteState<P = unknown> {
  id: string;
  payload?: P;
}

interface ModuleRouterApi {
  current: RouteState;
  push: (id: string, payload?: unknown) => void;
  replace: (id: string, payload?: unknown) => void;
  pop: () => void;
  reset: () => void;
}

const RouterContext = createContext<ModuleRouterApi | null>(null);

export interface ModuleRouterProps {
  initial: string;
  screens: Record<string, ReactNode | ((payload: unknown) => ReactNode)>;
}

export function ModuleRouter({ initial, screens }: ModuleRouterProps): ReactNode {
  const [stack, setStack] = useState<RouteState[]>([{ id: initial }]);
  const current = stack[stack.length - 1] ?? { id: initial };

  const push = useCallback((id: string, payload?: unknown) => {
    setStack((s) => [...s, { id, payload }]);
  }, []);

  const replace = useCallback((id: string, payload?: unknown) => {
    setStack((s) => [...s.slice(0, -1), { id, payload }]);
  }, []);

  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const reset = useCallback(() => {
    setStack([{ id: initial }]);
  }, [initial]);

  const api = useMemo<ModuleRouterApi>(
    () => ({ current, push, replace, pop, reset }),
    [current, push, replace, pop, reset],
  );

  const screen = screens[current.id];
  const rendered =
    typeof screen === "function" ? screen(current.payload ?? undefined) : screen;

  return (
    <RouterContext.Provider value={api}>{rendered ?? null}</RouterContext.Provider>
  );
}

export function useModuleRouter(): ModuleRouterApi {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("useModuleRouter called outside ModuleRouter");
  }
  return ctx;
}
