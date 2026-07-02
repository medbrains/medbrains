import { useEffect } from "react";
import { useAiAssistantStore } from "@/components/ai";

/**
 * Makes the app-wide crab assistant patient-aware while a patient screen is
 * mounted — opening it (even via the floating launcher) grounds on this patient,
 * not just via the Ask AI button. Cleared on unmount. Safe if it lingers: the
 * backend re-checks patient-viewer access before injecting any clinical context.
 */
export function usePatientAssistantContext(patientId: string | undefined): void {
  const setContext = useAiAssistantStore((s) => s.setContext);

  // External-store sync tied to this page's lifecycle (allowed useEffect use).
  useEffect(() => {
    if (!patientId) return;
    setContext({ patient_id: patientId });
    return () => setContext(undefined);
  }, [patientId, setContext]);
}
