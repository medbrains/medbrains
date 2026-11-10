import { Anchor, Group, Stack, Text } from "@mantine/core";
import type { GroupCandidate } from "@medbrains/types";
import { Link } from "react-router";
import { Badge, Button, Table } from "@/components/ui";
import { BAND } from "./groupIdentityLabels";

interface GroupCandidateTableProps {
  candidates: GroupCandidate[];
  /** Absent without `patients.group_identity.link`: the table only reads. */
  onDecide?: (candidate: GroupCandidate, decision: "link" | "reject") => void;
  busyId?: string | null;
  /** Show which record here each match was found for (the review queue). */
  showLocal?: boolean;
}

/** Probable matches at other hospitals of the group, each with why. */
export function GroupCandidateTable({
  candidates,
  onDecide,
  busyId,
  showLocal,
}: GroupCandidateTableProps) {
  if (candidates.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No matches are waiting for a decision.
      </Text>
    );
  }
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          {showLocal && <Table.Th>Record here</Table.Th>}
          <Table.Th>Hospital</Table.Th>
          <Table.Th>Record there</Table.Th>
          <Table.Th>Why</Table.Th>
          {onDecide && <Table.Th />}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {candidates.map((c) => {
          const band = BAND[c.band ?? "review"];
          return (
            <Table.Tr key={c.candidate_id}>
              {showLocal && (
                <Table.Td>
                  <Anchor
                    component={Link}
                    to={`/patients/${c.local_patient_id}#documents`}
                    size="sm"
                  >
                    Open record
                  </Anchor>
                </Table.Td>
              )}
              <Table.Td>{c.hospital}</Table.Td>
              <Table.Td>
                <Text size="sm">
                  {c.first_name} {c.last_name}
                </Text>
                <Text size="xs" c="dimmed" ff="monospace">
                  {c.uhid}
                </Text>
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  <Badge tone={band.tone}>{band.label}</Badge>
                  {(c.reasons ?? []).map((r) => (
                    <Text key={r} size="xs" c="var(--mb-text-secondary)">
                      {r}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              {onDecide && (
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="xs"
                      tone="primary"
                      loading={busyId === c.candidate_id}
                      onClick={() => onDecide(c, "link")}
                    >
                      Same person — link
                    </Button>
                    <Button size="xs" tone="ghost" onClick={() => onDecide(c, "reject")}>
                      Not the same
                    </Button>
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
