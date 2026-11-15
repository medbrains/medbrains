import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxPatientPolicy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Table, toast } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";

interface NhcxPolicyCardProps {
  patientId: string;
}

/** Who a policy is with, and who processes it — the code messages go to. */
function PolicyRow({ policy }: { policy: NhcxPatientPolicy }) {
  const isTpa = !!policy.payer_id && policy.payer_id !== policy.processing_id;
  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm">{policy.product_name ?? policy.product_id ?? "—"}</Text>
        <Text size="xs" c="dimmed">
          {policy.payer_name ?? policy.payer_id ?? "Insurer not named"}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Text size="sm" ff="monospace">
            {policy.processing_id}
          </Text>
          {isTpa && <Badge tone="accent">TPA</Badge>}
        </Group>
        {policy.processor_name && (
          <Text size="xs" c="dimmed">
            {policy.processor_name}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm" ff="monospace">
          {policy.member_id ?? "—"}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

/** The policies the NHCX registry links to a patient (by ABHA, then member
 * id) and the processor each message goes to. Hidden without
 * `insurance.nhcx.lookup_policies`, which gates the read and the lookup. */
export function NhcxPolicyCard({ patientId }: NhcxPolicyCardProps) {
  const queryClient = useQueryClient();
  const canLookup = useHasPermission(P.INSURANCE.NHCX.LOOKUP_POLICIES);
  const key = ["nhcx-policies", patientId];
  const kept = useQuery({
    queryKey: key,
    queryFn: () => api.listNhcxPatientPolicies(patientId),
    enabled: canLookup,
  });
  const lookup = useMutation({
    mutationFn: () => api.lookupNhcxPatientPolicies(patientId),
    onSuccess: (found) => {
      queryClient.setQueryData(key, found);
      if (found.policies.length) toast.success("Policies found on NHCX", { title: "Lookup done" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Lookup not done" }),
  });
  if (!canLookup) return null;
  const data = kept.data;
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">
          Policies on NHCX
        </Text>
        <Button
          size="xs"
          tone="tertiary"
          leftSection={<IconSearch size={16} />}
          loading={lookup.isPending}
          onClick={() => lookup.mutate()}
        >
          Find policies by ABHA
        </Button>
      </Group>
      {kept.isError ? (
        <Alert tone="warning" title="Could not load the patient's NHCX policies">
          Which policies are linked is unknown right now — this does not mean there are none.
        </Alert>
      ) : !data ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : data.policies.length === 0 ? (
        <Text size="sm" c="dimmed">
          {data.note ?? "Not looked up yet. Messages go to the payer you pick."}
        </Text>
      ) : (
        <>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Policy</Table.Th>
                <Table.Th>Processed by (messages go here)</Table.Th>
                <Table.Th>Member id</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.policies.map((p) => (
                <PolicyRow key={p.id} policy={p} />
              ))}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed">
            Found by {data.policies[0]?.identifier_type === "AbhaNumber" ? "ABHA" : "member id"},{" "}
            {formatDateTime(data.policies[0]?.fetched_at)}
          </Text>
        </>
      )}
    </Stack>
  );
}
