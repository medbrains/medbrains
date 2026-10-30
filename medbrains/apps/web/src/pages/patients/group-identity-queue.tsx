import { Loader, Stack } from "@mantine/core";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { GroupCandidateTable } from "@/components/Patient/groupIdentity/GroupCandidateTable";
import { useGroupDecisions } from "@/components/Patient/groupIdentity/useGroupDecisions";
import { Alert, Card, SegmentedControl } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { groupIdentityService } from "@/services/groupIdentity.service";

type Status = "pending" | "linked" | "rejected";

/**
 * Patients → Group matches: the probable matches between this hospital's
 * patients and the group's other hospitals, for a person to link or keep
 * apart. Certain matches (same verified ABHA, same Aadhaar) are linked when
 * found; nothing probable is ever linked without a decision here.
 */
export function GroupIdentityQueuePage() {
  useRequirePermission(P.PATIENTS.GROUP_IDENTITY.LINK);
  const [status, setStatus] = useState<Status>("pending");
  const { onDecide, modal, busyId } = useGroupDecisions();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["group-identity", "queue", status],
    queryFn: () => groupIdentityService.queue(status),
  });
  return (
    <Stack>
      <PageHeader
        title="Group matches"
        subtitle="Probable matches with the group's other hospitals. Records are linked, never merged."
      />
      {modal}
      <Card>
        <Stack gap="md">
          <SegmentedControl
            value={status}
            onChange={(v) => setStatus(v as Status)}
            data={[
              { value: "pending", label: "Waiting" },
              { value: "linked", label: "Linked" },
              { value: "rejected", label: "Kept apart" },
            ]}
          />
          {isLoading && <Loader size="sm" />}
          {isError && (
            <Alert tone="danger" title="Could not load the matches">
              {(error as Error).message}
            </Alert>
          )}
          {data && (
            <GroupCandidateTable
              candidates={data}
              onDecide={status === "pending" ? onDecide : undefined}
              busyId={busyId}
              showLocal
            />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
