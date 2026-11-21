import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { clinicalSupportService } from "@/services/clinicalSupport.service";

/**
 * One hospital-configured clinical display setting, or `undefined` for the
 * built-in default.
 *
 * Read from `/clinical/display-settings` under its own permission, not the
 * admin settings read a clinician does not hold. Without the permission the
 * read is not sent; a refused or failed read is not retried, and the caller
 * falls back to its defaults, as it does when the hospital set nothing.
 */
export function useClinicalSetting(key: "vital_parameters" | "ros_systems"): unknown {
  const canRead = useHasPermission(P.CLINICAL_NOTES.DISPLAY_SETTINGS.READ);
  const { data } = useQuery({
    queryKey: ["clinical-display-settings"],
    queryFn: () => clinicalSupportService.listClinicalDisplaySettings(),
    staleTime: 600_000,
    enabled: canRead,
    retry: false,
  });
  return data?.find((s) => s.key === key)?.value;
}
