import { Group, Stack, Text } from "@mantine/core";
import type { AbdmReceivedRecordItem } from "@medbrains/types";
import { useMemo } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { formatDate } from "@/lib/date-utils";
import { HI_TYPE_LABEL } from "./abdmStatus";

interface Props {
  records: AbdmReceivedRecordItem[];
  onOpen: (id: string) => void;
}

interface FacilityGroup {
  name: string;
  records: AbdmReceivedRecordItem[];
}

/** Received records grouped by the hospital that sent them, newest first. */
export function ReceivedRecordsList({ records, onOpen }: Props) {
  const groups = useMemo(() => {
    const byFacility = new Map<string, FacilityGroup>();
    for (const r of records) {
      const g = byFacility.get(r.source_hip_id) ?? {
        name: r.source_hip_name ?? r.source_hip_id,
        records: [],
      };
      g.records.push(r);
      byFacility.set(r.source_hip_id, g);
    }
    return [...byFacility.values()];
  }, [records]);

  if (groups.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No records held. They appear here once the patient grants a request and the other hospital
        sends them, and are erased when the consent ends.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {groups.map((g) => (
        <Card key={g.name}>
          <Stack gap="xs">
            <Text fw={600}>{g.name}</Text>
            {g.records.map((r) => (
              <Group key={r.id} justify="space-between" wrap="nowrap">
                <Stack gap={0}>
                  <Group gap="xs">
                    <Badge tone="neutral">
                      {r.hi_type ? (HI_TYPE_LABEL[r.hi_type] ?? r.hi_type) : "Record"}
                    </Badge>
                    <Text size="sm">{r.title ?? r.care_context_reference}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {formatDate(r.record_date ?? r.received_at)} · held until{" "}
                    {formatDate(r.erase_at)}
                  </Text>
                </Stack>
                <Button tone="secondary" size="xs" onClick={() => onOpen(r.id)}>
                  View
                </Button>
              </Group>
            ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
