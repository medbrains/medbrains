import { Stack, Text } from "@mantine/core";
import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui";
import { SNOMED_NOT_LOADED, snomedService } from "@/services/snomed.service";

const SNOMED_PERMISSIONS = [
  P.TERMINOLOGY.SNOMED.VIEW,
  P.TERMINOLOGY.SNOMED.ANALYTICS,
  P.TERMINOLOGY.SNOMED.MANAGE,
];

export function useSnomedStatus() {
  const allowed = useHasAnyPermission(SNOMED_PERMISSIONS);
  return useQuery({
    queryKey: ["snomed-status"],
    queryFn: snomedService.getStatus,
    enabled: allowed,
    staleTime: 60_000,
  });
}

/**
 * Which SNOMED CT release is loaded, and the attribution the affiliate
 * licence (clause 8.3) requires wherever SNOMED CT content is shown.
 */
export function SnomedLicenceNotice() {
  const status = useSnomedStatus();
  if (status.isError) {
    return (
      <Alert tone="danger" title="Could not check the SNOMED CT release">
        The terminology status did not load. Reload the page to try again.
      </Alert>
    );
  }
  const data = status.data;
  if (!data) return null;
  const versions = data.releases.map((r) => `${r.edition} ${r.version_date}`).join(", ");
  return (
    <Alert tone={data.loaded ? "neutral" : "warning"} title="SNOMED CT">
      <Stack gap={4}>
        <Text size="sm">{data.loaded ? `Loaded release: ${versions}` : SNOMED_NOT_LOADED}</Text>
        <Text size="xs" c="dimmed">
          {data.licence_notice}
        </Text>
      </Stack>
    </Alert>
  );
}
