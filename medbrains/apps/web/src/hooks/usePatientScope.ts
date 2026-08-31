import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { safeReturnPath } from "@/lib/return-path";

/** A UUID, and nothing that merely looks like one. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PatientScope {
  /**
   * The patient this screen was opened for, or `""` when it was reached
   * directly from the navigation.
   *
   * `""` rather than `null` so it can be handed straight to a form field
   * without every caller writing the same `?? ""`.
   */
  patientId: string;
  /** Whether a patient was named — the screen is scoped rather than general. */
  isScoped: boolean;
  /** Where to go back to. Validated; falls back when absent or crafted. */
  returnPath: string | null;
}

/**
 * The patient a screen was opened for, from the query string.
 *
 * The specialty modules are reachable two ways: from the navigation, as a
 * ward-wide worklist, and from a patient's own encounter. Opened the second
 * way they arrive with `?patient_id=…&return=…`, and without reading it the
 * clinician had to find the patient again in a table they had just come from
 * — which is how a procedure gets recorded against the wrong chart.
 *
 * The id is validated as a UUID before use. It reaches a form field and then a
 * request body, and a query parameter is not a trusted input.
 *
 * The return path goes through `safeReturnPath`, so a crafted `return=` cannot
 * bounce a clinician off-site.
 */
export function usePatientScope(): PatientScope {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const raw = searchParams.get("patient_id");
    const patientId = raw && UUID.test(raw) ? raw : "";
    const rawReturn = searchParams.get("return");
    return {
      patientId,
      isScoped: patientId !== "",
      returnPath: rawReturn ? safeReturnPath(rawReturn, "/dashboard") : null,
    };
  }, [searchParams]);
}
