// IPD MlcTab — split from ipd.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import type { MlcCase } from "@medbrains/types";
import { IconLink } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";

export function MlcTab({ admissionId, canCreate }: { admissionId: string; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [mlcIdInput, setMlcIdInput] = useState("");

  const { data: mlcData, isLoading } = useQuery({
    queryKey: ["ipd-mlc", admissionId],
    queryFn: () => ipdService.getAdmissionMlc(admissionId),
  });

  const linkMutation = useMutation({
    mutationFn: (mlcCaseId: string) => ipdService.linkMlc(admissionId, { mlc_case_id: mlcCaseId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-mlc", admissionId] });
      void queryClient.invalidateQueries({ queryKey: ["admission-detail", admissionId] });
      toast.success("MLC case linked to admission", { title: "Linked" });
      setMlcIdInput("");
    },
  });

  const mlc = mlcData as MlcCase | null | undefined;

  return (
    <Stack>
      <Text fw={600}>Medico-Legal Case</Text>
      {isLoading ? (
        <Text c="dimmed">Loading...</Text>
      ) : mlc ? (
        <Card withBorder p="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <div>
              <Text size="xs" c="dimmed">
                MLC Number
              </Text>
              <Text fw={500}>{mlc.mlc_number}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Status
              </Text>
              <Badge size="sm">{mlc.status}</Badge>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Case Type
              </Text>
              <Text size="sm">{mlc.case_type ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                FIR Number
              </Text>
              <Text size="sm">{mlc.fir_number ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Police Station
              </Text>
              <Text size="sm">{mlc.police_station ?? "—"}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Brought By
              </Text>
              <Text size="sm">{mlc.brought_by ?? "—"}</Text>
            </div>
          </SimpleGrid>
          {mlc.history_of_incident && (
            <div>
              <Text size="xs" c="dimmed" mt="xs">
                History of Incident
              </Text>
              <Text size="sm">{mlc.history_of_incident}</Text>
            </div>
          )}
        </Card>
      ) : (
        <>
          <Text size="sm" c="dimmed">
            No MLC case linked to this admission.
          </Text>
          {canCreate && (
            <Group>
              <TextInput
                placeholder="MLC Case ID"
                value={mlcIdInput}
                onChange={(e) => setMlcIdInput(e.currentTarget.value)}
                w={300}
              />
              <Button
                tone="primary"
                size="sm"
                leftSection={<IconLink size={16} />}
                onClick={() => linkMutation.mutate(mlcIdInput)}
                loading={linkMutation.isPending}
                disabled={!mlcIdInput}
              >
                Link MLC Case
              </Button>
            </Group>
          )}
        </>
      )}
    </Stack>
  );
}
