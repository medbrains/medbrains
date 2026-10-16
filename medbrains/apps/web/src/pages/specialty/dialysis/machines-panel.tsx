/**
 * The unit's machines — each dedicated to one serology, so a seropositive
 * patient never shares a machine with a seronegative one — and how many
 * times a dialyzer may be reused here.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DialysisMachine, P, type SaveDialysisMachineRequest } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  NumberField,
  Select,
  Table,
  toast,
} from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import { SEROLOGY_OPTIONS, serologyLabel } from "./labels";

const BLANK: SaveDialysisMachineRequest = {
  code: "",
  name: "",
  serology: "none",
  status: "active",
};

export function MachinesPanel() {
  const qc = useQueryClient();
  const canConfigure = useHasPermission(P.SPECIALTY.OTHER.DIALYSIS_CONFIGURE);
  const [draft, setDraft] = useState<SaveDialysisMachineRequest>(BLANK);
  const machines = useQuery({
    queryKey: ["dialysis-machines"],
    queryFn: specialtyService.listDialysisMachines,
  });
  const policy = useQuery({
    queryKey: ["dialysis-reuse"],
    queryFn: specialtyService.getDialysisReusePolicy,
  });
  const [limit, setLimit] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: specialtyService.saveDialysisMachine,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dialysis-machines"] });
      setDraft(BLANK);
      toast.success("Machine saved");
    },
  });
  const setPolicy = useMutation({
    mutationFn: specialtyService.setDialysisReusePolicy,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dialysis-reuse"] });
      toast.success("Reuse limit saved for dialyzers issued from now on");
    },
  });

  if (machines.isError)
    return <Alert tone="danger">Could not load machines: {machines.error.message}</Alert>;
  const edit = (m: DialysisMachine) =>
    setDraft({
      code: m.code,
      name: m.name,
      serology: m.serology,
      status: m.status,
      location: m.location ?? "",
    });

  return (
    <Stack gap="md">
      <Table aria-label="Dialysis machines">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Kept for</Table.Th>
            <Table.Th>Status</Table.Th>
            {canConfigure && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(machines.data ?? []).map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>{m.code}</Table.Td>
              <Table.Td>{m.name}</Table.Td>
              <Table.Td>
                <Badge tone={m.serology === "none" ? "neutral" : "warning"}>
                  {serologyLabel(m.serology)}
                </Badge>
              </Table.Td>
              <Table.Td>{m.status}</Table.Td>
              {canConfigure && (
                <Table.Td>
                  <Button size="xs" tone="tertiary" onClick={() => edit(m)}>
                    Edit
                  </Button>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {canConfigure && (
        <Card padding="md" withBorder>
          <Stack gap="sm">
            <Text fw={600}>Add or update a machine</Text>
            <SimpleGrid cols={{ base: 1, sm: 4 }}>
              <Input
                label="Code"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.currentTarget.value })}
              />
              <Input
                label="Name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
              />
              <Select
                label="Kept for"
                data={SEROLOGY_OPTIONS}
                value={draft.serology}
                allowDeselect={false}
                onChange={(v) =>
                  v && setDraft({ ...draft, serology: v as SaveDialysisMachineRequest["serology"] })
                }
              />
              <Select
                label="Status"
                data={["active", "maintenance", "retired"]}
                value={draft.status ?? "active"}
                allowDeselect={false}
                onChange={(v) =>
                  v && setDraft({ ...draft, status: v as SaveDialysisMachineRequest["status"] })
                }
              />
            </SimpleGrid>
            {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
            <Group justify="flex-end">
              <Button tone="primary" loading={save.isPending} onClick={() => save.mutate(draft)}>
                Save machine
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
      {canConfigure && policy.data && (
        <Group align="flex-end">
          <NumberField
            label="Dialyzer reuse limit (seronegative patients)"
            description="Seropositive patients' dialyzers are always single-use"
            min={1}
            max={20}
            allowDecimal={false}
            value={limit ?? policy.data.max_uses}
            onChange={(v) => setLimit(Number(v) || 1)}
            w={320}
          />
          <Button
            tone="secondary"
            loading={setPolicy.isPending}
            onClick={() => setPolicy.mutate({ max_uses: limit ?? policy.data.max_uses })}
          >
            Save limit
          </Button>
        </Group>
      )}
    </Stack>
  );
}
