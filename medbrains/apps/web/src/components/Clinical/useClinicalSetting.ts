import { useHasPermission } from "@medbrains/stores";
import { P, type TenantSettingsRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { clinicalSupportService } from "@/services/clinicalSupport.service";

/**
 * One hospital-configured clinical display setting, or `undefined` for the
 * built-in default.
 *
 * `/setup/settings` answers `admin.settings.read`, which a clinician need not
 * hold: without it the read is not sent (it was, about twenty times a minute
 * on a busy OPD, each refused). A refused or failed read is not retried and
 * the caller falls back to its defaults, as it does when nothing is set.
 */
export function useClinicalSetting(key: "vital_parameters" | "ros_systems"): unknown {
  const canRead = useHasPermission(P.ADMIN.SETTINGS.READ);
  const { data } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "clinical"],
    queryFn: () => clinicalSupportService.getTenantSettings("clinical"),
    staleTime: 600_000,
    enabled: canRead,
    retry: false,
  });
  return data?.find((s) => s.key === key)?.value;
}
