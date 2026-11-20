import { notifications } from "@mantine/notifications";
import type { FacilityHfr } from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { abdmRegistryService } from "@/services/abdmRegistry.service";

/**
 * Link an HFR ID the search found to this campus, instead of registering a
 * second record for it. Says on screen whether it worked; `onLinked` runs
 * after a link so the caller can refresh and close.
 */
export function useHfrLink(facility: FacilityHfr, onLinked: () => void) {
  return useMutation({
    mutationFn: (hfrId: string) =>
      abdmRegistryService.linkFacilityHfr(facility.id, {
        hfr_facility_id: hfrId,
        hfr_bed_count: facility.hfr_bed_count ?? facility.bed_count,
        hfr_ipd: facility.hfr_ipd,
      }),
    onSuccess: (row) => {
      notifications.show({
        title: "HFR ID linked",
        message: `${row.name}: ${row.hfr_facility_id}`,
        color: "success",
      });
      onLinked();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Link failed", message: err.message, color: "danger" }),
  });
}
