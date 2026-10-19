import { Group, Stack, Text } from "@mantine/core";
import type { FacilityHfr, HfrStatus } from "@medbrains/types";
import { Badge, type BadgeTone } from "@/components/ui";

const STATUS: Record<HfrStatus, { label: string; tone: BadgeTone }> = {
  not_registered: { label: "Not in HFR", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  registered: { label: "Linked, unverified", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
};

interface FacilityHfrCellProps {
  hfr: FacilityHfr | undefined;
  /** The HFR list failed to load — say so rather than "Not in HFR". */
  isError: boolean;
}

export function FacilityHfrCell({ hfr, isError }: FacilityHfrCellProps) {
  if (isError) {
    return (
      <Badge size="sm" tone="danger">
        HFR status unavailable
      </Badge>
    );
  }
  if (!hfr) {
    return (
      <Text size="sm" c="dimmed">
        -
      </Text>
    );
  }
  const status = STATUS[hfr.hfr_status];
  return (
    <Stack gap={2}>
      <Group gap={4}>
        <Badge size="sm" tone={status.tone}>
          {status.label}
        </Badge>
        {hfr.dhis_eligible && (
          <Badge size="sm" tone="accent">
            DHIS eligible
          </Badge>
        )}
      </Group>
      {hfr.hfr_facility_id && (
        <Text size="xs" ff="monospace">
          {hfr.hfr_facility_id}
        </Text>
      )}
    </Stack>
  );
}
