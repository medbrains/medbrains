import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";
import { useClinicalEventStore } from "./clinical-event-store";
import { buildClinicalEventTrace } from "./clinical-events";

interface ClinicalEventContextValue {
  emit: (trigger: string, payload: Record<string, unknown>) => void;
}

const ClinicalEventCtx = createContext<ClinicalEventContextValue>({
  emit: () => {},
});

export function useClinicalEmit() {
  return useContext(ClinicalEventCtx).emit;
}

interface ClinicalEventProviderProps {
  moduleCode: string;
  contextCode: string;
  children: ReactNode;
}

export function ClinicalEventProvider({
  children,
  contextCode,
  moduleCode,
}: ClinicalEventProviderProps) {
  const recordEvent = useClinicalEventStore((state) => state.recordEvent);
  const emit = useCallback(
    (trigger: string, payload: Record<string, unknown>) => {
      const event = buildClinicalEventTrace({
        contextCode,
        moduleCode,
        occurredAt: new Date().toISOString(),
        payload,
        rawTrigger: trigger,
      });
      recordEvent(event);
      if (event.missingPayloadKeys.length > 0 && import.meta.env.DEV) {
        console.warn("Clinical event payload missing required keys", {
          event: event.eventName,
          missing: event.missingPayloadKeys,
          payload,
          trigger,
        });
      }
    },
    [contextCode, moduleCode, recordEvent],
  );
  const value = useMemo(() => ({ emit }), [emit]);

  return <ClinicalEventCtx.Provider value={value}>{children}</ClinicalEventCtx.Provider>;
}
