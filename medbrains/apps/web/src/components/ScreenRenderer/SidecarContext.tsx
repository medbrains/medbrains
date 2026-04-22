import type { ResolvedScreen } from "@medbrains/types";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { runResolvedSidecars } from "./sidecarRuntime";

interface SidecarContextValue {
  emit: (trigger: string, payload: Record<string, unknown>) => void;
}

const SidecarCtx = createContext<SidecarContextValue>({
  emit: () => {},
});

export function useSidecarEmit() {
  return useContext(SidecarCtx).emit;
}

interface SidecarProviderProps {
  screen: ResolvedScreen;
  context: Record<string, unknown>;
  children: ReactNode;
}

export function SidecarProvider({ screen, context, children }: SidecarProviderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const firingRef = useRef(false);

  // Resolved sidecars are already filtered to active-only by the backend
  const activeSidecars = useMemo(() => screen.sidecars ?? [], [screen.sidecars]);

  const emit = useCallback(
    async (trigger: string, payload: Record<string, unknown>) => {
      // Prevent re-entrant firing (e.g., action triggers another sidecar)
      if (firingRef.current) return;
      firingRef.current = true;

      try {
        const mergedData = { ...context, ...payload };
        await runResolvedSidecars(activeSidecars, trigger, {
          navigate,
          queryClient,
          screenData: mergedData,
        });
      } finally {
        firingRef.current = false;
      }
    },
    [activeSidecars, context, navigate, queryClient],
  );

  const value = useMemo(() => ({ emit }), [emit]);

  return <SidecarCtx.Provider value={value}>{children}</SidecarCtx.Provider>;
}
