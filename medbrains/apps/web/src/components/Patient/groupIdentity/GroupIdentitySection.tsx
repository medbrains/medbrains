import { Anchor, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { GroupRecord } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Button, Panel, Table, toast } from "@/components/ui";
import { formatDate } from "@/lib/date-utils";
import { groupIdentityService } from "@/services/groupIdentity.service";
import { GroupCandidateTable } from "./GroupCandidateTable";
import { METHOD_LABEL } from "./groupIdentityLabels";
import { ReasonModal } from "./ReasonModal";
import { useGroupDecisions } from "./useGroupDecisions";

interface GroupIdentitySectionProps {
  patientId: string;
}

/**
 * Patient chart → the same person at the group's other hospitals. Identity
 * only (masked as the viewer's field access says): the other hospital's
 * chart is reached through consent (ABDM, transfers), never from here.
 * Hidden — and never fetched — without `patients.group_identity.view`;
 * linking needs `patients.group_identity.link`.
 */
export function GroupIdentitySection({ patientId }: GroupIdentitySectionProps) {
  const canView = useHasPermission(P.PATIENTS.GROUP_IDENTITY.VIEW);
  const canLink = useHasPermission(P.PATIENTS.GROUP_IDENTITY.LINK);
  const queryClient = useQueryClient();
  const [unlinking, setUnlinking] = useState<GroupRecord | null>(null);
  const { onDecide, modal, busyId } = useGroupDecisions();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["group-identity", patientId],
    queryFn: () => groupIdentityService.get(patientId),
    enabled: canView,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["group-identity"] });
  const scan = useMutation({
    mutationFn: () => groupIdentityService.scan(patientId),
    onSuccess: (r) => {
      void refresh();
      toast.success(
        r.linked + r.queued === 0
          ? "No record of this patient at the group's other hospitals."
          : `${r.linked} linked (same ABHA or Aadhaar), ${r.queued} probable for review.`,
      );
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not search the group" }),
  });
  const unlink = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      groupIdentityService.unlink(id, reason),
    onSuccess: () => {
      void refresh();
      setUnlinking(null);
      toast.success("Unlinked. Both records stay as they were.");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not unlink" }),
  });

  if (!canView || (data && !data.group_name)) return null;

  return (
    <Panel
      title="Other hospitals in the group"
      description="The same person's records elsewhere in the group: linked, never merged."
      actions={
        canLink && data?.sharing ? (
          <Button size="xs" tone="secondary" loading={scan.isPending} onClick={() => scan.mutate()}>
            Find at group hospitals
          </Button>
        ) : undefined
      }
    >
      {modal}
      <ReasonModal
        opened={unlinking !== null}
        title="Unlink this record"
        explanation={`The record at ${unlinking?.hospital ?? "the other hospital"} stops being treated as this patient. Neither record changes.`}
        confirmLabel="Unlink"
        busy={unlink.isPending}
        onConfirm={(reason) => unlinking && unlink.mutate({ id: unlinking.link_id, reason })}
        onClose={() => setUnlinking(null)}
      />
      {isLoading && <Loader size="sm" />}
      {isError && (
        <Alert tone="danger" title="Could not load the group's records">
          This does not mean there are none — the list failed to load.
        </Alert>
      )}
      {data && !data.sharing && (
        <Alert tone="info" title="Records are not shared in this group">
          {data.group_name} has not turned on record sharing between its hospitals, so records
          cannot be linked. That is a management decision about patient data.
        </Alert>
      )}
      {data?.sharing && (
        <Stack gap="md">
          {data.links.length === 0 ? (
            <Text size="sm" c="dimmed">
              Not linked to a record at another hospital yet.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Hospital</Table.Th>
                  <Table.Th>Record there</Table.Th>
                  <Table.Th>Linked by</Table.Th>
                  {canLink && <Table.Th />}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.links.map((l) => (
                  <Table.Tr key={l.link_id}>
                    <Table.Td>{l.hospital}</Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {l.first_name} {l.last_name}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {l.uhid}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone="neutral">{METHOD_LABEL[l.match_method]}</Badge>
                      <Text size="xs" c="dimmed">
                        {formatDate(l.linked_at)}
                      </Text>
                    </Table.Td>
                    {canLink && (
                      <Table.Td>
                        <Button size="xs" tone="danger-ghost" onClick={() => setUnlinking(l)}>
                          Unlink…
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {(data.candidates.length > 0 || canLink) && (
            <Panel title="Probable matches" bare>
              <GroupCandidateTable
                candidates={data.candidates}
                onDecide={canLink ? onDecide : undefined}
                busyId={busyId}
              />
              {canLink && (
                <Anchor component={Link} to="/patients/group-identity" size="sm">
                  All matches waiting in the group
                </Anchor>
              )}
            </Panel>
          )}
        </Stack>
      )}
    </Panel>
  );
}
