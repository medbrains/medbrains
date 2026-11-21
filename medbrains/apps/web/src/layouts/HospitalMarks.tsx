// The hospital's own emblem and name banner, centred in the app header.

import { Group } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@/components/ui";
import { brandingService } from "@/services/branding.service";
import classes from "./AppLayout.module.scss";

/** The query key the Branding screen invalidates after a save. */
export const BRANDING_MARKS_QUERY_KEY = ["branding-marks"];

/** Mark height in the header, in px: fixed, so nothing moves as the images load. */
const MARK_HEIGHT = 32;

/**
 * The emblem, then the name banner, at one height in the header's centre;
 * either alone when only one is set, and nothing at all when neither is (or
 * when they cannot be read: the product brand on the left still shows, and
 * the read is not retried in a loop). Positioned over the header, so its
 * arrival never shifts the controls on either side.
 */
export function HospitalMarks() {
  const canView = useHasPermission(P.BRANDING.VIEW);
  const { data } = useQuery({
    queryKey: BRANDING_MARKS_QUERY_KEY,
    queryFn: () => brandingService.getBrandingMarks(),
    enabled: canView,
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!data || (!data.emblem && !data.name_banner)) return null;
  const name = data.display_name ?? "Hospital";
  return (
    <Group gap="xs" wrap="nowrap" className={classes.hospitalMarks} visibleFrom="md">
      {data.emblem && (
        <Image
          src={data.emblem}
          alt={data.name_banner ? `${name} emblem` : name}
          h={MARK_HEIGHT}
          w="auto"
          fit="contain"
          loading="eager"
        />
      )}
      {data.name_banner && (
        <Image
          src={data.name_banner}
          alt={name}
          h={MARK_HEIGHT}
          w="auto"
          fit="contain"
          loading="eager"
        />
      )}
    </Group>
  );
}
