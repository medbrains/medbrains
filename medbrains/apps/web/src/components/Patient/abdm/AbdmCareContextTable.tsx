import { Group, Stack, Text } from "@mantine/core";
import type { AbdmCareContext } from "@medbrains/types";
import { IconLink } from "@tabler/icons-react";
import { Badge, Button, Table } from "@/components/ui";
import { formatDate } from "@/lib/date-utils";
import { AbdmConformanceIssues } from "./AbdmConformanceIssues";
import { HI_TYPE_LABEL, LINK_STATUS } from "./abdmStatus";

interface AbdmCareContextTableProps {
  contexts: AbdmCareContext[];
  /** Absent when the viewer may not link, or nothing can link yet. */
  onLink?: (id: string) => void;
  linkingId?: string | null;
}

/** The patient's finalised records and whether each is linked to their ABHA. */
export function AbdmCareContextTable({ contexts, onLink, linkingId }: AbdmCareContextTableProps) {
  if (contexts.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No finalised records yet. A record appears here when a consultation is closed, a
        prescription signed, a lab report verified or a discharge summary signed.
      </Text>
    );
  }
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Record</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Status</Table.Th>
          {onLink && <Table.Th>Action</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {contexts.map((c) => {
          const status = LINK_STATUS[c.link_status];
          const canLink = c.link_status === "not_linked" || c.link_status === "failed";
          return (
            <Table.Tr key={c.id}>
              <Table.Td>
                <Stack gap={0}>
                  <Text size="sm">{c.display}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {c.reference_number}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {c.hi_types.map((t) => (
                    <Badge key={t} tone="neutral" variant="outline">
                      {HI_TYPE_LABEL[t] ?? t}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {c.link_status === "linked" && (
                    <Text size="xs" c="dimmed">
                      {formatDate(c.linked_at)} ·{" "}
                      {c.linked_via === "user_initiated" ? "by the patient" : "by the hospital"}
                    </Text>
                  )}
                  {c.link_status === "linked" && (
                    <Text size="xs" c="var(--mb-text-secondary)">
                      {c.notified_at
                        ? `Shown in the patient's app ${formatDate(c.notified_at)}`
                        : (c.notify_error ??
                          "The patient's app is told about a minute after linking")}
                    </Text>
                  )}
                  {c.last_error && c.link_status !== "linked" && (
                    <Text size="xs" c="var(--mb-text-secondary)">
                      {c.last_error}
                    </Text>
                  )}
                  <AbdmConformanceIssues issues={c.conformance_issues} />
                </Stack>
              </Table.Td>
              {onLink && (
                <Table.Td>
                  {canLink && (
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={<IconLink size={16} />}
                      loading={linkingId === c.id}
                      onClick={() => onLink(c.id)}
                    >
                      {c.link_status === "failed" ? "Retry" : "Link now"}
                    </Button>
                  )}
                </Table.Td>
              )}
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
