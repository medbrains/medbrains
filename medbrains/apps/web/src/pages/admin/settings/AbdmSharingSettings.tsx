import { Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LINK_STATUS } from "@/components/Patient/abdm/abdmStatus";
import { Alert, Badge, Button, Card, SegmentedControl, Table, toast } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { abdmRecordsService } from "@/services/abdmRecords.service";

/** `YYYY-MM` of this month or the one before, in the viewer's calendar. */
function monthKey(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text size="xl" fw={600}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Card>
  );
}

/**
 * Settings → ABDM sharing: this month's links by DHIS category, what DHIS
 * would count, and every record that failed to link, with a retry.
 */
export function AbdmSharingSettings() {
  const canManage = useHasPermission(P.ABDM.RECORDS.MANAGE);
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState("0");
  const month = monthKey(Number(offset));
  const key = ["abdm", "sharing", month];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => abdmRecordsService.sharingSummary(month),
  });
  const retry = useMutation({
    mutationFn: abdmRecordsService.link,
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: key });
      if (row.link_status === "failed") toast.error(row.last_error ?? "ABDM refused it.");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not retry" }),
  });

  if (isLoading) return <Loader size="sm" />;
  if (isError || !data) {
    return (
      <Alert tone="danger" title="Could not load ABDM sharing">
        This does not mean nothing was shared — the figures failed to load.
      </Alert>
    );
  }
  const c = data.counts;
  const eligible = c.eligible_category_1 + c.eligible_category_2;

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>ABDM sharing</Text>
        <SegmentedControl
          aria-label="Month"
          value={offset}
          onChange={setOffset}
          data={[
            { value: "0", label: "This month" },
            { value: "1", label: "Last month" },
          ]}
        />
      </Group>
      {!data.configured && (
        <Alert tone="warning" title="ABDM is not set up">
          No record is linked until the ABDM keys are saved under Settings → ABDM.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <Stat
          label="Linked · category 1"
          value={c.linked_category_1}
          hint="Lab reports, discharge summaries"
        />
        <Stat
          label="Linked · category 2"
          value={c.linked_category_2}
          hint="Consultations, prescriptions"
        />
        <Stat
          label="Counted for DHIS"
          value={eligible}
          hint={`KYC-verified ABHAs, 1 a day and 5 a month each; pays above ${data.dhis_threshold}`}
        />
        <Stat
          label="Estimated incentive"
          value={`₹${data.estimated_incentive_inr.toLocaleString("en-IN")}`}
          hint={data.threshold_met ? "Threshold passed" : "Paid only once the threshold is passed"}
        />
        <Stat label="Failed" value={c.failed} />
        <Stat label="Waiting for ABDM" value={c.linking} />
        <Stat label="Not linked" value={c.not_linked} />
        <Stat label="Records sent under consent" value={c.transfers} />
      </SimpleGrid>
      <Card>
        <Stack gap="xs">
          <Text fw={600}>Records that did not link</Text>
          {data.failures.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nothing has failed.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Patient</Table.Th>
                  <Table.Th>Record</Table.Th>
                  <Table.Th>Why</Table.Th>
                  {canManage && <Table.Th>Action</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.failures.map((f) => (
                  <Table.Tr key={f.id}>
                    <Table.Td>
                      <Text size="sm">{f.patient_name}</Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {f.uhid}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{f.display}</Text>
                      <Text size="xs" c="dimmed">
                        {formatDateTime(f.updated_at)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge tone={LINK_STATUS[f.link_status].tone}>
                        {LINK_STATUS[f.link_status].label}
                      </Badge>
                      <Text size="xs">{f.last_error ?? "—"}</Text>
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Button
                          tone="secondary"
                          size="xs"
                          loading={retry.isPending && retry.variables === f.id}
                          onClick={() => retry.mutate(f.id)}
                        >
                          Retry
                        </Button>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
