import { createContext, type ReactNode, useContext } from "react";

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

export function ClinicalEventProvider({ children }: ClinicalEventProviderProps) {
  return <ClinicalEventCtx.Provider value={{ emit: () => {} }}>{children}</ClinicalEventCtx.Provider>;
}
